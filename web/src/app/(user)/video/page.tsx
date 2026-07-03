"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, ClipboardPaste, Download, FolderPlus, History, LoaderCircle, Maximize2, Music2, Pause, PenLine, Play, Plus, RotateCcw, SlidersHorizontal, Sparkles, Trash2, Upload, VideoIcon, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { App, Button, Drawer, Empty, Input, Modal, Typography } from "antd";
import localforage from "localforage";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";

import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { ModelPicker } from "@/components/model-picker";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { SelectionBubble } from "@/components/selection-bubble";
import { VideoSettingsPanel, normalizeVideoResolutionValue, normalizeVideoSizeValue, videoResolutionLabel, videoSizeLabel } from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { boolConfig, isSeedanceVideoConfig, normalizeSeedanceRatio, seedanceReferenceLabel, seedanceVideoReferenceError, seedanceVideoReferenceHint, SEEDANCE_REFERENCE_LIMITS } from "@/lib/seedance-video";
import { createVideoThumbnail, normalizeVideoThumbnail, VIDEO_THUMBNAIL_VERSION } from "@/lib/video-thumbnail";
import { recordDeletedSyncIds } from "@/services/app-sync";
import { deleteStoredMedia, resolveMediaUrl, uploadMediaFile } from "@/services/file-storage";
import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { createVideoGenerationTask, pollVideoGenerationTask, storeGeneratedVideo, videoGenerationPollConfig, type VideoGenerationTask } from "@/services/api/video";
import { consumeImageToVideoReferences } from "@/services/workbench-handoff";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { modelOptionLabel, normalizeVideoCallMode, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

type GeneratedVideo = {
    id: string;
    url: string;
    storageKey: string;
    thumbnail?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    video?: GeneratedVideo;
    error?: string;
};

type ReferencePreview = { kind: "image"; label: string; item: ReferenceImage } | { kind: "video"; label: string; item: ReferenceVideo };

type GenerationLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    durationMs: number;
    size: string;
    resolution: string;
    seconds: string;
    status: "生成中" | "成功" | "失败";
    task?: VideoGenerationTask;
    video?: GeneratedVideo;
    error?: string;
};

type GenerationLogConfig = Pick<AiConfig, "model" | "videoModel" | "videoCallMode" | "size" | "vquality" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark">;

type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
type PollGenerationOptions = { notify?: boolean };

const LOG_STORE_KEY = "infinite-canvas:video_generation_logs";
const INITIAL_LOG_VISIBLE_COUNT = 60;
const LOG_VISIBLE_BATCH_SIZE = 60;
const VIDEO_LOG_THUMBNAIL_MIN_RENDER_EDGE = 720;
const RESULT_ACTION_BUTTON_CLASS = "!inline-flex !items-center !justify-center whitespace-nowrap px-2 [&_.ant-btn-icon]:shrink-0";
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });

export default function VideoPage() {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeLogIdsRef = useRef<Set<string>>(new Set());
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const replaceAssets = useAssetStore((state) => state.replaceAssets);
    const assets = useAssetStore((state) => state.assets);
    const [prompt, setPrompt] = useState("");
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [videoReferences, setVideoReferences] = useState<ReferenceVideo[]>([]);
    const [audioReferences, setAudioReferences] = useState<ReferenceAudio[]>([]);
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [running, setRunning] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [configHydrated, setConfigHydrated] = useState(() => (typeof window === "undefined" ? false : (useConfigStore.persist?.hasHydrated?.() ?? true)));
    const [startedAt, setStartedAt] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [playerVideo, setPlayerVideo] = useState<GeneratedVideo | null>(null);
    const [referencePreview, setReferencePreview] = useState<ReferencePreview | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [resultDeleteTargets, setResultDeleteTargets] = useState<GenerationResult[]>([]);

    const model = effectiveConfig.videoModel || effectiveConfig.model;
    const canGenerate = Boolean(prompt.trim());
    const selectedResults = results.filter((result) => selectedResultIds.includes(result.id));
    const allResultsSelected = Boolean(results.length) && selectedResultIds.length === results.length;

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        const persistApi = useConfigStore.persist;
        if (!persistApi) {
            setConfigHydrated(true);
            return;
        }
        const unsubscribe = persistApi.onFinishHydration(() => setConfigHydrated(true));
        setConfigHydrated(persistApi.hasHydrated());
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!configHydrated) return;
        void refreshLogs({ resumePending: true });
    }, [configHydrated]);

    useEffect(() => {
        const handoff = consumeImageToVideoReferences();
        if (!handoff?.references.length) return;
        setReferences((value) => mergeReferenceImages(handoff.references, value).slice(0, SEEDANCE_REFERENCE_LIMITS.images));
        if (handoff.prompt) setPrompt((value) => (value.trim() ? value : handoff.prompt || value));
        message.success(`已带入 ${Math.min(handoff.references.length, SEEDANCE_REFERENCE_LIMITS.images)} 张参考图`);
    }, [message]);

    useEffect(() => {
        setSelectedResultIds((ids) => {
            if (!ids.length) return ids;
            const available = new Set(results.map((result) => result.id));
            const next = ids.filter((id) => available.has(id));
            return next.length === ids.length ? ids : next;
        });
    }, [results]);

    const addReferences = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        const unsupported = selectedFiles.filter((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/") && !isSupportedAudioFile(file));
        if (unsupported.length) message.warning("已忽略不支持的参考素材，请使用图片、mp4/mov 视频或 mp3/wav 音频");
        const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/") && file.size <= SEEDANCE_REFERENCE_LIMITS.imageMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.images - references.length);
        const videoFiles = selectedFiles.filter((file) => file.type.startsWith("video/") && file.size <= SEEDANCE_REFERENCE_LIMITS.videoMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.videos - videoReferences.length);
        const audioFiles = selectedFiles.filter((file) => isSupportedAudioFile(file) && file.size <= SEEDANCE_REFERENCE_LIMITS.audioMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.audios - audioReferences.length);
        if (selectedFiles.some((file) => file.type.startsWith("image/") && file.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes)) message.warning("已忽略超过 30MB 的参考图");
        if (selectedFiles.some((file) => file.type.startsWith("video/") && file.size > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes)) message.warning("已忽略超过 50MB 的参考视频");
        if (selectedFiles.some((file) => isSupportedAudioFile(file) && file.size > SEEDANCE_REFERENCE_LIMITS.audioMaxBytes)) message.warning("已忽略超过 15MB 的参考音频");
        const nextReferences = await Promise.all(
            imageFiles.map(async (file) => {
                const image = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }),
        );
        const nextVideoReferences = await Promise.all(
            videoFiles.map(async (file) => {
                const video = await uploadMediaFile(file, "video-reference");
                return { id: nanoid(), name: file.name, type: video.mimeType, url: video.url, storageKey: video.storageKey, bytes: video.bytes, width: video.width, height: video.height, durationMs: video.durationMs };
            }),
        );
        const nextAudioReferences = filterAudioReferencesByDuration(
            audioReferences,
            await Promise.all(
                audioFiles.map(async (file) => {
                    const audio = await uploadMediaFile(file, "audio-reference");
                    return { id: nanoid(), name: file.name, type: audio.mimeType, url: audio.url, storageKey: audio.storageKey, durationMs: audio.durationMs };
                }),
            ),
            message.warning,
        );
        setReferences((value) => [...value, ...nextReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.images));
        setVideoReferences((value) => [...value, ...nextVideoReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
        setAudioReferences((value) => [...value, ...nextAudioReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.audios));
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的图片");
                return;
            }
            const nextReferences = await Promise.all(
                blobs.slice(0, SEEDANCE_REFERENCE_LIMITS.images - references.length).map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.images));
            message.success(`已读取 ${nextReferences.length} 张参考图`);
        } catch {
            message.error("剪切板里没有可读取的图片");
        }
    };
    const generate = async () => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        const resultId = nanoid();
        setElapsedMs(0);
        setRunning(true);
        setPreviewLog(null);
        setSelectedResultIds([]);
        setResults((value) => [...value, { id: resultId, status: "pending" }]);
        const batchStartedAt = performance.now();
        setStartedAt((value) => value || batchStartedAt);
        try {
            const task = await createVideoGenerationTask(snapshot.config, snapshot.text, snapshot.references, snapshot.videoReferences, snapshot.audioReferences);
            const log = buildLog({ id: resultId, prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, videoReferences: snapshot.videoReferences, audioReferences: snapshot.audioReferences, durationMs: 0, status: "生成中", task });
            await saveLog(log);
            void pollGenerationLog(log, snapshot.config);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "生成失败";
            setResults((value) => updateVideoResultById(value, resultId, { status: "failed", error: errorMessage }));
            await saveLog(
                buildLog({
                    id: resultId,
                    prompt: snapshot.text,
                    model,
                    config: snapshot.config,
                    references: snapshot.references,
                    videoReferences: snapshot.videoReferences,
                    audioReferences: snapshot.audioReferences,
                    durationMs: performance.now() - batchStartedAt,
                    status: "失败",
                    error: errorMessage,
                }),
            );
            message.error(errorMessage);
            if (!activeLogIdsRef.current.size) setRunning(false);
        }
    };

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            message.error("请输入视频提示词");
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning("请先完成配置");
            openConfigDialog(true);
            return null;
        }
        const videoReferenceError = seedanceVideoReferenceError(videoReferences);
        if (videoReferenceError) {
            message.error(`${videoReferenceError}。${seedanceVideoReferenceHint}`);
            return null;
        }
        return { text, config: buildVideoConfig(effectiveConfig, model), references: [...references], videoReferences: [...videoReferences], audioReferences: [...audioReferences] };
    };

    const retryResult = async (resultId?: string) => {
        const findRecoverableLog = (items: GenerationLog[]) => items.find((log) => log.id === resultId && log.task) || null;
        let recoverableLog = resultId ? findRecoverableLog(logs) : previewLog?.task ? previewLog : null;
        if (resultId && !recoverableLog) recoverableLog = findRecoverableLog(await refreshLogs());
        if (recoverableLog?.task) {
            const task = recoverableLog.task;
            const recoveryLog = { ...recoverableLog, status: "生成中" as const, error: undefined };
            void pollGenerationLog(recoveryLog, buildVideoConfig(effectiveConfig, task.model || recoveryLog.model), { notify: true });
            return;
        }
        if (resultId) {
            message.warning("找不到可恢复的视频任务记录");
            return;
        }
        void generate();
    };

    const downloadVideo = (video: GeneratedVideo) => {
        saveAs(video.url, "video.mp4");
    };

    const saveResultToAssets = async (video: GeneratedVideo) => {
        const savedAsset = findGeneratedVideoAsset(video, assets);
        if (savedAsset) {
            replaceAssets(assets.filter((asset) => asset.id !== savedAsset.id));
            message.success("已取消加入素材");
            return;
        }
        const coverUrl = normalizeVideoThumbnail(video.thumbnail) || (await createVideoThumbnail(video.url));
        addAsset({
            kind: "video",
            title: "生成视频",
            coverUrl,
            tags: [],
            source: "视频创作台",
            data: { url: video.url, storageKey: video.storageKey, width: video.width, height: video.height, bytes: video.bytes, mimeType: video.mimeType },
            metadata: { source: "video-page", prompt, sourceResultId: video.id, sourceStorageKey: video.storageKey || "", sourceUrl: video.url || "", thumbnail: coverUrl, thumbnailVersion: VIDEO_THUMBNAIL_VERSION },
        });
        message.success("已加入我的素材");
    };

    const editResultVideo = (video: GeneratedVideo) => {
        const reference: ReferenceVideo = { id: nanoid(), name: "generated-video.mp4", type: video.mimeType || "video/mp4", url: video.url, storageKey: video.storageKey, bytes: video.bytes, width: video.width, height: video.height, durationMs: video.durationMs };
        const referenceKey = reference.storageKey || reference.url;
        setVideoReferences((value) => [reference, ...value.filter((item) => (item.storageKey || item.url) !== referenceKey)].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
        message.success("已进入视频编辑模式");
    };

    const deleteResult = async (result: GenerationResult) => {
        setResults((value) => value.filter((item) => item.id !== result.id));
        const storedLog = await logStore.getItem<GenerationLog>(result.id);
        const mediaKey = result.video?.storageKey || storedLog?.video?.storageKey;
        await recordDeletedSyncIds("video-workbench", [result.id]);
        if (mediaKey) await deleteStoredMedia([mediaKey]);
        await logStore.removeItem(result.id);
        if (previewLog?.id === result.id) setPreviewLog(null);
        await refreshLogs();
    };

    const requestDeleteResults = (targets: GenerationResult[]) => {
        if (!targets.length) return;
        setResultDeleteTargets(targets);
    };

    const confirmDeleteResults = async () => {
        const targets = resultDeleteTargets;
        const targetIds = new Set(targets.map((result) => result.id));
        setResultDeleteTargets([]);
        for (const result of targets) {
            await deleteResult(result);
        }
        setSelectedResultIds((ids) => ids.filter((id) => !targetIds.has(id)));
    };

    const toggleAllResults = () => {
        setSelectedResultIds(allResultsSelected ? [] : results.map((result) => result.id));
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, SEEDANCE_REFERENCE_LIMITS.images));
        } else if (payload.kind === "video") {
            setVideoReferences((value) => [...value, { id: nanoid(), name: payload.title, type: "video/mp4", url: payload.url, storageKey: payload.storageKey, width: payload.width, height: payload.height }].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
        }
        setAssetPickerOpen(false);
    };

    const createSession = () => {
        setPrompt("");
        setReferences([]);
        setVideoReferences([]);
        setAudioReferences([]);
        setResults([]);
        setElapsedMs(0);
        setStartedAt(0);
        setSelectedLogIds([]);
        setSelectedResultIds([]);
        setPreviewLog(null);
    };

    const deleteSelectedLogs = async () => {
        const ids = [...selectedLogIds];
        const mediaKeys = logs
            .filter((log) => ids.includes(log.id))
            .map((log) => log.video?.storageKey)
            .filter((key): key is string => Boolean(key));
        await recordDeletedSyncIds("video-workbench", ids);
        await Promise.all([deleteStoredMedia(mediaKeys), ...ids.map((id) => logStore.removeItem(id))]);
        if (previewLog && ids.includes(previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
        await refreshLogs();
    };

    const saveLog = async (log: GenerationLog) => {
        await logStore.setItem(log.id, serializeLog(log));
        await refreshLogs();
    };

    const refreshLogs = async (options: { resumePending?: boolean } = {}) => {
        const nextLogs = await readStoredLogs();
        setLogs(nextLogs);
        if (options.resumePending) resumePendingLogs(nextLogs);
        return nextLogs;
    };

    const resumePendingLogs = (items: GenerationLog[]) => {
        for (const log of items) {
            if (!log.task) continue;
            if (log.status === "生成中" || (log.status === "失败" && log.error === "请先配置 API Key")) void pollGenerationLog(log);
        }
    };

    const pollGenerationLog = async (log: GenerationLog, configOverride?: AiConfig, options: PollGenerationOptions = {}) => {
        if (!log.task) {
            if (options.notify) message.warning("找不到可恢复的视频任务记录");
            return;
        }
        if (activeLogIdsRef.current.has(log.id)) {
            if (options.notify) message.info("该视频任务正在恢复中");
            return;
        }
        const taskConfig = buildVideoConfig({ ...effectiveConfig, ...log.config }, log.task.model || log.model);
        const requestConfig = configOverride || taskConfig;
        if (!isAiConfigReady(requestConfig, log.task.model || log.model)) {
            if (options.notify) {
                message.warning("请先完成媒体 API Key 配置后再恢复结果");
                openConfigDialog(true);
            }
            return;
        }
        activeLogIdsRef.current.add(log.id);
        setRunning(true);
        setStartedAt((value) => value || performance.now());
        setResults((value) => (value.some((item) => item.id === log.id) ? value : [...value, { id: log.id, status: "pending" }]));
        try {
            const pollConfig = videoGenerationPollConfig(log.task);
            for (let attempt = 0; attempt < pollConfig.attempts; attempt += 1) {
                const state = await pollVideoGenerationTask(requestConfig, log.task);
                if (state.status === "completed") {
                    const stored = await storeGeneratedVideo(state.result, { apiKey: requestConfig.apiKey });
                    const thumbnail = await createVideoThumbnail(stored.url);
                    const nextVideo: GeneratedVideo = {
                        id: nanoid(),
                        url: stored.url,
                        storageKey: stored.storageKey,
                        thumbnail,
                        durationMs: Date.now() - log.createdAt,
                        width: stored.width || 1280,
                        height: stored.height || 720,
                        bytes: stored.bytes,
                        mimeType: stored.mimeType,
                    };
                    setResults((value) => updateVideoResultById(value, log.id, { status: "success", video: nextVideo, error: undefined }));
                    await saveLog({ ...log, status: "成功", durationMs: nextVideo.durationMs, video: nextVideo, error: undefined });
                    message.success("视频已生成");
                    return;
                }
                if (state.status === "failed") throw new Error(state.error);
                if (attempt === pollConfig.attempts - 1) throw new Error(pollConfig.timeoutMessage);
                await delay(pollConfig.delayMs);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "生成失败";
            setResults((value) => updateVideoResultById(value, log.id, { status: "failed", error: errorMessage, video: undefined }));
            await saveLog({ ...log, status: "失败", durationMs: Date.now() - log.createdAt, error: errorMessage });
            message.error(errorMessage);
        } finally {
            activeLogIdsRef.current.delete(log.id);
            if (!activeLogIdsRef.current.size) {
                setRunning(false);
                setStartedAt(0);
            }
        }
    };

    const previewGenerationLog = (log: GenerationLog) => {
        setPreviewLog(log);
        setSelectedResultIds([]);
        setLogsOpen(false);
        setPrompt(log.prompt);
        setReferences(log.references || []);
        setVideoReferences(log.videoReferences || []);
        setAudioReferences(log.audioReferences || []);
        if (log.config.videoModel || log.model) updateConfig("videoModel", log.config.videoModel || log.model);
        if (log.config.videoCallMode) updateConfig("videoCallMode", normalizeVideoCallMode(log.config.videoCallMode));
        if (log.config.size) updateConfig("size", log.config.size);
        if (log.config.vquality) updateConfig("vquality", log.config.vquality);
        if (log.config.videoSeconds) updateConfig("videoSeconds", log.config.videoSeconds);
        if (log.config.videoGenerateAudio) updateConfig("videoGenerateAudio", log.config.videoGenerateAudio);
        if (log.config.videoWatermark) updateConfig("videoWatermark", log.config.videoWatermark);
        setResults(log.status === "生成中" ? [{ id: log.id, status: "pending" }] : log.video ? [{ id: log.id, status: "success", video: log.video }] : [{ id: log.id, status: "failed", error: log.error || "生成失败" }]);
    };

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            <main className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[460px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[520px_minmax(0,1fr)]">
                <aside className="hidden h-full min-h-0 overflow-hidden rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:block">
                    <LogPanel
                        logs={logs}
                        selectedLogIds={selectedLogIds}
                        activeLogId={previewLog?.id}
                        onSelectedLogIdsChange={setSelectedLogIds}
                        onCreateSession={createSession}
                        onDeleteSelected={() => setDeleteConfirmOpen(true)}
                        onPreviewLog={previewGenerationLog}
                    />
                </aside>

                <section className="grid h-full min-h-0 gap-3 lg:overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
                    <div className="flex h-full min-h-0 flex-col rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800">
                        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                            <div className="flex items-start justify-between gap-3">
                                <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">视频创作台</h1>
                                <div className="flex shrink-0 gap-2 lg:hidden">
                                    <Button icon={<History className="size-4" />} onClick={() => setLogsOpen(true)}>
                                        记录
                                    </Button>
                                    <Button icon={<SlidersHorizontal className="size-4" />} onClick={() => setSettingsOpen(true)}>
                                        参数
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-6 space-y-5">
                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">提示词</span>
                                    <div className="flex gap-2">
                                        <Button size="small" icon={<BookOpen className="size-3.5" />} onClick={() => setPromptDialogOpen(true)}>
                                            查看提示词库
                                        </Button>
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => setAssetPickerOpen(true)}>
                                            查看我的素材
                                        </Button>
                                    </div>
                                </div>
                                <Input.TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} placeholder="描述镜头运动、主体动作、场景氛围和画面风格" />
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">参考图</span>
                                    <div className="flex gap-2">
                                        <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={() => void addReferencesFromClipboard()}>
                                            剪切板
                                        </Button>
                                        <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => fileInputRef.current?.click()}>
                                            上传
                                        </Button>
                                    </div>
                                </div>
                                <div className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700">
                                    {references.map((item, index) => (
                                        <div
                                            key={item.id}
                                            role="button"
                                            tabIndex={0}
                                            className="group relative size-20 shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-stone-200 outline-none transition focus-visible:ring-2 focus-visible:ring-primary dark:border-stone-800"
                                            aria-label={`查看${seedanceReferenceLabel("image", index)}`}
                                            onClick={() => setReferencePreview({ kind: "image", label: seedanceReferenceLabel("image", index), item })}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter" && event.key !== " ") return;
                                                event.preventDefault();
                                                setReferencePreview({ kind: "image", label: seedanceReferenceLabel("image", index), item });
                                            }}
                                        >
                                            <img src={item.dataUrl} alt={item.name} className="size-full object-cover" />
                                            <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/15 group-hover:opacity-100 group-focus-visible:bg-black/15 group-focus-visible:opacity-100">
                                                <span className="grid size-8 place-items-center rounded-full bg-white/90 text-stone-950 shadow-sm">
                                                    <Maximize2 className="size-4" />
                                                </span>
                                            </span>
                                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{seedanceReferenceLabel("image", index)}</span>
                                            <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => setReferences((value) => moveListItem(value, index, offset))} />
                                            <button
                                                type="button"
                                                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded bg-black/65 text-white shadow-sm transition hover:bg-[#ff4d4f] active:bg-[#d9363e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setReferences((value) => value.filter((ref) => ref.id !== item.id));
                                                }}
                                                aria-label="移除参考图"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {!references.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考图，最多 5 张，PNG/JPG，单张 30MB 内</div> : null}
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">参考视频</span>
                                    <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => fileInputRef.current?.click()}>
                                        上传
                                    </Button>
                                </div>
                                <div className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700">
                                    {videoReferences.map((item, index) => (
                                        <div
                                            key={item.id}
                                            role="button"
                                            tabIndex={0}
                                            className="group relative h-20 w-32 shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-stone-200 bg-black outline-none transition focus-visible:ring-2 focus-visible:ring-primary dark:border-stone-800"
                                            aria-label={`查看${seedanceReferenceLabel("video", index)}`}
                                            onClick={() => setReferencePreview({ kind: "video", label: seedanceReferenceLabel("video", index), item })}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter" && event.key !== " ") return;
                                                event.preventDefault();
                                                setReferencePreview({ kind: "video", label: seedanceReferenceLabel("video", index), item });
                                            }}
                                        >
                                            <video src={item.url} className="size-full object-cover" muted preload="metadata" />
                                            <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100 group-focus-visible:bg-black/20 group-focus-visible:opacity-100">
                                                <span className="grid size-8 place-items-center rounded-full bg-white/90 text-stone-950 shadow-sm">
                                                    <Play className="ml-0.5 size-4 fill-current" />
                                                </span>
                                            </span>
                                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{seedanceReferenceLabel("video", index)}</span>
                                            <ReferenceOrderButtons index={index} total={videoReferences.length} onMove={(offset) => setVideoReferences((value) => moveListItem(value, index, offset))} />
                                            <button
                                                type="button"
                                                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded bg-black/65 text-white shadow-sm transition hover:bg-[#ff4d4f] active:bg-[#d9363e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setVideoReferences((value) => value.filter((ref) => ref.id !== item.id));
                                                }}
                                                aria-label="移除参考视频"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {!videoReferences.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考视频，最多 3 个，MP4/MOV，单个 50MB 内</div> : null}
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">参考音频</span>
                                    <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => fileInputRef.current?.click()}>
                                        上传
                                    </Button>
                                </div>
                                <div className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700">
                                    {audioReferences.map((item, index) => (
                                        <div key={item.id} className="group relative flex h-20 w-48 shrink-0 flex-col justify-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2 dark:border-stone-800 dark:bg-stone-900">
                                            <div className="flex min-w-0 items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                                                <Music2 className="size-4 shrink-0" />
                                                <span className="shrink-0 rounded bg-stone-200 px-1 text-[10px] text-stone-700 dark:bg-stone-800 dark:text-stone-200">{seedanceReferenceLabel("audio", index)}</span>
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                            <audio src={item.url} controls className="h-8 w-full" preload="metadata" />
                                            <ReferenceOrderButtons index={index} total={audioReferences.length} onMove={(offset) => setAudioReferences((value) => moveListItem(value, index, offset))} />
                                            <button
                                                type="button"
                                                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded bg-black/65 text-white shadow-sm transition hover:bg-[#ff4d4f] active:bg-[#d9363e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                                                onClick={() => setAudioReferences((value) => value.filter((ref) => ref.id !== item.id))}
                                                aria-label="移除参考音频"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {!audioReferences.length ? <div className="flex min-w-full items-center justify-center text-center text-sm text-stone-500">暂无参考音频，最多 3 个，mp3/wav，单个 15MB 内</div> : null}
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900 sm:hidden">
                                <span className="truncate text-stone-500 dark:text-stone-400">
                                    {modelOptionLabel(effectiveConfig, model)} · {videoModeLabel(effectiveConfig.videoCallMode)} · {videoResolutionLabel(effectiveConfig.vquality, model)} · {videoSizeLabel(effectiveConfig.size, model)} · {normalizeVideoSeconds(effectiveConfig.videoSeconds)}s
                                </span>
                                <Button size="small" type="text" icon={<SlidersHorizontal className="size-4" />} onClick={() => setSettingsOpen(true)}>
                                    调整
                                </Button>
                            </div>

                            <div className="hidden gap-4 sm:grid sm:grid-cols-2">
                                <GenerationSettings config={effectiveConfig} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
                            </div>
                            </div>

                        </div>

                        <div className="shrink-0 border-t border-stone-200 pt-3 dark:border-stone-800">
                            <Button type="primary" size="large" block icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={() => void generate()}>
                                开始生成
                            </Button>
                        </div>
                    </div>

                    <div className="thin-scrollbar h-full min-h-0 rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:overflow-y-auto lg:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-xl font-semibold">生成结果</h2>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {results.length ? (
                                    <>
                                        <Button size="small" icon={<CheckSquare className="size-3.5" />} onClick={toggleAllResults}>
                                            {allResultsSelected ? "取消" : "全选"}
                                        </Button>
                                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedResults.length} onClick={() => requestDeleteResults(selectedResults)}>
                                            删除选中
                                        </Button>
                                    </>
                                ) : null}
                                {running ? (
                                    <HistoryPill tone="pending" label="生成中">
                                        {formatDuration(elapsedMs)}
                                        {activeLogIdsRef.current.size > 1 ? ` · ${activeLogIdsRef.current.size} 个任务` : ""}
                                    </HistoryPill>
                                ) : null}
                            </div>
                        </div>
                        {results.length ? (
                            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                                {results.map((result) =>
                                    result.status === "success" && result.video ? (
                                        <ResultVideoCard key={result.id} video={result.video} selected={selectedResultIds.includes(result.id)} savedToAsset={Boolean(findGeneratedVideoAsset(result.video, assets))} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} onPlay={() => setPlayerVideo(result.video || null)} onEdit={editResultVideo} onDownload={downloadVideo} onSaveAsset={saveResultToAssets} onDelete={() => requestDeleteResults([result])} />
                                    ) : result.status === "failed" ? (
                                        <FailedVideoCard key={result.id} error={result.error || "生成失败"} selected={selectedResultIds.includes(result.id)} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} retryLabel={logs.some((log) => log.id === result.id && log.task) ? "恢复结果" : "重试"} onRetry={() => retryResult(result.id)} onDelete={() => requestDeleteResults([result])} />
                                    ) : (
                                        <PendingVideoCard key={result.id} selected={selectedResultIds.includes(result.id)} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} />
                                    ),
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-center dark:border-stone-700 lg:min-h-[560px]">
                                <VideoIcon className="mb-4 size-11 text-stone-400" />
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有生成视频" />
                            </div>
                        )}
                    </div>
                </section>
            </main>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <Drawer title="生成记录" placement="bottom" size="large" open={logsOpen} onClose={() => setLogsOpen(false)} extra={<Button size="small" onClick={() => setLogsOpen(false)}>关闭</Button>}>
                <LogPanel
                    logs={logs}
                    selectedLogIds={selectedLogIds}
                    activeLogId={previewLog?.id}
                    onSelectedLogIdsChange={setSelectedLogIds}
                    onCreateSession={createSession}
                    onDeleteSelected={() => setDeleteConfirmOpen(true)}
                    onPreviewLog={previewGenerationLog}
                />
            </Drawer>
            <Drawer title="参数" placement="bottom" size="82vh" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <div className="grid grid-cols-2 gap-3 pb-4">
                    <GenerationSettings config={effectiveConfig} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
                </div>
            </Drawer>
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <VideoPlayerModal video={playerVideo} onClose={() => setPlayerVideo(null)} onDownload={downloadVideo} />
            <ReferencePreviewModal preview={referencePreview} onClose={() => setReferencePreview(null)} />
            <Modal title="删除生成结果" open={Boolean(resultDeleteTargets.length)} onCancel={() => setResultDeleteTargets([])} onOk={() => void confirmDeleteResults()} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {resultDeleteTargets.length} 个生成结果吗？成功视频会同步删除本地媒体文件。
            </Modal>
            <Modal title="删除生成记录" open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={() => void deleteSelectedLogs()} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {selectedLogIds.length} 条生成记录吗？
            </Modal>
        </div>
    );
}

function GenerationSettings({ config, model, updateConfig, openConfigDialog }: { config: AiConfig; model: string; updateConfig: UpdateAiConfig; openConfigDialog: (shouldPromptContinue?: boolean) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <>
            <label className="col-span-2 block min-w-0 sm:col-span-1">
                <span className="mb-1.5 block text-sm font-semibold sm:mb-2 sm:text-base">模型</span>
                <ModelPicker config={config} value={model} onChange={(value) => updateConfig("videoModel", value)} capability="video" fullWidth onMissingConfig={() => openConfigDialog(false)} />
            </label>
            <div className="col-span-2">
                <VideoSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-4" />
            </div>
        </>
    );
}

type HistoryPillTone = "neutral" | "success" | "danger" | "pending" | "info";

const HISTORY_PILL_TONE_CLASSES: Record<HistoryPillTone, string> = {
    neutral: "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-900/70 dark:text-stone-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200",
    danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200",
    pending: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200",
    info: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/30 dark:text-indigo-200",
};

function HistoryPill({ label, tone = "neutral", children, className = "" }: { label?: string; tone?: HistoryPillTone; children: ReactNode; className?: string }) {
    return (
        <span className={`inline-flex h-6 max-w-full items-center gap-1 overflow-hidden rounded-full border px-2 text-[11px] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ${HISTORY_PILL_TONE_CLASSES[tone]} ${className}`}>
            {label ? <span className="shrink-0 font-medium opacity-65">{label}</span> : null}
            <span className="min-w-0 truncate font-semibold">{children}</span>
        </span>
    );
}

function ResultVideoCard({ video, selected, savedToAsset, onSelectedChange, onPlay, onEdit, onDownload, onSaveAsset, onDelete }: { video: GeneratedVideo; selected: boolean; savedToAsset: boolean; onSelectedChange: (checked: boolean) => void; onPlay: () => void; onEdit: (video: GeneratedVideo) => void; onDownload: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void | Promise<void>; onDelete: () => void }) {
    return (
        <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <SelectionBubble className="absolute right-3 top-3 z-20" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成结果" />
            <button type="button" className="group relative block aspect-video w-full overflow-hidden bg-black text-left" onClick={onPlay} aria-label="播放视频">
                <video src={video.url} poster={video.thumbnail || undefined} className="size-full object-cover" muted playsInline preload="metadata" />
                <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                <span className="absolute left-3 top-3 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{videoRatioLabel(video)}</span>
                <span className="absolute left-3 top-9 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">
                    {video.width}×{video.height}
                </span>
                <span className="absolute inset-0 grid place-items-center">
                    <span className="grid size-12 place-items-center rounded-full bg-white/92 text-stone-950 shadow-lg transition group-hover:scale-105">
                        <Play className="ml-0.5 size-5 fill-current" />
                    </span>
                </span>
            </button>
            <div className="space-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>{videoRatioLabel(video)}</span>
                    <span>{formatBytes(video.bytes)}</span>
                    <span>{formatDuration(video.durationMs)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<PenLine className="size-3.5" />} onClick={() => onEdit(video)}>
                        编辑
                    </Button>
                    <Button className={`${RESULT_ACTION_BUTTON_CLASS} ${savedToAsset ? "!border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!border-emerald-300 hover:!bg-emerald-100 dark:!border-emerald-900 dark:!bg-emerald-950/35 dark:!text-emerald-300" : ""}`} size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => void onSaveAsset(video)}>
                        素材
                    </Button>
                    <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)}>
                        下载
                    </Button>
                    <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                        删除
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PendingVideoCard({ selected, onSelectedChange }: { selected: boolean; onSelectedChange: (checked: boolean) => void }) {
    return (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成结果" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <LoaderCircle className="size-6 animate-spin" />
                <span>生成中</span>
            </div>
        </div>
    );
}

function FailedVideoCard({ error, selected, retryLabel = "重试", onSelectedChange, onRetry, onDelete }: { error: string; selected: boolean; retryLabel?: string; onSelectedChange: (checked: boolean) => void; onRetry: () => void; onDelete: () => void }) {
    return (
        <div className="relative overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成结果" />
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end gap-2 border-t border-red-200 p-3 dark:border-red-950">
                <Button size="small" onClick={() => onRetry()}>
                    {retryLabel}
                </Button>
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                    删除
                </Button>
            </div>
        </div>
    );
}

function findGeneratedVideoAsset(video: GeneratedVideo, assets: Asset[]) {
    return assets.find((asset) => {
        if (asset.kind !== "video") return false;
        if (assetMetadataString(asset, "sourceResultId") === video.id) return true;
        const sourceStorageKey = assetMetadataString(asset, "sourceStorageKey");
        const sourceUrl = assetMetadataString(asset, "sourceUrl");
        if (video.storageKey && (asset.data.storageKey === video.storageKey || sourceStorageKey === video.storageKey)) return true;
        return Boolean(video.url && (asset.data.url === video.url || sourceUrl === video.url));
    });
}

function assetMetadataString(asset: Asset, key: string) {
    const value = asset.metadata?.[key];
    return typeof value === "string" ? value : "";
}

function VideoPlayerModal({ video, onClose, onDownload }: { video: GeneratedVideo | null; onClose: () => void; onDownload: (video: GeneratedVideo) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);

    useEffect(() => {
        setPlaying(false);
        setMuted(false);
    }, [video?.id]);

    const togglePlay = async () => {
        const node = videoRef.current;
        if (!node) return;
        if (node.paused) {
            await node.play().catch(() => {});
            setPlaying(!node.paused);
        } else {
            node.pause();
            setPlaying(false);
        }
    };

    const restart = async () => {
        const node = videoRef.current;
        if (!node) return;
        node.currentTime = 0;
        await node.play().catch(() => {});
        setPlaying(!node.paused);
    };

    const toggleMute = () => {
        const node = videoRef.current;
        if (!node) return;
        node.muted = !node.muted;
        setMuted(node.muted);
    };

    const fullscreen = async () => {
        const node = videoRef.current;
        await node?.requestFullscreen?.().catch(() => {});
    };

    return (
        <Modal title="视频播放" open={Boolean(video)} width={960} centered onCancel={onClose} footer={null} destroyOnHidden>
            {video ? (
                <div className="space-y-3">
                    <div className="overflow-hidden rounded-lg bg-black">
                        <video
                            ref={videoRef}
                            src={video.url}
                            className="max-h-[72vh] w-full bg-black object-contain"
                            controls
                            autoPlay
                            playsInline
                            onPlay={() => setPlaying(true)}
                            onPause={() => setPlaying(false)}
                            onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap gap-1 text-xs text-stone-500 dark:text-stone-400">
                            <HistoryPill label="比例">{videoRatioLabel(video)}</HistoryPill>
                            <HistoryPill label="尺寸">
                                {video.width}×{video.height}
                            </HistoryPill>
                            <HistoryPill label="大小">{formatBytes(video.bytes)}</HistoryPill>
                            <HistoryPill label="耗时">{formatDuration(video.durationMs)}</HistoryPill>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button size="small" icon={playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} onClick={() => void togglePlay()}>
                                {playing ? "暂停" : "播放"}
                            </Button>
                            <Button size="small" icon={<RotateCcw className="size-3.5" />} onClick={() => void restart()}>
                                重播
                            </Button>
                            <Button size="small" icon={muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />} onClick={toggleMute}>
                                {muted ? "取消静音" : "静音"}
                            </Button>
                            <Button size="small" icon={<Maximize2 className="size-3.5" />} onClick={() => void fullscreen()}>
                                全屏
                            </Button>
                            <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)}>
                                下载
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}

function ReferencePreviewModal({ preview, onClose }: { preview: ReferencePreview | null; onClose: () => void }) {
    return (
        <Modal title={preview ? preview.label : "参考素材"} open={Boolean(preview)} width={preview?.kind === "image" ? 860 : 960} centered onCancel={onClose} footer={null} destroyOnHidden>
            {preview?.kind === "image" ? (
                <div className="overflow-hidden rounded-lg bg-black">
                    <img src={preview.item.dataUrl} alt={preview.item.name} className="max-h-[76vh] w-full object-contain" />
                </div>
            ) : preview?.kind === "video" ? (
                <div className="overflow-hidden rounded-lg bg-black">
                    <video src={preview.item.url} className="max-h-[76vh] w-full bg-black object-contain" controls autoPlay playsInline />
                </div>
            ) : null}
        </Modal>
    );
}

function LogPanel({
    logs,
    selectedLogIds,
    activeLogId,
    onSelectedLogIdsChange,
    onCreateSession,
    onDeleteSelected,
    onPreviewLog,
}: {
    logs: GenerationLog[];
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onDeleteSelected: () => void;
    onPreviewLog: (log: GenerationLog) => void;
}) {
    const allSelected = Boolean(logs.length) && selectedLogIds.length === logs.length;
    const [visibleCount, setVisibleCount] = useState(INITIAL_LOG_VISIBLE_COUNT);
    const visibleLogs = logs.slice(0, visibleCount);
    const hiddenCount = Math.max(0, logs.length - visibleLogs.length);
    const toggleAll = () => onSelectedLogIdsChange(allSelected ? [] : logs.map((log) => log.id));

    useEffect(() => {
        setVisibleCount(INITIAL_LOG_VISIBLE_COUNT);
    }, [logs.length]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">生成记录</h2>
                    <HistoryPill>{logs.length}</HistoryPill>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                    <Button size="small" icon={<Plus className="size-3.5" />} onClick={onCreateSession}>
                        新建
                    </Button>
                    <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!logs.length} onClick={toggleAll}>
                        {allSelected ? "取消" : "全选"}
                    </Button>
                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedLogIds.length} onClick={onDeleteSelected}>
                        删除
                    </Button>
                </div>
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                {logs.length ? <div className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">历史记录</div> : null}
                <div className="space-y-3">
                    {visibleLogs.map((log) => (
                        <LogCard
                            key={log.id}
                            log={log}
                            selected={selectedLogIds.includes(log.id)}
                            active={activeLogId === log.id}
                            onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))}
                            onClick={() => onPreviewLog(log)}
                        />
                    ))}
                    {hiddenCount ? (
                        <Button block size="small" onClick={() => setVisibleCount((value) => value + LOG_VISIBLE_BATCH_SIZE)}>
                            加载更多 {hiddenCount}
                        </Button>
                    ) : null}
                    {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">暂无生成记录</div> : null}
                </div>
            </div>
        </div>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void }) {
    const displayTitle = compactLogTitle(log.prompt || log.title || log.model || "");
    const promptPreview = log.prompt || log.title || "";
    const sizeLabel = videoSizeLabel(log.config.size || log.size, log.model);
    const resolutionLabel = videoResolutionBadge(log.config.vquality || log.resolution);
    const secondsLabel = videoSecondsBadge(log.config.videoSeconds || log.seconds);
    const statusTone = log.status === "成功" ? "success" : log.status === "生成中" ? "pending" : "danger";

    return (
        <div
            role="button"
            tabIndex={0}
            className={`relative block w-full cursor-pointer rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onClick();
            }}
            title={promptPreview}
        >
            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成记录" />
            <div className="space-y-3">
                <LogVideoCover logId={log.id} video={log.video} status={log.status} sizeLabel={sizeLabel} resolutionLabel={resolutionLabel} />
                <div className="min-w-0 pr-9">
                    <div className="line-clamp-2 text-base font-medium leading-6">{displayTitle}</div>
                    <div className="mt-1 line-clamp-3 text-sm leading-5 text-stone-500 dark:text-stone-400">{promptPreview}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                    <HistoryPill label="模型" className="max-w-full">
                        {log.model || "默认"}
                    </HistoryPill>
                    <HistoryPill label="模式">{videoModeLabel(log.config.videoCallMode)}</HistoryPill>
                    <HistoryPill label="比例">{sizeLabel}</HistoryPill>
                    <HistoryPill label="清晰度">{resolutionLabel}</HistoryPill>
                </div>
                <div className="flex flex-wrap gap-1">
                    <HistoryPill label="请求">1</HistoryPill>
                    {log.status === "成功" && log.video ? <HistoryPill tone="success" label="成功">1</HistoryPill> : null}
                    {log.status === "生成中" ? <HistoryPill tone="pending" label="生成中">1</HistoryPill> : null}
                    {log.status === "失败" ? <HistoryPill tone="danger" label="失败">1</HistoryPill> : null}
                    <HistoryPill tone={statusTone} label="状态">
                        {log.status}
                    </HistoryPill>
                    <HistoryPill tone="info" label="耗时">
                        {formatDuration(log.durationMs)}
                    </HistoryPill>
                    <HistoryPill label="时长">{secondsLabel}</HistoryPill>
                    <HistoryPill label="时间">{log.time}</HistoryPill>
                </div>
            </div>
        </div>
    );
}

function LogVideoCover({ logId, video, status, sizeLabel, resolutionLabel }: { logId: string; video?: GeneratedVideo; status: GenerationLog["status"]; sizeLabel: string; resolutionLabel: string }) {
    const [thumbnail, setThumbnail] = useState(normalizeVideoThumbnail(video?.thumbnail));
    const [failed, setFailed] = useState(false);
    const coverRef = useRef<HTMLSpanElement>(null);
    const refreshedLowQualityThumbnailRef = useRef(false);
    const canLoadPreview = Boolean(video?.url);

    useEffect(() => {
        setThumbnail(normalizeVideoThumbnail(video?.thumbnail));
        setFailed(false);
        refreshedLowQualityThumbnailRef.current = false;
    }, [logId, video?.id, video?.thumbnail]);

    useEffect(() => {
        if (thumbnail || failed || !video?.url) return;
        let cancelled = false;
        let idleId = 0;
        let timerId: ReturnType<typeof globalThis.setTimeout> | null = null;
        let observer: IntersectionObserver | null = null;
        const run = () => {
            const load = async () => {
                const nextThumbnail = await createVideoThumbnail(video.url);
                if (cancelled) return;
                if (!nextThumbnail) {
                    setFailed(true);
                    return;
                }
                setThumbnail(nextThumbnail);
                void cacheVideoThumbnail(logId, nextThumbnail);
            };
            if ("requestIdleCallback" in window) {
                idleId = window.requestIdleCallback(() => void load(), { timeout: 1600 });
            } else {
                timerId = globalThis.setTimeout(() => void load(), 120);
            }
        };
        const node = coverRef.current;
        if (node && "IntersectionObserver" in window) {
            observer = new IntersectionObserver(
                ([entry]) => {
                    if (!entry?.isIntersecting) return;
                    observer?.disconnect();
                    run();
                },
                { rootMargin: "180px" },
            );
            observer.observe(node);
        } else {
            run();
        }
        return () => {
            cancelled = true;
            observer?.disconnect();
            if (idleId) window.cancelIdleCallback(idleId);
            if (timerId) globalThis.clearTimeout(timerId);
        };
    }, [failed, logId, thumbnail, video?.url]);

    return (
        <span
            ref={coverRef}
            className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-md border border-stone-200 bg-stone-100 text-stone-400 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-500"
            style={thumbnail ? undefined : { backgroundImage: "linear-gradient(135deg, rgba(20,184,166,.14), rgba(99,102,241,.10))" }}
        >
            {thumbnail ? (
                <img
                    src={thumbnail}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onLoad={(event) => {
                        const image = event.currentTarget;
                        if (!video?.url || refreshedLowQualityThumbnailRef.current) return;
                        if (Math.max(image.naturalWidth, image.naturalHeight) >= VIDEO_LOG_THUMBNAIL_MIN_RENDER_EDGE) return;
                        refreshedLowQualityThumbnailRef.current = true;
                        setThumbnail("");
                        setFailed(false);
                    }}
                    onError={() => {
                        setThumbnail("");
                        setFailed(true);
                    }}
                />
            ) : status === "生成中" ? (
                <LoaderCircle className="size-7 animate-spin opacity-60" />
            ) : canLoadPreview ? (
                <LogVideoInlinePreview url={video?.url || ""} />
            ) : (
                <VideoIcon className="size-7 opacity-75" />
            )}
            <span className="absolute left-2 top-2 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{sizeLabel}</span>
            <span className="absolute left-2 top-8 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{resolutionLabel}</span>
        </span>
    );
}

function LogVideoInlinePreview({ url }: { url: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const node = videoRef.current;
        if (!node) return;
        const seekPreviewFrame = () => {
            try {
                if (Number.isFinite(node.duration) && node.duration > 0.8 && node.currentTime < 0.2) node.currentTime = Math.min(0.65, node.duration / 4);
            } catch {}
        };
        node.addEventListener("loadedmetadata", seekPreviewFrame);
        node.addEventListener("loadeddata", seekPreviewFrame);
        node.addEventListener("canplay", seekPreviewFrame);
        return () => {
            node.removeEventListener("loadedmetadata", seekPreviewFrame);
            node.removeEventListener("loadeddata", seekPreviewFrame);
            node.removeEventListener("canplay", seekPreviewFrame);
            node.pause();
        };
    }, [url]);

    return <video ref={videoRef} src={url} className="size-full object-cover" muted playsInline preload="metadata" />;
}

async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const logs: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            logs.push(value);
        });
        return (await Promise.all(logs.map(normalizeLog))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

async function normalizeLog(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const video = log.video ? { ...log.video, url: log.video.storageKey ? await resolveMediaUrl(log.video.storageKey, log.video.url) : log.video.url, thumbnail: normalizeVideoThumbnail(log.video.thumbnail) } : log.video;
    const videoReferences = await Promise.all(
        (log.videoReferences || []).map(async (item) => ({
            ...item,
            url: item.storageKey ? await resolveMediaUrl(item.storageKey, item.url) : item.url,
        })),
    );
    const audioReferences = await Promise.all(
        (log.audioReferences || []).map(async (item) => ({
            ...item,
            url: item.storageKey ? await resolveMediaUrl(item.storageKey, item.url) : item.url,
        })),
    );
    const references = await Promise.all(
        (log.references || []).map(async (item) => ({
            ...item,
            dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
        })),
    );
    const config = normalizeLogConfig(log);
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || "未命名",
        prompt: log.prompt || "",
        time: log.time || new Date().toLocaleString("zh-CN", { hour12: false }),
        model: log.model || config.videoModel || "",
        config,
        references,
        videoReferences,
        audioReferences,
        durationMs: log.durationMs || 0,
        size: log.size || config.size || "",
        resolution: normalizeResolution(log.resolution || config.vquality || ""),
        seconds: log.seconds || config.videoSeconds || "",
        status: log.status || "成功",
        task: log.task,
        video,
        error: log.error,
    };
}

function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        videoReferences: log.videoReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        audioReferences: log.audioReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        video: log.video?.storageKey ? { ...log.video, url: "" } : log.video,
    };
}

function isSupportedAudioFile(file: File) {
    return file.type === "audio/mpeg" || file.type === "audio/mp3" || file.type === "audio/wav" || file.type === "audio/x-wav" || /\.(mp3|wav)$/i.test(file.name);
}

function filterAudioReferencesByDuration(existing: ReferenceAudio[], next: ReferenceAudio[], warn: (content: string) => void) {
    let total = existing.reduce((sum, item) => sum + (item.durationMs || 0), 0);
    const accepted: ReferenceAudio[] = [];
    let skipped = false;
    for (const item of next) {
        if (item.durationMs && (item.durationMs < 2000 || item.durationMs > 15000)) {
            skipped = true;
            continue;
        }
        if (item.durationMs && total + item.durationMs > 15000) {
            skipped = true;
            continue;
        }
        total += item.durationMs || 0;
        accepted.push(item);
    }
    if (skipped) warn("已忽略不符合时长要求的参考音频：单个 2-15 秒，总时长不超过 15 秒");
    return accepted;
}

function moveListItem<T>(items: T[], index: number, offset: number) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
}

function mergeReferenceImages(primary: ReferenceImage[], secondary: ReferenceImage[]) {
    const seen = new Set<string>();
    return [...primary, ...secondary].filter((item) => {
        const key = item.storageKey || item.dataUrl || item.url || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function ReferenceOrderButtons({ index, total, onMove }: { index: number; total: number; onMove: (offset: number) => void }) {
    if (total <= 1) return null;
    return (
        <div className="absolute inset-x-1 bottom-1 flex justify-between">
            <Button
                size="small"
                className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm"
                icon={<ArrowLeft className="size-3" />}
                disabled={index <= 0}
                onClick={(event) => {
                    event.stopPropagation();
                    onMove(-1);
                }}
            />
            <Button
                size="small"
                className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm"
                icon={<ArrowRight className="size-3" />}
                disabled={index >= total - 1}
                onClick={(event) => {
                    event.stopPropagation();
                    onMove(1);
                }}
            />
        </div>
    );
}

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        videoModel: log.config?.videoModel || log.model || "",
        videoCallMode: normalizeVideoCallMode(log.config?.videoCallMode),
        size: log.config?.size || log.size || "",
        vquality: normalizeResolution(log.config?.vquality || log.resolution || ""),
        videoSeconds: log.config?.videoSeconds || log.seconds || "",
        videoGenerateAudio: log.config?.videoGenerateAudio || "true",
        videoWatermark: log.config?.videoWatermark || "false",
    };
}

function buildLog({
    id,
    prompt,
    model,
    config,
    references,
    videoReferences,
    audioReferences,
    durationMs,
    status,
    task,
    video,
    error,
}: {
    id?: string;
    prompt: string;
    model: string;
    config: AiConfig;
    references: ReferenceImage[];
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    durationMs: number;
    status: GenerationLog["status"];
    task?: VideoGenerationTask;
    video?: GeneratedVideo;
    error?: string;
}): GenerationLog {
    const logConfig = {
        model: config.model,
        videoModel: config.videoModel,
        videoCallMode: normalizeVideoCallMode(config.videoCallMode),
        size: config.size,
        vquality: normalizeResolution(config.vquality),
        videoSeconds: config.videoSeconds,
        videoGenerateAudio: config.videoGenerateAudio,
        videoWatermark: config.videoWatermark,
    };
    return {
        id: id || nanoid(),
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || "未命名",
        prompt,
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        model,
        config: logConfig,
        references,
        videoReferences,
        audioReferences,
        durationMs,
        size: logConfig.size,
        resolution: logConfig.vquality,
        seconds: logConfig.videoSeconds,
        status,
        task,
        video,
        error,
    };
}

function buildVideoConfig(config: AiConfig, model: string): AiConfig {
    const seedance = isSeedanceVideoConfig({ ...config, model });
    return {
        ...config,
        model,
        videoModel: model,
        videoCallMode: normalizeVideoCallMode(config.videoCallMode),
        size: seedance ? normalizeSeedanceRatio(config.size) : normalizeVideoSize(config.size),
        videoSeconds: normalizeVideoSeconds(config.videoSeconds),
        vquality: normalizeResolution(config.vquality),
        videoGenerateAudio: String(boolConfig(config.videoGenerateAudio, true)),
        videoWatermark: String(boolConfig(config.videoWatermark, false)),
    };
}

function normalizeVideoSeconds(value: string) {
    if (String(value).trim() === "-1") return "-1";
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(20, seconds)));
}

function videoSecondsBadge(value: string) {
    const seconds = normalizeVideoSeconds(value);
    return seconds === "-1" ? "智能" : `${seconds}s`;
}

function videoResolutionBadge(value: string) {
    return `${normalizeResolution(value)}p`;
}

function videoRatioLabel(video: Pick<GeneratedVideo, "width" | "height">) {
    const width = Math.round(video.width || 0);
    const height = Math.round(video.height || 0);
    if (!width || !height) return "视频";
    const divisor = greatestCommonDivisor(width, height);
    return `${width / divisor}:${height / divisor}`;
}

async function cacheVideoThumbnail(logId: string, thumbnail: string) {
    const normalized = normalizeVideoThumbnail(thumbnail);
    if (!normalized) return;
    try {
        const log = await logStore.getItem<GenerationLog>(logId);
        if (!log?.video) return;
        await logStore.setItem(logId, { ...log, video: { ...log.video, thumbnail: normalized } });
    } catch {}
}

function greatestCommonDivisor(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
        [x, y] = [y, x % y];
    }
    return x || 1;
}

function updateVideoResultById(results: GenerationResult[], id: string, next: Partial<GenerationResult>) {
    return results.map((item) => (item.id === id ? { ...item, ...next } : item));
}

function videoModeLabel(value: AiConfig["videoCallMode"] | undefined) {
    return normalizeVideoCallMode(value) === "async" ? "异步·4倍扣费" : "同步";
}

function normalizeVideoSize(value: string) {
    return normalizeVideoSizeValue(value);
}

function normalizeResolution(value: string) {
    return normalizeVideoResolutionValue(value);
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactLogTitle(value: string) {
    const text = value.replace(/\s+/g, " ").replace(/^[,.;:，。；：、\s]+/, "").trim();
    if (!text) return "未命名";
    const sentence = text.split(/[。！？!?]/, 1)[0]?.trim() || text;
    if (sentence.length <= 30) return sentence;
    return `${sentence.slice(0, 30)}…`;
}
