"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, ChevronDown, ClipboardPaste, Download, FolderPlus, History, LoaderCircle, Maximize2, Music2, Pause, PenLine, Pin, Play, Plus, RotateCcw, Search, Sparkles, Trash2, Upload, VideoIcon, Volume2, VolumeX, X } from "lucide-react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { App, Button, Drawer, Empty, Input, Modal, Tooltip, Typography } from "antd";
import localforage from "localforage";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";

import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { ModelPicker } from "@/components/model-picker";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { SelectionBubble } from "@/components/selection-bubble";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { normalizeVideoResolutionValue, normalizeVideoSizeValue, videoResolutionLabel, videoSizeLabel } from "@/components/video-settings-panel";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { boolConfig, isSeedanceFastModel, isSeedanceVideoConfig, normalizeSeedanceDuration, normalizeSeedanceRatio, normalizeSeedanceResolution, seedanceDurationOptions, seedanceRatioOptions, seedanceReferenceLabel, seedanceResolutionOptions, seedanceVideoReferenceError, seedanceVideoReferenceHint, SEEDANCE_REFERENCE_LIMITS } from "@/lib/seedance-video";
import { normalizeRelayBasesVideoDuration, relayBasesVideoTiming } from "@/lib/relaybases-video";
import { matchesWorkbenchPromptSearch, sortWorkbenchHistoryItems } from "@/lib/workbench-history-search";
import { createVideoThumbnail, normalizeVideoThumbnail, VIDEO_THUMBNAIL_VERSION } from "@/lib/video-thumbnail";
import { createZip } from "@/lib/zip";
import { fileExtensionFromMime, notifyWorkbenchTask, safeArchiveName, shouldSubmitPrompt, timestampForFileName } from "@/lib/workbench-preferences";
import { recordDeletedSyncIds } from "@/services/app-sync";
import { deleteStoredMedia, getMediaBlob, resolveMediaUrl, uploadMediaFile } from "@/services/file-storage";
import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { isPromptOptimizerReady, optimizeGenerationPrompt } from "@/services/api/prompt";
import { createVideoGenerationTask, pollVideoGenerationTask, storeGeneratedVideo, videoGenerationPollConfig, type VideoGenerationTask } from "@/services/api/video";
import { consumeImageToVideoReferences } from "@/services/workbench-handoff";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { isRelayBasesVideoModel, modelOptionName, normalizeVideoCallMode, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

type GeneratedVideo = {
    id: string;
    url: string;
    storageKey: string;
    thumbnail?: string;
    videoDurationMs?: number;
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

type GeneratedFailure = {
    id: string;
    error: string;
    durationMs: number;
};

type ReferencePreview = { kind: "image"; label: string; item: ReferenceImage } | { kind: "video"; label: string; item: ReferenceVideo };

type GenerationLog = {
    id: string;
    createdAt: number;
    updatedAt: number;
    pinnedAt?: number;
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
    videos: GeneratedVideo[];
    failures: GeneratedFailure[];
    error?: string;
};

type GenerationLogConfig = Pick<AiConfig, "model" | "videoModel" | "videoCallMode" | "size" | "vquality" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark">;

type PollGenerationOptions = { notify?: boolean; resultId?: string; startedAtMs?: number; runStarted?: boolean };

const LOG_STORE_KEY = "infinite-canvas:video_generation_logs";
const VIDEO_WORKBENCH_DRAFT_KEY = "relaybases-canvas:video-workbench-draft";
const INITIAL_LOG_VISIBLE_COUNT = 60;
const LOG_VISIBLE_BATCH_SIZE = 60;
const VIDEO_LOG_THUMBNAIL_MIN_RENDER_EDGE = 720;
const RESULT_OVERLAY_ICON_BUTTON_CLASS = "!inline-flex !size-8 !items-center !justify-center !rounded-full !border-0 !bg-transparent !p-0 !text-white !shadow-none hover:!bg-white/16 hover:!text-white disabled:!bg-transparent disabled:!text-white/45 [&_.ant-btn-icon]:!m-0 [&_.ant-btn-icon]:shrink-0";
const RESULT_OVERLAY_DANGER_BUTTON_CLASS = `${RESULT_OVERLAY_ICON_BUTTON_CLASS} hover:!bg-rose-500/45`;
const RESULT_FAILED_ICON_BUTTON_CLASS = "!inline-flex !size-8 !items-center !justify-center !rounded-full !border-0 !bg-red-100/70 !p-0 !text-red-600 !shadow-none hover:!bg-red-200/80 dark:!bg-red-950/60 dark:!text-red-200 dark:hover:!bg-red-900/80 [&_.ant-btn-icon]:!m-0 [&_.ant-btn-icon]:shrink-0";
const COMPOSER_CONTROL_CLASS = "h-8 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors hover:bg-stone-100/70 dark:hover:bg-stone-900/70";
const HISTORY_SEARCH_INPUT_CLASS = "mb-3 !rounded-lg !border-stone-200 !bg-background !shadow-none transition-colors hover:!border-stone-300 focus-within:!border-stone-300 focus-within:!shadow-none [&.ant-input-affix-wrapper-focused]:!border-stone-300 [&.ant-input-affix-wrapper-focused]:!shadow-none [&_input]:!outline-none dark:!border-stone-800 dark:hover:!border-stone-700 dark:focus-within:!border-stone-700 dark:[&.ant-input-affix-wrapper-focused]:!border-stone-700";
const VIDEO_MODE_OPTIONS = [
    { value: "sync", label: "同步" },
    { value: "async", label: "异步·4倍扣费" },
];
const RELAYBASES_VIDEO_RATIO_OPTIONS = [
    { value: "16:9", label: "横屏" },
    { value: "9:16", label: "竖屏" },
    { value: "1:1", label: "方形" },
];
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });

export default function VideoPage() {
    const { message, modal } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const referencePopoverRef = useRef<HTMLDivElement>(null);
    const referencePopoverDesktopPanelRef = useRef<HTMLDivElement>(null);
    const referencePopoverMobilePanelRef = useRef<HTMLDivElement>(null);
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
    const [activeResultLogId, setActiveResultLogId] = useState("");
    const [resultsByLog, setResultsByLog] = useState<Record<string, GenerationResult[]>>({});
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [runningByLog, setRunningByLog] = useState<Record<string, { startedAt: number; count: number }>>({});
    const [logsOpen, setLogsOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [promptOptimizing, setPromptOptimizing] = useState(false);
    const [promptCollapsed, setPromptCollapsed] = useState(false);
    const [referencePopoverOpen, setReferencePopoverOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [configHydrated, setConfigHydrated] = useState(() => (typeof window === "undefined" ? false : (useConfigStore.persist?.hasHydrated?.() ?? true)));
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [playerVideo, setPlayerVideo] = useState<GeneratedVideo | null>(null);
    const [referencePreview, setReferencePreview] = useState<ReferencePreview | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [resultDeleteTargets, setResultDeleteTargets] = useState<GenerationResult[]>([]);
    const draftRestoredRef = useRef(false);

    const model = effectiveConfig.videoModel || effectiveConfig.model;
    const modelName = modelOptionName(model);
    const seedanceVideo = isSeedanceVideoConfig({ ...effectiveConfig, model });
    const referenceLimits = videoReferenceLimits(seedanceVideo, modelName);
    const relayBasesVideo = isRelayBasesVideoModel(model);
    const ratioValue = seedanceVideo ? normalizeSeedanceRatio(effectiveConfig.size) : normalizeVideoSizeValue(effectiveConfig.size);
    const resolutionValue = seedanceVideo ? normalizeSeedanceResolution(effectiveConfig.vquality, modelName) : "fixed";
    const secondsValue = seedanceVideo ? String(normalizeSeedanceDuration(effectiveConfig.videoSeconds)) : String(normalizeRelayBasesVideoDuration(effectiveConfig.videoSeconds, modelName));
    const ratioOptions = videoRatioOptions(seedanceVideo);
    const resolutionOptions = videoResolutionOptions(seedanceVideo, modelName, videoResolutionLabel(effectiveConfig.vquality, model));
    const secondsOptions = videoSecondsOptions(seedanceVideo, modelName, secondsValue);
    const secondsTiming = seedanceVideo ? { min: 4, max: 15, defaultValue: 5, fixed: false } : relayBasesVideoTiming(modelName);
    const canGenerate = Boolean(prompt.trim());
    const activeLogId = previewLog?.id || activeResultLogId;
    const activeRunning = activeLogId ? runningByLog[activeLogId] : undefined;
    const results = activeLogId ? dedupeGenerationResults(resultsByLog[activeLogId] || []) : [];
    const resultKeys = results.map(resultIdentityKey);
    const running = Boolean(activeRunning);
    const selectedResults = results.filter((result) => selectedResultIds.includes(resultIdentityKey(result)));
    const selectedSuccessResults = selectedResults.filter((result) => result.status === "success" && result.video);
    const allResultsSelected = Boolean(results.length) && resultKeys.every((key) => selectedResultIds.includes(key));

    useEffect(() => {
        if (!activeRunning?.startedAt) {
            setElapsedMs(0);
            return;
        }
        const timer = window.setInterval(() => setElapsedMs(performance.now() - activeRunning.startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [activeRunning?.startedAt]);

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
        if (!effectiveConfig.apiKey && !effectiveConfig.mediaApiKey) return;
        void refreshLogs({ resumePending: true });
    }, [configHydrated, effectiveConfig.apiKey, effectiveConfig.mediaApiKey, effectiveConfig.baseUrl]);

    useEffect(() => {
        if (!configHydrated || draftRestoredRef.current || typeof window === "undefined") return;
        draftRestoredRef.current = true;
        if (effectiveConfig.restoreWorkbenchDraftOnStart !== "true") return;
        try {
            const draft = JSON.parse(window.localStorage.getItem(VIDEO_WORKBENCH_DRAFT_KEY) || "{}") as Partial<{
                prompt: string;
                references: ReferenceImage[];
                videoReferences: ReferenceVideo[];
                audioReferences: ReferenceAudio[];
            }>;
            if (typeof draft.prompt === "string") setPrompt(draft.prompt);
            if (Array.isArray(draft.references)) setReferences(draft.references.slice(0, referenceLimits.images));
            if (Array.isArray(draft.videoReferences)) setVideoReferences(draft.videoReferences.slice(0, referenceLimits.videos));
            if (Array.isArray(draft.audioReferences)) setAudioReferences(draft.audioReferences.slice(0, referenceLimits.audios));
        } catch {}
    }, [configHydrated, effectiveConfig.restoreWorkbenchDraftOnStart, referenceLimits.audios, referenceLimits.images, referenceLimits.videos]);

    useEffect(() => {
        const handoff = consumeImageToVideoReferences();
        if (!handoff?.references.length) return;
        const handoffLimits = videoReferenceLimits(seedanceVideo, modelName);
        setReferences((value) => mergeReferenceImages(handoff.references, value).slice(0, handoffLimits.images));
        if (handoff.prompt) setPrompt((value) => (value.trim() ? value : handoff.prompt || value));
        message.success(`已带入 ${Math.min(handoff.references.length, handoffLimits.images)} 张参考图`);
    }, [message, modelName, seedanceVideo]);

    useEffect(() => {
        if (!configHydrated || typeof window === "undefined") return;
        if (effectiveConfig.restoreWorkbenchDraftOnStart !== "true") return;
        const timer = window.setTimeout(() => {
            window.localStorage.setItem(
                VIDEO_WORKBENCH_DRAFT_KEY,
                JSON.stringify({
                    prompt,
                    references: references.slice(0, referenceLimits.images),
                    videoReferences: videoReferences.slice(0, referenceLimits.videos),
                    audioReferences: audioReferences.slice(0, referenceLimits.audios),
                }),
            );
        }, 150);
        return () => window.clearTimeout(timer);
    }, [audioReferences, configHydrated, effectiveConfig.restoreWorkbenchDraftOnStart, prompt, referenceLimits.audios, referenceLimits.images, referenceLimits.videos, references, videoReferences]);

    useEffect(() => {
        setSelectedResultIds((ids) => {
            if (!ids.length) return ids;
            const available = new Set(results.map(resultIdentityKey));
            const next = ids.filter((id) => available.has(id));
            return next.length === ids.length ? ids : next;
        });
    }, [results]);

    const updateLogResults = (logId: string, updater: (value: GenerationResult[]) => GenerationResult[]) => {
        if (!logId) return;
        setResultsByLog((value) => ({ ...value, [logId]: dedupeGenerationResults(updater(value[logId] || [])) }));
    };

    const startLogRun = (logId: string, startedAtValue = performance.now()) => {
        if (!logId) return;
        setRunningByLog((value) => {
            const current = value[logId];
            return { ...value, [logId]: { startedAt: current?.startedAt || startedAtValue, count: (current?.count || 0) + 1 } };
        });
    };

    const finishLogRun = (logId: string) => {
        if (!logId) return;
        setRunningByLog((value) => {
            const current = value[logId];
            if (!current) return value;
            if (current.count > 1) return { ...value, [logId]: { ...current, count: current.count - 1 } };
            const next = { ...value };
            delete next[logId];
            return next;
        });
    };

    useEffect(() => {
        if (!referencePopoverOpen) return;
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (referencePopoverRef.current?.contains(event.target as Node)) return;
            if (referencePopoverDesktopPanelRef.current?.contains(event.target as Node)) return;
            if (referencePopoverMobilePanelRef.current?.contains(event.target as Node)) return;
            setReferencePopoverOpen(false);
        };
        document.addEventListener("mousedown", closeOnOutsideClick);
        return () => document.removeEventListener("mousedown", closeOnOutsideClick);
    }, [referencePopoverOpen]);

    const addReferences = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        const remainingImages = Math.max(0, referenceLimits.images - references.length);
        const remainingVideos = Math.max(0, referenceLimits.videos - videoReferences.length);
        const remainingAudios = Math.max(0, referenceLimits.audios - audioReferences.length);
        const unsupported = selectedFiles.filter((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/") && !isSupportedAudioFile(file));
        const unsupportedByModel = selectedFiles.filter((file) => (file.type.startsWith("image/") && referenceLimits.images <= 0) || (file.type.startsWith("video/") && referenceLimits.videos <= 0) || (isSupportedAudioFile(file) && referenceLimits.audios <= 0));
        if (unsupported.length) message.warning("已忽略不支持的参考素材，请使用图片、mp4/mov 视频或 mp3/wav 音频");
        if (unsupportedByModel.length) message.warning("已忽略当前模型不使用的参考素材");
        if (referenceLimits.images > 0 && !remainingImages && selectedFiles.some((file) => file.type.startsWith("image/"))) message.warning("参考图数量已达到当前模型上限");
        if (referenceLimits.videos > 0 && !remainingVideos && selectedFiles.some((file) => file.type.startsWith("video/"))) message.warning("参考视频数量已达到当前模型上限");
        if (referenceLimits.audios > 0 && !remainingAudios && selectedFiles.some((file) => isSupportedAudioFile(file))) message.warning("参考音频数量已达到当前模型上限");
        const imageFiles = selectedFiles.filter((file) => referenceLimits.images > 0 && file.type.startsWith("image/") && file.size <= referenceLimits.imageMaxBytes).slice(0, remainingImages);
        const videoFiles = selectedFiles.filter((file) => referenceLimits.videos > 0 && file.type.startsWith("video/") && file.size <= referenceLimits.videoMaxBytes).slice(0, remainingVideos);
        const audioFiles = selectedFiles.filter((file) => referenceLimits.audios > 0 && isSupportedAudioFile(file) && file.size <= referenceLimits.audioMaxBytes).slice(0, remainingAudios);
        if (selectedFiles.some((file) => file.type.startsWith("image/") && file.size > referenceLimits.imageMaxBytes)) message.warning(`已忽略超过 ${formatReferenceLimit(referenceLimits.imageMaxBytes)} 的参考图`);
        if (selectedFiles.some((file) => file.type.startsWith("video/") && file.size > referenceLimits.videoMaxBytes)) message.warning(`已忽略超过 ${formatReferenceLimit(referenceLimits.videoMaxBytes)} 的参考视频`);
        if (selectedFiles.some((file) => isSupportedAudioFile(file) && file.size > referenceLimits.audioMaxBytes)) message.warning(`已忽略超过 ${formatReferenceLimit(referenceLimits.audioMaxBytes)} 的参考音频`);
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
        setReferences((value) => [...value, ...nextReferences].slice(0, referenceLimits.images));
        setVideoReferences((value) => [...value, ...nextVideoReferences].slice(0, referenceLimits.videos));
        setAudioReferences((value) => [...value, ...nextAudioReferences].slice(0, referenceLimits.audios));
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的图片");
                return;
            }
            const remainingImages = Math.max(0, referenceLimits.images - references.length);
            if (!remainingImages) {
                message.warning("参考图数量已达到当前模型上限");
                return;
            }
            const nextReferences = await Promise.all(
                blobs.slice(0, remainingImages).map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, referenceLimits.images));
            message.success(`已读取 ${nextReferences.length} 张参考图`);
        } catch {
            message.error("剪切板里没有可读取的图片");
        }
    };

    const optimizePrompt = async () => {
        const text = prompt.trim();
        if (!text) {
            message.warning("请先输入提示词梗概");
            return;
        }
        if (!isPromptOptimizerReady(effectiveConfig)) {
            message.warning("请先配置文本 API Key 并获取文本模型");
            openConfigDialog(true, "channels");
            return;
        }
        setPromptOptimizing(true);
        try {
            setPrompt(await optimizeGenerationPrompt(effectiveConfig, "video", text));
            message.success("提示词已优化");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "提示词优化失败");
        } finally {
            setPromptOptimizing(false);
        }
    };

    const generate = async () => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        const resultId = nanoid();
        const targetLog = previewLog;
        const logId = targetLog?.id || resultId;
        setElapsedMs(0);
        setActiveResultLogId(logId);
        if (!targetLog) setPreviewLog(null);
        setSelectedResultIds([]);
        updateLogResults(logId, (value) => [...value, { id: resultId, status: "pending" }]);
        const batchStartedAt = performance.now();
        startLogRun(logId, batchStartedAt);
        try {
            const taskStartedAt = Date.now();
            const task = await createVideoGenerationTask(snapshot.config, snapshot.text, snapshot.references, snapshot.videoReferences, snapshot.audioReferences);
            const log = buildLog({
                id: logId,
                createdAt: targetLog?.createdAt,
                pinnedAt: targetLog?.pinnedAt,
                time: targetLog?.time,
                prompt: snapshot.text,
                model,
                config: snapshot.config,
                references: snapshot.references,
                videoReferences: snapshot.videoReferences,
                audioReferences: snapshot.audioReferences,
                durationMs: targetLog?.durationMs || 0,
                status: "生成中",
                task,
                videos: logVideos(targetLog),
                failures: targetLog?.failures || [],
            });
            await saveLog(log);
            if (targetLog) setPreviewLog(log);
            if (effectiveConfig.clearVideoInputsAfterSubmit === "true") {
                setPrompt("");
                setReferences([]);
                setVideoReferences([]);
                setAudioReferences([]);
            }
            void pollGenerationLog(log, snapshot.config, { resultId, startedAtMs: taskStartedAt, runStarted: true });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "生成失败";
            updateLogResults(logId, (value) => updateVideoResultById(value, resultId, { status: "failed", error: errorMessage }));
            const failedLog = appendFailureToVideoLog(
                buildLog({
                    id: logId,
                    createdAt: targetLog?.createdAt,
                    pinnedAt: targetLog?.pinnedAt,
                    time: targetLog?.time,
                    prompt: snapshot.text,
                    model,
                    config: snapshot.config,
                    references: snapshot.references,
                    videoReferences: snapshot.videoReferences,
                    audioReferences: snapshot.audioReferences,
                    durationMs: targetLog?.durationMs || 0,
                    status: "失败",
                    videos: logVideos(targetLog),
                    failures: targetLog?.failures || [],
                }),
                { id: resultId, error: errorMessage, durationMs: performance.now() - batchStartedAt },
            );
            await saveLog(failedLog);
            if (targetLog) setPreviewLog(failedLog);
            message.error(errorMessage);
            notifyWorkbenchTask(effectiveConfig.notifyOnGenerationComplete === "true", "视频任务创建失败", errorMessage, { tag: `relaybases-video-create-${resultId}`, requireInteraction: true });
            finishLogRun(logId);
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
        if (modelName.toLowerCase() === "veo-omni-flash-video-edit" && !videoReferences.length) {
            message.error("当前模型需要 1 个参考视频");
            return null;
        }
        if (seedanceVideo) {
            const videoReferenceError = seedanceVideoReferenceError(videoReferences);
            if (videoReferenceError) {
                message.error(`${videoReferenceError}。${seedanceVideoReferenceHint}`);
                return null;
            }
        }
        return {
            text,
            config: buildVideoConfig(effectiveConfig, model),
            references: references.slice(0, referenceLimits.images),
            videoReferences: videoReferences.slice(0, referenceLimits.videos),
            audioReferences: audioReferences.slice(0, referenceLimits.audios),
        };
    };

    const findRecoverableLogForResult = (items: GenerationLog[], resultId?: string) =>
        resultId ? items.find((log) => log.id === resultId && log.task && (log.status === "生成中" || log.error === "请先配置 API Key")) || null : null;

    const retryResult = async (resultId?: string) => {
        let recoverableLog = resultId ? findRecoverableLogForResult(logs, resultId) : previewLog?.task ? previewLog : null;
        if (resultId && !recoverableLog) recoverableLog = findRecoverableLogForResult(await refreshLogs(), resultId);
        if (recoverableLog?.task) {
            const task = recoverableLog.task;
            const recoveryLog = { ...recoverableLog, status: "生成中" as const, error: undefined };
            void pollGenerationLog(recoveryLog, buildVideoConfig(effectiveConfig, task.model || recoveryLog.model), { notify: true });
            return;
        }
        void generate();
    };

    const downloadVideo = (video: GeneratedVideo) => {
        saveAs(video.url, "video.mp4");
    };

    const downloadSelectedVideos = async () => {
        const targets = selectedSuccessResults.map((result) => result.video).filter((video): video is GeneratedVideo => Boolean(video));
        if (!targets.length) {
            message.warning("请选择可下载的视频结果");
            return;
        }
        const messageKey = "video-workbench-download-zip";
        message.loading({ key: messageKey, content: "正在打包视频", duration: 0 });
        try {
            const files = await Promise.all(
                targets.map(async (video, index) => {
                    const blob = video.storageKey ? await getMediaBlob(video.storageKey) : video.url ? await (await fetch(video.url)).blob() : null;
                    if (!blob) throw new Error("视频文件缺失");
                    return {
                        name: `${String(index + 1).padStart(2, "0")}-${safeArchiveName(video.id)}.${fileExtensionFromMime(blob.type || video.mimeType, "mp4")}`,
                        data: blob,
                    };
                }),
            );
            const zip = await createZip(files);
            saveAs(zip, `relaybases-videos-${timestampForFileName()}.zip`);
            message.success({ key: messageKey, content: `已打包 ${files.length} 个视频` });
        } catch (error) {
            message.error({ key: messageKey, content: error instanceof Error ? error.message : "视频打包失败" });
        }
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
        const reference: ReferenceVideo = { id: nanoid(), name: "generated-video.mp4", type: video.mimeType || "video/mp4", url: video.url, storageKey: video.storageKey, bytes: video.bytes, width: video.width, height: video.height, durationMs: video.videoDurationMs };
        const referenceKey = reference.storageKey || reference.url;
        const applyReference = (mode: "append" | "replace") => {
            setVideoReferences((value) => (mode === "replace" ? [reference] : [reference, ...value.filter((item) => (item.storageKey || item.url) !== referenceKey)]).slice(0, referenceLimits.videos || SEEDANCE_REFERENCE_LIMITS.videos));
            message.success(mode === "replace" ? "已替换参考视频" : "已加入参考视频");
        };
        if (effectiveConfig.referenceEditMode === "ask" && videoReferences.length) {
            modal.confirm({
                title: "处理参考视频",
                content: "将当前结果加入参考视频，或替换已有参考视频。",
                okText: "替换",
                cancelText: "追加",
                onOk: () => applyReference("replace"),
                onCancel: () => applyReference("append"),
            });
            return;
        }
        applyReference(effectiveConfig.referenceEditMode === "replace" ? "replace" : "append");
    };

    const deleteResult = async (result: GenerationResult) => {
        const targetKey = resultIdentityKey(result);
        if (activeLogId) updateLogResults(activeLogId, (value) => value.filter((item) => resultIdentityKey(item) !== targetKey));
        const logId = previewLog?.id || activeResultLogId || (await findVideoLogIdForResult(result.id));
        if (logId) {
            const nextLog = await deleteVideoResultFromLog(logId, result);
            if (!nextLog) await recordDeletedSyncIds("video-workbench", [logId]);
            if (previewLog?.id === logId) setPreviewLog(nextLog);
            await refreshLogs();
            return;
        }
        if (result.video?.storageKey) await deleteStoredMedia([result.video.storageKey]);
        await refreshLogs();
    };

    const requestDeleteResults = (targets: GenerationResult[]) => {
        if (!targets.length) return;
        setResultDeleteTargets(targets);
    };

    const confirmDeleteResults = async () => {
        const targets = resultDeleteTargets;
        const targetKeys = new Set(targets.map(resultIdentityKey));
        setResultDeleteTargets([]);
        for (const result of targets) {
            await deleteResult(result);
        }
        setSelectedResultIds((ids) => ids.filter((id) => !targetKeys.has(id)));
    };

    const toggleAllResults = () => {
        setSelectedResultIds(allResultsSelected ? [] : resultKeys);
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            if (references.length >= referenceLimits.images) {
                message.warning("参考图数量已达到当前模型上限");
                setAssetPickerOpen(false);
                return;
            }
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, referenceLimits.images));
        } else if (payload.kind === "video") {
            if (referenceLimits.videos <= 0) {
                message.warning("当前模型不使用参考视频");
                setAssetPickerOpen(false);
                return;
            }
            if (videoReferences.length >= referenceLimits.videos) {
                message.warning("参考视频数量已达到当前模型上限");
                setAssetPickerOpen(false);
                return;
            }
            setVideoReferences((value) => [...value, { id: nanoid(), name: payload.title, type: "video/mp4", url: payload.url, storageKey: payload.storageKey, width: payload.width, height: payload.height }].slice(0, referenceLimits.videos));
        }
        setAssetPickerOpen(false);
    };

    const createSession = () => {
        setPrompt("");
        setReferences([]);
        setVideoReferences([]);
        setAudioReferences([]);
        setActiveResultLogId("");
        setElapsedMs(0);
        setSelectedLogIds([]);
        setSelectedResultIds([]);
        setPreviewLog(null);
    };

    const deleteSelectedLogs = async () => {
        const ids = [...selectedLogIds];
        const mediaKeys = logs
            .filter((log) => ids.includes(log.id))
            .flatMap((log) => logVideos(log).map((video) => video.storageKey).filter((key): key is string => Boolean(key)));
        await recordDeletedSyncIds("video-workbench", ids);
        await Promise.all([deleteStoredMedia(mediaKeys), ...ids.map((id) => logStore.removeItem(id))]);
        setResultsByLog((value) => {
            const next = { ...value };
            ids.forEach((id) => delete next[id]);
            return next;
        });
        setRunningByLog((value) => {
            const next = { ...value };
            ids.forEach((id) => delete next[id]);
            return next;
        });
        if (previewLog && ids.includes(previewLog.id)) {
            setPreviewLog(null);
            setActiveResultLogId("");
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

    const togglePinnedLog = async (log: GenerationLog) => {
        const stored = await logStore.getItem<GenerationLog>(log.id);
        const current = await normalizeLog(stored || log);
        const next: GenerationLog = {
            ...current,
            pinnedAt: current.pinnedAt ? undefined : Date.now(),
            updatedAt: Date.now(),
        };
        await logStore.setItem(log.id, serializeLog(next));
        setLogs((value) => sortWorkbenchHistoryItems(value.map((item) => (item.id === next.id ? next : item))));
        setPreviewLog((currentPreview) => (currentPreview?.id === next.id ? { ...currentPreview, pinnedAt: next.pinnedAt, updatedAt: next.updatedAt } : currentPreview));
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
        const resultId = options.resultId || log.id;
        if (activeLogIdsRef.current.has(resultId)) {
            if (options.notify) message.info("该视频任务正在恢复中");
            return;
        }
        const logId = log.id;
        const requestStartedAtMs = options.startedAtMs || log.createdAt || Date.now();
        const taskConfig = buildVideoConfig({ ...effectiveConfig, ...log.config }, log.task.model || log.model);
        const requestConfig = configOverride || taskConfig;
        if (!isAiConfigReady(requestConfig, log.task.model || log.model)) {
            if (options.notify) {
                message.warning("请先完成媒体 API Key 配置后再恢复结果");
                openConfigDialog(true);
            }
            return;
        }
        activeLogIdsRef.current.add(resultId);
        if (!options.runStarted) startLogRun(logId);
        updateLogResults(logId, (value) => (value.some((item) => item.id === resultId) ? value : [...value, { id: resultId, status: "pending" }]));
        try {
            const pollConfig = videoGenerationPollConfig(log.task);
            for (let attempt = 0; attempt < pollConfig.attempts; attempt += 1) {
                const state = await pollVideoGenerationTask(requestConfig, log.task);
                if (state.status === "completed") {
                    const stored = await storeGeneratedVideo(state.result, { apiKey: requestConfig.apiKey });
                    const elapsedMs = Date.now() - requestStartedAtMs;
                    const nextVideo: GeneratedVideo = {
                        id: resultId,
                        url: stored.url,
                        storageKey: stored.storageKey,
                        thumbnail: "",
                        videoDurationMs: trustedVideoDurationMs({ videoDurationMs: stored.durationMs }) || expectedVideoDurationMs(log),
                        durationMs: elapsedMs,
                        width: stored.width || 1280,
                        height: stored.height || 720,
                        bytes: stored.bytes,
                        mimeType: stored.mimeType,
                    };
                    const completedLog = appendVideoToLog(log, nextVideo);
                    updateLogResults(logId, (value) => updateVideoResultById(value, resultId, { status: "success", video: nextVideo, error: undefined }));
                    await saveLog(completedLog);
                    setPreviewLog((current) => (current?.id === completedLog.id ? completedLog : current));
                    message.success("视频已生成");
                    notifyWorkbenchTask(effectiveConfig.notifyOnGenerationComplete === "true", "视频生成完成", `${log.prompt || log.title || "视频任务"} 已完成`, { tag: `relaybases-video-${resultId}`, requireInteraction: true });
                    void createVideoThumbnail(stored.url).then(async (thumbnail) => {
                        const normalized = normalizeVideoThumbnail(thumbnail);
                        if (!normalized) return;
                        const videoWithThumbnail = { ...nextVideo, thumbnail: normalized };
                        updateLogResults(logId, (value) => updateVideoResultById(value, resultId, { status: "success", video: videoWithThumbnail, error: undefined }));
                        await cacheVideoThumbnail(log.id, nextVideo.id, normalized);
                    });
                    return;
                }
                if (state.status === "failed") throw new Error(state.error);
                if (attempt === pollConfig.attempts - 1) throw new Error(pollConfig.timeoutMessage);
                await delay(pollConfig.delayMs);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "生成失败";
            const failedLog = appendFailureToVideoLog(log, { id: resultId, error: errorMessage, durationMs: Date.now() - requestStartedAtMs });
            updateLogResults(logId, (value) => updateVideoResultById(value, resultId, { status: "failed", error: errorMessage, video: undefined }));
            await saveLog(failedLog);
            setPreviewLog((current) => (current?.id === failedLog.id ? failedLog : current));
            message.error(errorMessage);
            notifyWorkbenchTask(effectiveConfig.notifyOnGenerationComplete === "true", "视频生成失败", errorMessage, { tag: `relaybases-video-${resultId}`, requireInteraction: true });
        } finally {
            activeLogIdsRef.current.delete(resultId);
            finishLogRun(logId);
        }
    };

    const previewGenerationLog = (log: GenerationLog) => {
        setActiveResultLogId(log.id);
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
        const currentResults = resultsByLog[log.id] || [];
        const pendingResultId = currentResults.find((item) => item.status === "pending")?.id;
        updateLogResults(log.id, (current) => resultsFromVideoLog(log, current));
        if (log.status === "生成中" && log.task) void pollGenerationLog(log, undefined, { resultId: pendingResultId });
    };

    const renderReferencePanel = () => (
        <VideoReferencePanel
            seedance={seedanceVideo}
            modelName={modelName}
            limits={referenceLimits}
            references={references}
            videoReferences={videoReferences}
            audioReferences={audioReferences}
            onPasteImage={() => void addReferencesFromClipboard()}
            onUpload={() => fileInputRef.current?.click()}
            onPreview={setReferencePreview}
            onMoveImage={(index, offset) => setReferences((value) => moveListItem(value, index, offset))}
            onMoveVideo={(index, offset) => setVideoReferences((value) => moveListItem(value, index, offset))}
            onMoveAudio={(index, offset) => setAudioReferences((value) => moveListItem(value, index, offset))}
            onRemoveImage={(id) => setReferences((value) => value.filter((ref) => ref.id !== id))}
            onRemoveVideo={(id) => setVideoReferences((value) => value.filter((ref) => ref.id !== id))}
            onRemoveAudio={(id) => setAudioReferences((value) => value.filter((ref) => ref.id !== id))}
        />
    );

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-background text-stone-900 dark:text-stone-100">
            <main className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[460px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[520px_minmax(0,1fr)]">
                <aside className="hidden h-full min-h-0 overflow-hidden rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:block">
                    <LogPanel
                        logs={logs}
                        selectedLogIds={selectedLogIds}
                        activeLogId={activeLogId}
                        onSelectedLogIdsChange={setSelectedLogIds}
                        onCreateSession={createSession}
                        onDeleteSelected={() => setDeleteConfirmOpen(true)}
                        onTogglePin={togglePinnedLog}
                        onPreviewLog={previewGenerationLog}
                    />
                </aside>

                <section className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center justify-end gap-3 px-1 pb-2 lg:px-0">
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <Button className="max-lg:!inline-flex lg:!hidden" icon={<History className="size-4" />} onClick={() => setLogsOpen(true)}>
                                记录
                            </Button>
                            {results.length ? (
                                <>
                                    <Button size="small" icon={<CheckSquare className="size-3.5" />} onClick={toggleAllResults}>
                                        {allResultsSelected ? "取消" : "全选"}
                                    </Button>
                                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedResults.length} onClick={() => requestDeleteResults(selectedResults)}>
                                        删除选中
                                    </Button>
                                    <Button size="small" icon={<Download className="size-3.5" />} disabled={!selectedSuccessResults.length} onClick={() => void downloadSelectedVideos()}>
                                        下载选中
                                    </Button>
                                </>
                            ) : null}
                            {running ? (
                                <HistoryPill tone="pending" label="生成中">
                                    {formatDuration(elapsedMs)}
                                    {(activeRunning?.count || 0) > 1 ? ` · ${activeRunning?.count} 个任务` : ""}
                                </HistoryPill>
                            ) : null}
                        </div>
                    </div>

                    <div
                        className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5"
                        style={{
                            backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.16) 1px, transparent 1px)",
                            backgroundSize: "22px 22px",
                        }}
                    >
                        <div className="mx-auto max-w-6xl">
                            {results.length ? (
                                <div className="grid justify-center gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 200px))" }}>
                                    {results.map((result) =>
                                        result.status === "success" && result.video ? (
                                            <ResultVideoCard key={resultIdentityKey(result)} video={result.video} previewSuspended={playerVideo?.id === result.video.id} selected={selectedResultIds.includes(resultIdentityKey(result))} savedToAsset={Boolean(findGeneratedVideoAsset(result.video, assets))} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? Array.from(new Set([...ids, resultIdentityKey(result)])) : ids.filter((id) => id !== resultIdentityKey(result))))} onPlay={() => setPlayerVideo(result.video || null)} onEdit={editResultVideo} onRegenerate={() => void generate()} onDownload={downloadVideo} onSaveAsset={saveResultToAssets} onDelete={() => requestDeleteResults([result])} />
                                        ) : result.status === "failed" ? (
                                            <FailedVideoCard key={resultIdentityKey(result)} error={result.error || "生成失败"} selected={selectedResultIds.includes(resultIdentityKey(result))} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? Array.from(new Set([...ids, resultIdentityKey(result)])) : ids.filter((id) => id !== resultIdentityKey(result))))} retryLabel={findRecoverableLogForResult(logs, result.id) ? "恢复结果" : "重试"} onRetry={() => retryResult(result.id)} onDelete={() => requestDeleteResults([result])} />
                                        ) : (
                                            <PendingVideoCard key={resultIdentityKey(result)} selected={selectedResultIds.includes(resultIdentityKey(result))} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? Array.from(new Set([...ids, resultIdentityKey(result)])) : ids.filter((id) => id !== resultIdentityKey(result))))} />
                                        ),
                                    )}
                                </div>
                            ) : (
                                <VideoWorkbenchEmptyState />
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 bg-card/95 p-3 backdrop-blur lg:p-4">
                        <div className="mx-auto max-w-6xl overflow-visible rounded-2xl bg-background shadow-[0_16px_44px_rgba(15,23,42,0.10)] ring-1 ring-stone-200/70 dark:bg-stone-950 dark:shadow-[0_16px_44px_rgba(0,0,0,0.28)] dark:ring-stone-800/70">
                            <div className="space-y-3 p-3 lg:p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700 transition hover:text-stone-950 dark:text-stone-200 dark:hover:text-white"
                                        onClick={() => setPromptCollapsed((collapsed) => !collapsed)}
                                        aria-expanded={!promptCollapsed}
                                    >
                                        <span>提示词</span>
                                        <ChevronDown className={`size-4 text-stone-400 transition-transform ${promptCollapsed ? "-rotate-90" : ""}`} />
                                    </button>
                                    <div className="flex flex-wrap gap-2">
                                        <Tooltip title="使用文本模型优化和丰富提示词">
                                            <Button size="small" icon={promptOptimizing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} disabled={!prompt.trim() || promptOptimizing} onClick={() => void optimizePrompt()}>
                                                AI 优化
                                            </Button>
                                        </Tooltip>
                                        <Button size="small" icon={<BookOpen className="size-3.5" />} onClick={() => setPromptDialogOpen(true)}>
                                            提示词库
                                        </Button>
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => setAssetPickerOpen(true)}>
                                            我的素材
                                        </Button>
                                    </div>
                                </div>
                                <Input.TextArea
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (!shouldSubmitPrompt(event, effectiveConfig.submitTaskShortcut)) return;
                                        event.preventDefault();
                                        void generate();
                                    }}
                                    rows={promptCollapsed ? 1 : 2}
                                    autoSize={promptCollapsed ? { minRows: 1, maxRows: 1 } : { minRows: 2, maxRows: 5 }}
                                    placeholder="描述镜头运动、主体动作、场景氛围和画面风格"
                                    className="!resize-none !rounded-none !border-0 !bg-transparent !px-0 !py-0 !text-base !shadow-none focus:!shadow-none"
                                />

                                <div ref={referencePopoverRef} className="relative min-w-0 pt-1">
                                    <button
                                        type="button"
                                        className={`inline-flex max-w-full items-center gap-2 ${COMPOSER_CONTROL_CLASS}`}
                                        onMouseDown={(event) => {
                                            event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setReferencePopoverOpen((open) => !open);
                                        }}
                                        aria-expanded={referencePopoverOpen}
                                    >
                                        <FolderPlus className="size-3.5 shrink-0 text-stone-500 dark:text-stone-400" />
                                        <span className="shrink-0 text-stone-700 dark:text-stone-200">参考素材</span>
                                        {videoReferenceSummary(references, videoReferences, audioReferences) ? (
                                            <span className="min-w-0 truncate text-xs text-stone-500 dark:text-stone-400">{videoReferenceSummary(references, videoReferences, audioReferences)}</span>
                                        ) : null}
                                    </button>
                                    {referencePopoverOpen ? (
                                        <div ref={referencePopoverDesktopPanelRef} className="absolute bottom-full left-0 z-[3000] mb-3 hidden max-h-[min(72vh,620px)] w-[520px] max-w-[calc(100vw-40px)] isolate overflow-y-auto rounded-[18px] bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.18)] ring-1 ring-stone-200/90 dark:bg-stone-950 dark:shadow-[0_18px_44px_rgba(0,0,0,0.42)] dark:ring-stone-800/90 sm:block" onMouseDown={(event) => event.stopPropagation()}>
                                            {renderReferencePanel()}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-3 pt-1 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <ModelPicker config={effectiveConfig} value={model} onChange={(value) => updateConfig("videoModel", value)} capability="video" className={`${COMPOSER_CONTROL_CLASS} max-w-[240px]`} onMissingConfig={() => openConfigDialog(false)} />
                                        {relayBasesVideo ? <VideoComposerSelect label="模式" value={normalizeVideoCallMode(effectiveConfig.videoCallMode)} options={VIDEO_MODE_OPTIONS} onChange={(value) => updateConfig("videoCallMode", normalizeVideoCallMode(value))} /> : null}
                                        <VideoComposerSelect label="比例" value={ratioValue} options={ratioOptions} onChange={(value) => updateConfig("size", value)} />
                                        {resolutionOptions.length > 1 ? <VideoComposerSelect label="清晰度" value={resolutionValue} options={resolutionOptions} onChange={(value) => updateConfig("vquality", value)} /> : <VideoComposerMetric label="清晰度" value={resolutionOptions[0]?.label || videoResolutionLabel(effectiveConfig.vquality, model)} />}
                                        {secondsTiming.fixed ? (
                                            <VideoComposerMetric label="时长" value={secondsOptions[0]?.label || (secondsValue === "-1" ? "智能" : `${secondsValue}s`)} />
                                        ) : (
                                            <VideoComposerDurationControl value={secondsValue} options={secondsOptions} min={secondsTiming.min} max={secondsTiming.max} allowSmart={seedanceVideo} onChange={(value) => updateConfig("videoSeconds", value)} />
                                        )}
                                        {seedanceVideo ? (
                                            <>
                                                <VideoToggleControl label="声音" checked={boolConfig(effectiveConfig.videoGenerateAudio, true)} onChange={(checked) => updateConfig("videoGenerateAudio", String(checked))} />
                                                <VideoToggleControl label="水印" checked={boolConfig(effectiveConfig.videoWatermark, false)} onChange={(checked) => updateConfig("videoWatermark", String(checked))} />
                                            </>
                                        ) : null}
                                    </div>
                                    <Button type="primary" size="large" icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={() => void generate()} className="xl:min-w-36">
                                        开始生成
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            {referencePopoverOpen && typeof document !== "undefined"
                ? createPortal(
                      <div
                          ref={referencePopoverMobilePanelRef}
                          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[3000] max-h-[min(62dvh,560px)] isolate overflow-y-auto rounded-[18px] bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 ring-stone-200/90 dark:bg-stone-950 dark:shadow-[0_24px_70px_rgba(0,0,0,0.48)] dark:ring-stone-800/90 sm:hidden"
                          onMouseDown={(event) => event.stopPropagation()}
                      >
                          {renderReferencePanel()}
                      </div>,
                      document.body,
                  )
                : null}
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
            <Drawer
                title={null}
                placement="bottom"
                height="min(88dvh, 720px)"
                open={logsOpen}
                onClose={() => setLogsOpen(false)}
                closable={false}
                styles={{ body: { height: "100%", overflow: "hidden", padding: 12 }, content: { borderRadius: "18px 18px 0 0" } }}
            >
                <LogPanel
                    logs={logs}
                    selectedLogIds={selectedLogIds}
                    activeLogId={activeLogId}
                    onSelectedLogIdsChange={setSelectedLogIds}
                    onCreateSession={createSession}
                    onDeleteSelected={() => setDeleteConfirmOpen(true)}
                    onClose={() => setLogsOpen(false)}
                    onTogglePin={togglePinnedLog}
                    onPreviewLog={(log) => {
                        previewGenerationLog(log);
                        setLogsOpen(false);
                    }}
                />
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

function VideoWorkbenchEmptyState() {
    return (
        <div className="grid min-h-[min(54dvh,560px)] place-items-center rounded-2xl bg-background/70 text-center dark:bg-background/70">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-sm text-stone-400">还没有生成视频</span>} />
        </div>
    );
}

function VideoComposerMetric({ label, value }: { label: string; value: string }) {
    return (
        <span className={`inline-flex max-w-[180px] items-center gap-1 overflow-hidden ${COMPOSER_CONTROL_CLASS}`}>
            <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">{label}</span>
            <span className="min-w-0 truncate text-stone-700 dark:text-stone-200">{value}</span>
        </span>
    );
}

function VideoComposerSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string; disabled?: boolean }>; onChange: (value: string) => void }) {
    const selected = options.find((item) => item.value === value) || options[0];
    return (
        <Select value={selected?.value || value} onValueChange={onChange}>
            <SelectTrigger
                className={`w-auto max-w-[11rem] justify-start gap-1.5 ${COMPOSER_CONTROL_CLASS}`}
                aria-label={`选择${label}`}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">{label}</span>
                <span className="min-w-0 shrink-0 truncate text-left text-stone-700 dark:text-stone-200">{selected?.label || value}</span>
            </SelectTrigger>
            <SelectContent className="z-[3000] min-w-[9rem] rounded-xl border border-border/70 bg-white p-1 shadow-xl dark:bg-stone-950" position="popper" align="start" side="bottom" sideOffset={6} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                {options.map((item) => (
                    <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                        {item.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function VideoComposerDurationControl({ value, options, min, max, allowSmart, onChange }: { value: string; options: Array<{ value: string; label: string; disabled?: boolean }>; min: number; max: number; allowSmart?: boolean; onChange: (value: string) => void }) {
    const [draft, setDraft] = useState(value === "-1" ? "" : value);
    const selected = options.find((item) => item.value === value);
    const customValue = "__custom_duration__";

    useEffect(() => {
        setDraft(value === "-1" ? "" : value);
    }, [value]);

    const commit = () => {
        const text = draft.trim();
        if (!text && allowSmart) {
            onChange("-1");
            return;
        }
        const seconds = Math.max(min, Math.min(max, Math.floor(Number(text) || min)));
        setDraft(String(seconds));
        onChange(String(seconds));
    };

    return (
        <div className={`inline-flex items-center overflow-hidden ${COMPOSER_CONTROL_CLASS} px-0`}>
            <span className="pl-3 pr-2 text-xs text-stone-500 dark:text-stone-400">时长</span>
            <input
                type="number"
                min={min}
                max={max}
                value={draft}
                placeholder={allowSmart && value === "-1" ? "智能" : String(min)}
                className="h-full w-10 bg-transparent px-1 text-center text-stone-700 outline-none placeholder:text-stone-400 [appearance:textfield] dark:text-stone-200 dark:placeholder:text-stone-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
            <span className="pr-1 text-xs text-stone-500 dark:text-stone-400">s</span>
            <Select value={selected?.value || customValue} onValueChange={(next) => next !== customValue && onChange(next)}>
                <SelectTrigger className="h-7 w-7 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-stone-100/80 focus-visible:ring-0 dark:hover:bg-stone-800/70" aria-label="选择时长预设" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} />
                <SelectContent className="z-[3000] min-w-[7rem] rounded-xl border border-border/70 bg-white p-1 shadow-xl dark:bg-stone-950" position="popper" align="start" side="bottom" sideOffset={6} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                    {selected ? null : (
                        <SelectItem value={customValue} disabled>
                            当前 {value === "-1" ? "智能" : `${value}s`}
                        </SelectItem>
                    )}
                    {options.map((item) => (
                        <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function VideoToggleControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <button
            type="button"
            className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm font-normal shadow-sm transition-colors ${checked ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-input bg-transparent text-stone-700 hover:bg-stone-100/70 dark:text-stone-200 dark:hover:bg-stone-900/70"}`}
            onClick={() => onChange(!checked)}
            aria-pressed={checked}
        >
            <span className="shrink-0 text-xs opacity-70">{label}</span>
            <span className="min-w-0 truncate">{checked ? "开" : "关"}</span>
        </button>
    );
}

type VideoReferenceLimits = {
    images: number;
    videos: number;
    audios: number;
    imageMaxBytes: number;
    videoMaxBytes: number;
    audioMaxBytes: number;
};

const RELAYBASES_MULTI_REFERENCE_MODELS = new Set(["video-fast-480p", "video-fast-720p", "video-pro-480p", "video-pro-720p", "video-pro-1080p", "video-standard-720p"]);

function videoReferenceLimits(seedance: boolean, model: string): VideoReferenceLimits {
    const value = model.toLowerCase();
    const base = {
        imageMaxBytes: SEEDANCE_REFERENCE_LIMITS.imageMaxBytes,
        videoMaxBytes: SEEDANCE_REFERENCE_LIMITS.videoMaxBytes,
        audioMaxBytes: SEEDANCE_REFERENCE_LIMITS.audioMaxBytes,
    };
    if (seedance) return { ...SEEDANCE_REFERENCE_LIMITS };
    if (value === "veo-omni-flash-video-edit") return { ...base, images: 5, videos: 1, audios: 0 };
    if (value === "veo-omni-flash") return { ...base, images: 5, videos: 0, audios: 0 };
    if (value === "veo-3-1") return { ...base, images: 2, videos: 0, audios: 0 };
    if (RELAYBASES_MULTI_REFERENCE_MODELS.has(value)) return { ...base, images: 5, videos: 3, audios: 3 };
    return { ...base, images: 5, videos: 0, audios: 0 };
}

function formatReferenceLimit(bytes: number) {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
}

function videoReferenceSummary(images: ReferenceImage[], videos: ReferenceVideo[], audios: ReferenceAudio[]) {
    const total = images.length + videos.length + audios.length;
    if (!total) return "";
    return [
        images.length ? `图 ${images.length}` : "",
        videos.length ? `视频 ${videos.length}` : "",
        audios.length ? `音频 ${audios.length}` : "",
    ]
        .filter(Boolean)
        .join(" · ");
}

function videoReferenceRequirements(seedance: boolean, model: string, limits: VideoReferenceLimits) {
    const value = model.toLowerCase();
    if (seedance) {
        return {
            image: `PNG/JPG · 单张≤${formatReferenceLimit(limits.imageMaxBytes)}`,
            video: `MP4/MOV · 2-15s · 单个≤${formatReferenceLimit(limits.videoMaxBytes)}`,
            audio: `MP3/WAV · 2-15s · 单个≤${formatReferenceLimit(limits.audioMaxBytes)}`,
        };
    }
    if (value === "veo-omni-flash-video-edit") {
        return {
            image: `PNG/JPG · 单张≤${formatReferenceLimit(limits.imageMaxBytes)}`,
            video: `MP4/MOV · 单个≤${formatReferenceLimit(limits.videoMaxBytes)}`,
            audio: "不使用",
        };
    }
    if (value === "veo-3-1") {
        return {
            image: `首帧/尾帧 · 最多 2 张 · PNG/JPG · 单张≤${formatReferenceLimit(limits.imageMaxBytes)}`,
            video: "不使用",
            audio: "不使用",
        };
    }
    if (limits.videos || limits.audios) {
        return {
            image: `PNG/JPG · 单张≤${formatReferenceLimit(limits.imageMaxBytes)}`,
            video: `MP4/MOV · 单个≤${formatReferenceLimit(limits.videoMaxBytes)}`,
            audio: `MP3/WAV · 单个≤${formatReferenceLimit(limits.audioMaxBytes)}`,
        };
    }
    return {
        image: `PNG/JPG · 单张≤${formatReferenceLimit(limits.imageMaxBytes)}`,
        video: "不使用",
        audio: "不使用",
    };
}

function VideoReferencePanel({
    seedance,
    modelName,
    limits,
    references,
    videoReferences,
    audioReferences,
    onPasteImage,
    onUpload,
    onPreview,
    onMoveImage,
    onMoveVideo,
    onMoveAudio,
    onRemoveImage,
    onRemoveVideo,
    onRemoveAudio,
}: {
    seedance: boolean;
    modelName: string;
    limits: VideoReferenceLimits;
    references: ReferenceImage[];
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    onPasteImage: () => void;
    onUpload: () => void;
    onPreview: (preview: ReferencePreview) => void;
    onMoveImage: (index: number, offset: number) => void;
    onMoveVideo: (index: number, offset: number) => void;
    onMoveAudio: (index: number, offset: number) => void;
    onRemoveImage: (id: string) => void;
    onRemoveVideo: (id: string) => void;
    onRemoveAudio: (id: string) => void;
}) {
    const summary = videoReferenceSummary(references, videoReferences, audioReferences);
    const requirements = videoReferenceRequirements(seedance, modelName, limits);

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-800 dark:text-stone-100">参考素材</div>
                    {summary ? <div className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">已添加：{summary}</div> : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                    <Tooltip title="从剪贴板读取参考图">
                        <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={onPasteImage} />
                    </Tooltip>
                    <Tooltip title="上传参考素材">
                        <Button size="small" icon={<Upload className="size-3.5" />} onClick={onUpload} />
                    </Tooltip>
                </div>
            </div>

            <VideoReferenceStrip title={`图片 ${references.length}/${limits.images}`} detail={requirements.image} empty="未添加">
                {references.map((item, index) => (
                    <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        className="group relative size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-stone-100 outline-none ring-1 ring-stone-200/70 transition focus-visible:ring-2 focus-visible:ring-primary dark:bg-stone-900 dark:ring-stone-800/70"
                        aria-label={`查看${seedanceReferenceLabel("image", index)}`}
                        onClick={() => onPreview({ kind: "image", label: seedanceReferenceLabel("image", index), item })}
                        onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            onPreview({ kind: "image", label: seedanceReferenceLabel("image", index), item });
                        }}
                    >
                        <img src={item.dataUrl} alt={item.name} className="size-full object-cover" />
                        <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10 group-focus-visible:bg-black/10" />
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">{seedanceReferenceLabel("image", index)}</span>
                        <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => onMoveImage(index, offset)} />
                        <button
                            type="button"
                            className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/58 text-white shadow-sm transition hover:bg-[#ff4d4f] active:bg-[#d9363e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                            onClick={(event) => {
                                event.stopPropagation();
                                onRemoveImage(item.id);
                            }}
                            aria-label="移除参考图"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                ))}
            </VideoReferenceStrip>

            {limits.videos > 0 || videoReferences.length ? (
                <VideoReferenceStrip title={limits.videos > 0 ? `视频 ${videoReferences.length}/${limits.videos}` : "视频"} detail={requirements.video} empty={limits.videos > 0 ? "未添加" : "当前模型不使用"}>
                    {videoReferences.map((item, index) => (
                        <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className="group relative h-16 w-24 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-black outline-none ring-1 ring-stone-200/70 transition focus-visible:ring-2 focus-visible:ring-primary dark:ring-stone-800/70"
                            aria-label={`查看${seedanceReferenceLabel("video", index)}`}
                            onClick={() => onPreview({ kind: "video", label: seedanceReferenceLabel("video", index), item })}
                            onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                onPreview({ kind: "video", label: seedanceReferenceLabel("video", index), item });
                            }}
                        >
                            <video src={item.url} className="size-full object-cover" muted preload="metadata" />
                            <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/15 group-focus-visible:bg-black/15" />
                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">{seedanceReferenceLabel("video", index)}</span>
                            <ReferenceOrderButtons index={index} total={videoReferences.length} onMove={(offset) => onMoveVideo(index, offset)} />
                            <button
                                type="button"
                                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/58 text-white shadow-sm transition hover:bg-[#ff4d4f] active:bg-[#d9363e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRemoveVideo(item.id);
                                }}
                                aria-label="移除参考视频"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </VideoReferenceStrip>
            ) : null}

            {limits.audios > 0 || audioReferences.length ? (
                <VideoReferenceStrip title={limits.audios > 0 ? `音频 ${audioReferences.length}/${limits.audios}` : "音频"} detail={requirements.audio} empty={limits.audios > 0 ? "未添加" : "当前模型不使用"}>
                    {audioReferences.map((item, index) => (
                        <div key={item.id} className="group relative flex h-16 w-44 shrink-0 flex-col justify-center gap-1.5 rounded-lg bg-stone-50 px-2 ring-1 ring-stone-200/70 dark:bg-stone-900/55 dark:ring-stone-800/70">
                            <div className="flex min-w-0 items-center gap-2 pr-5 text-xs text-stone-500 dark:text-stone-400">
                                <Music2 className="size-3.5 shrink-0" />
                                <span className="shrink-0 rounded bg-stone-200 px-1 text-[10px] text-stone-700 dark:bg-stone-800 dark:text-stone-200">{seedanceReferenceLabel("audio", index)}</span>
                                <span className="truncate">{item.name}</span>
                            </div>
                            <audio src={item.url} controls className="h-7 w-full" preload="metadata" />
                            <ReferenceOrderButtons index={index} total={audioReferences.length} onMove={(offset) => onMoveAudio(index, offset)} />
                            <button
                                type="button"
                                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/58 text-white shadow-sm transition hover:bg-[#ff4d4f] active:bg-[#d9363e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                                onClick={() => onRemoveAudio(item.id)}
                                aria-label="移除参考音频"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </VideoReferenceStrip>
            ) : null}
        </div>
    );
}

function VideoReferenceStrip({ title, detail, empty, children }: { title: string; detail?: string; empty: string; children: ReactNode }) {
    const hasChildren = Children.count(children) > 0;
    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="font-semibold text-stone-600 dark:text-stone-300">{title}</span>
                {detail ? <span className="text-[11px] leading-4 text-stone-400 dark:text-stone-500">{detail}</span> : null}
            </div>
            {hasChildren ? <div className="hide-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1">{children}</div> : <div className="px-1 py-1 text-xs text-stone-400 dark:text-stone-500">{empty}</div>}
        </div>
    );
}

function videoRatioOptions(seedance: boolean) {
    if (!seedance) return RELAYBASES_VIDEO_RATIO_OPTIONS;
    return seedanceRatioOptions.map((item) => ({ value: item.value, label: item.value === "adaptive" ? item.label : `${item.label} ${item.value}` }));
}

function videoResolutionOptions(seedance: boolean, model: string, fixedLabel: string) {
    if (!seedance) return [{ value: "fixed", label: fixedLabel }];
    return seedanceResolutionOptions.map((item) => ({ value: item.value, label: item.label, disabled: item.value === "1080p" && isSeedanceFastModel(model) }));
}

function videoSecondsOptions(seedance: boolean, model: string, currentValue: string) {
    const options = seedance ? seedanceDurationOptions.map((value) => ({ value: String(value), label: value === -1 ? "智能" : `${value}s` })) : relayBasesVideoTiming(model).options.map((value) => ({ value: String(value), label: `${value}s` }));
    if (currentValue && !options.some((item) => item.value === currentValue)) options.push({ value: currentValue, label: currentValue === "-1" ? "智能" : `${currentValue}s` });
    return uniqueVideoOptions(options);
}

function uniqueVideoOptions(options: Array<{ value: string; label: string; disabled?: boolean }>) {
    const seen = new Set<string>();
    return options.filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
    });
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

function ResultVideoCard({
    video,
    previewSuspended = false,
    selected,
    savedToAsset,
    onSelectedChange,
    onPlay,
    onEdit,
    onRegenerate,
    onDownload,
    onSaveAsset,
    onDelete,
}: {
    video: GeneratedVideo;
    previewSuspended?: boolean;
    selected: boolean;
    savedToAsset: boolean;
    onSelectedChange: (checked: boolean) => void;
    onPlay: () => void;
    onEdit: (video: GeneratedVideo) => void;
    onRegenerate: () => void;
    onDownload: (video: GeneratedVideo) => void;
    onSaveAsset: (video: GeneratedVideo) => void | Promise<void>;
    onDelete: () => void;
}) {
    const durationLabel = videoDurationLabel(video);
    return (
        <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-black shadow-sm dark:border-stone-800">
            <SelectionBubble className="absolute right-3 top-3 z-30" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成结果" />
            <div className="group relative aspect-square w-full overflow-hidden bg-black text-left">
                {previewSuspended ? (
                    video.thumbnail ? (
                        <img src={video.thumbnail} alt="" className="size-full object-cover" />
                    ) : (
                        <div className="size-full bg-black" />
                    )
                ) : (
                    <video src={video.url} poster={video.thumbnail || undefined} className="size-full object-cover" muted playsInline preload="metadata" />
                )}
                <button type="button" className="absolute inset-0 z-10 grid place-items-center bg-black/0 transition hover:bg-black/18" onClick={onPlay} aria-label="播放视频">
                    <span className="grid size-12 place-items-center rounded-full bg-white/90 text-stone-950 shadow-lg transition hover:scale-105">
                        <Play className="ml-0.5 size-5 fill-current" />
                    </span>
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-2.5 pb-2 pt-9 text-white">
                    <div className="mb-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[11px] leading-none text-white/78">
                        <span>{videoRatioLabel(video)}</span>
                        <span>
                            {video.width}×{video.height}
                        </span>
                        <span>{formatBytes(video.bytes)}</span>
                        {durationLabel ? <span>{durationLabel}</span> : null}
                    </div>
                    <div className="pointer-events-auto flex items-center justify-end gap-1">
                        <Tooltip title="作为参考视频继续编辑">
                            <Button type="text" aria-label="作为参考视频继续编辑" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<PenLine className="size-3.5" />} onClick={() => onEdit(video)} />
                        </Tooltip>
                        <Tooltip title={savedToAsset ? "已加入我的素材，点击取消" : "添加到素材"}>
                            <Button type="text" aria-label={savedToAsset ? "取消加入素材" : "添加到素材"} className={`${RESULT_OVERLAY_ICON_BUTTON_CLASS} ${savedToAsset ? "!bg-emerald-500/40 !text-white hover:!bg-emerald-500/55" : ""}`} size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => void onSaveAsset(video)} />
                        </Tooltip>
                        <Tooltip title="重新生成">
                            <Button type="text" aria-label="重新生成" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<RotateCcw className="size-3.5" />} onClick={onRegenerate} />
                        </Tooltip>
                        <Tooltip title="下载">
                            <Button type="text" aria-label="下载视频" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)} />
                        </Tooltip>
                        <Tooltip title="删除结果">
                            <Button type="text" aria-label="删除结果" className={RESULT_OVERLAY_DANGER_BUTTON_CLASS} size="small" icon={<Trash2 className="size-3.5" />} onClick={onDelete} />
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PendingVideoCard({ selected, onSelectedChange }: { selected: boolean; onSelectedChange: (checked: boolean) => void }) {
    return (
        <div className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
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
            <div className="flex aspect-square flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end gap-1.5 px-2 pb-2">
                <Tooltip title={retryLabel}>
                    <Button type="text" aria-label={retryLabel} className={RESULT_FAILED_ICON_BUTTON_CLASS} size="small" icon={<RotateCcw className="size-3.5" />} onClick={() => onRetry()} />
                </Tooltip>
                <Tooltip title="删除结果">
                    <Button type="text" aria-label="删除结果" className={RESULT_FAILED_ICON_BUTTON_CLASS} size="small" icon={<Trash2 className="size-3.5" />} onClick={onDelete} />
                </Tooltip>
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
    const [playbackUrl, setPlaybackUrl] = useState("");

    useEffect(() => {
        let objectUrl = "";
        let cancelled = false;
        setPlaying(false);
        setMuted(false);
        setPlaybackUrl(video?.url || "");
        if (!video?.storageKey) {
            return () => {
                cancelled = true;
            };
        }
        void getMediaBlob(video.storageKey).then((blob) => {
            if (cancelled || !blob) return;
            objectUrl = URL.createObjectURL(blob);
            setPlaybackUrl(objectUrl);
        });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [video?.id, video?.storageKey, video?.url]);

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

    const durationLabel = video ? videoDurationLabel(video) : "";

    return (
        <Modal title="视频播放" open={Boolean(video)} width={960} centered onCancel={onClose} footer={null} destroyOnHidden>
            {video ? (
                <div className="space-y-3">
                    <div className="overflow-hidden rounded-lg bg-black">
                        <video
                            key={`${video.id}:${playbackUrl || video.url}`}
                            ref={videoRef}
                            src={playbackUrl || video.url}
                            className="max-h-[72vh] w-full bg-black object-contain"
                            controls
                            autoPlay
                            playsInline
                            preload="auto"
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
                            {durationLabel ? <HistoryPill label="时长">{durationLabel}</HistoryPill> : null}
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
    onClose,
    onTogglePin,
    onPreviewLog,
}: {
    logs: GenerationLog[];
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onDeleteSelected: () => void;
    onClose?: () => void;
    onTogglePin: (log: GenerationLog) => void | Promise<void>;
    onPreviewLog: (log: GenerationLog) => void;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const filteredLogs = sortWorkbenchHistoryItems(logs.filter((log) => matchesWorkbenchPromptSearch(log.prompt || log.title || "", searchQuery)));
    const filteredLogIds = filteredLogs.map((log) => log.id);
    const allSelected = Boolean(filteredLogIds.length) && filteredLogIds.every((id) => selectedLogIds.includes(id));
    const [visibleCount, setVisibleCount] = useState(INITIAL_LOG_VISIBLE_COUNT);
    const visibleLogs = filteredLogs.slice(0, visibleCount);
    const hiddenCount = Math.max(0, filteredLogs.length - visibleLogs.length);
    const hasSearch = Boolean(searchQuery.trim());
    const visibleCountLabel = hasSearch ? `${filteredLogs.length}/${logs.length}` : logs.length;
    const toggleAll = () => {
        if (allSelected) {
            const filteredIdSet = new Set(filteredLogIds);
            onSelectedLogIdsChange(selectedLogIds.filter((id) => !filteredIdSet.has(id)));
            return;
        }
        onSelectedLogIdsChange(Array.from(new Set([...selectedLogIds, ...filteredLogIds])));
    };

    useEffect(() => {
        setVisibleCount(INITIAL_LOG_VISIBLE_COUNT);
    }, [logs.length, searchQuery]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">生成记录</h2>
                    <div className="flex items-center gap-2">
                        <HistoryPill>{visibleCountLabel}</HistoryPill>
                        {onClose ? (
                            <Button size="small" onClick={onClose}>
                                关闭
                            </Button>
                        ) : null}
                    </div>
                </div>
                <Input
                    className={HISTORY_SEARCH_INPUT_CLASS}
                    allowClear
                    size="small"
                    prefix={<Search className="size-3.5 text-stone-400" />}
                    placeholder="搜索提示词"
                    value={searchQuery}
                    onChange={(event) => {
                        setSearchQuery(event.target.value);
                        onSelectedLogIdsChange([]);
                    }}
                />
                <div className="mb-4 flex flex-wrap gap-2">
                    <Button size="small" icon={<Plus className="size-3.5" />} onClick={onCreateSession}>
                        新建
                    </Button>
                    <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!filteredLogs.length} onClick={toggleAll}>
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
                            onTogglePin={() => void onTogglePin(log)}
                            onClick={() => onPreviewLog(log)}
                        />
                    ))}
                    {hiddenCount ? (
                        <Button block size="small" onClick={() => setVisibleCount((value) => value + LOG_VISIBLE_BATCH_SIZE)}>
                            加载更多 {hiddenCount}
                        </Button>
                    ) : null}
                    {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">暂无生成记录</div> : null}
                    {hasSearch && !filteredLogs.length ? <HistorySearchEmptyState /> : null}
                </div>
            </div>
        </div>
    );
}

function HistorySearchEmptyState() {
    return <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">未找到匹配的生成记录</div>;
}

function LogCard({
    log,
    selected,
    active,
    onSelectedChange,
    onTogglePin,
    onClick,
}: {
    log: GenerationLog;
    selected: boolean;
    active: boolean;
    onSelectedChange: (checked: boolean) => void;
    onTogglePin: () => void;
    onClick: () => void;
}) {
    const promptPreview = log.prompt || log.title || "";
    const sizeLabel = videoSizeLabel(log.config.size || log.size, log.model);
    const resolutionLabel = videoResolutionBadge(log.config.vquality || log.resolution);
    const secondsLabel = videoSecondsBadge(log.config.videoSeconds || log.seconds);
    const videos = logVideos(log);
    const failCount = log.failures.length;
    const pendingCount = log.status === "生成中" ? 1 : 0;
    const requestCount = Math.max(1, videos.length + failCount + pendingCount);
    const coverVideo = log.video || videos[videos.length - 1];

    return (
        <div
            role="button"
            tabIndex={0}
            className={`relative block w-full cursor-pointer rounded-lg border p-2 text-left transition ${active ? "border-stone-200 bg-stone-100/80 dark:border-stone-800 dark:bg-stone-900/80" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onClick();
            }}
            title={promptPreview}
        >
            <Tooltip title={log.pinnedAt ? "取消置顶" : "置顶"}>
                <Button
                    type="text"
                    size="small"
                    aria-label={log.pinnedAt ? "取消置顶" : "置顶"}
                    className={`!absolute !right-3 !top-12 z-10 !inline-flex !size-7 !items-center !justify-center !rounded-full !border-0 !p-0 !shadow-sm [&_.ant-btn-icon]:!m-0 ${log.pinnedAt ? "!bg-stone-200/70 !text-stone-700 hover:!bg-stone-200/80 dark:!bg-stone-700/60 dark:!text-stone-100" : "!bg-white/80 !text-stone-500 hover:!bg-white dark:!bg-stone-950/80 dark:!text-stone-300"}`}
                    icon={<Pin className={`size-3.5 ${log.pinnedAt ? "fill-current" : ""}`} />}
                    onClick={(event) => {
                        event.stopPropagation();
                        onTogglePin();
                    }}
                />
            </Tooltip>
            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成记录" />
            <div className="grid min-h-[112px] grid-cols-[112px_minmax(0,1fr)] gap-2 sm:min-h-[136px] sm:grid-cols-[136px_minmax(0,1fr)] sm:gap-3">
                <div className="relative h-[112px] self-start sm:h-[136px]">
                    <LogVideoCover logId={log.id} video={coverVideo} status={log.status} sizeLabel={sizeLabel} resolutionLabel={resolutionLabel} />
                </div>
                <div className="flex min-w-0 flex-col py-1 pr-9">
                    <div className="line-clamp-2 text-sm leading-5 text-stone-600 dark:text-stone-300 sm:line-clamp-3">{promptPreview || compactLogTitle(log.model || "")}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                        <HistoryPill label="模型" className="max-w-full">
                            {log.model || "默认"}
                        </HistoryPill>
                        <HistoryPill label="模式">{videoModeLabel(log.config.videoCallMode)}</HistoryPill>
                        <HistoryPill label="比例">{sizeLabel}</HistoryPill>
                        <HistoryPill label="清晰度">{resolutionLabel}</HistoryPill>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1 pt-2">
                        <HistoryPill label="请求">{requestCount}</HistoryPill>
                        {videos.length ? <HistoryPill tone="success" label="成功">{videos.length}</HistoryPill> : null}
                        {log.status === "生成中" ? <HistoryPill tone="pending" label="生成中">1</HistoryPill> : null}
                        {failCount ? <HistoryPill tone="danger" label="失败">{failCount}</HistoryPill> : null}
                        <HistoryPill tone="info" label="耗时">
                            {formatDuration(log.durationMs)}
                        </HistoryPill>
                        <HistoryPill label="时长">{secondsLabel}</HistoryPill>
                        <HistoryPill label="时间">{log.time}</HistoryPill>
                    </div>
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
                void cacheVideoThumbnail(logId, video.id, nextThumbnail);
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
            className="relative grid h-full w-full place-items-center overflow-hidden rounded-md border border-stone-200 bg-stone-100 text-stone-400 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-500"
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
        return sortWorkbenchHistoryItems(await Promise.all(logs.map(normalizeLog)));
    } catch {
        return [];
    }
}

async function normalizeLog(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const config = normalizeLogConfig(log);
    const inferredVideoDurationMs = expectedVideoDurationMs({ config, seconds: log.seconds || config.videoSeconds });
    const normalizeStoredVideo = async (item: GeneratedVideo) => ({
        ...item,
        url: item.storageKey ? await resolveMediaUrl(item.storageKey, item.url) : item.url,
        thumbnail: normalizeVideoThumbnail(item.thumbnail),
        videoDurationMs: trustedVideoDurationMs(item) || inferredVideoDurationMs,
    });
    const video = log.video ? await normalizeStoredVideo(log.video) : log.video;
    const videos = dedupeVideos(await Promise.all(
        (Array.isArray(log.videos) && log.videos.length ? log.videos : video ? [video] : []).map(normalizeStoredVideo),
    ));
    const failures = normalizeVideoFailures(log.failures, !videos.length && log.error ? [{ id: log.id, error: log.error, durationMs: log.durationMs || 0 }] : []);
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
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        updatedAt: log.updatedAt || log.createdAt || Date.now(),
        pinnedAt: log.pinnedAt,
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
        video: videos[videos.length - 1] || video,
        videos,
        failures,
        error: log.error,
    };
}

function serializeLog(log: GenerationLog): GenerationLog {
    const videos = dedupeVideos(log.videos);
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        videoReferences: log.videoReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        audioReferences: log.audioReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        video: log.video?.storageKey ? { ...log.video, url: "" } : log.video,
        videos: videos.map((video) => (video.storageKey ? { ...video, url: "" } : video)),
        failures: normalizeVideoFailures(log.failures),
    };
}

async function findVideoLogIdForResult(resultId: string) {
    let matched = "";
    await logStore.iterate<GenerationLog, void>((value, key) => {
        if (matched) return;
        if (key === resultId || value?.video?.id === resultId || value?.videos?.some((video) => video.id === resultId) || value?.failures?.some((failure) => failure.id === resultId)) matched = key;
    });
    return matched;
}

async function deleteVideoResultFromLog(logId: string, result: GenerationResult) {
    const stored = await logStore.getItem<GenerationLog>(logId);
    if (!stored) return null;
    const log = await normalizeLog(stored);
    let nextVideos = logVideos(log);
    let nextFailures = log.failures;
    let removedVideos: GeneratedVideo[] = [];

    if (result.video) {
        const targetVideoKey = videoIdentityKey(result.video);
        removedVideos = nextVideos.filter((video) => videoIdentityKey(video) === targetVideoKey);
        nextVideos = nextVideos.filter((video) => videoIdentityKey(video) !== targetVideoKey);
    } else if (result.status === "failed") {
        const targetFailureKey = resultIdentityKey(result);
        nextFailures = nextFailures.filter((failure) => resultIdentityKey({ id: failure.id, status: "failed", error: failure.error }) !== targetFailureKey);
    }

    const removedKeys = removedVideos.map((video) => video.storageKey).filter((key): key is string => Boolean(key));
    if (removedKeys.length) await deleteStoredMedia(removedKeys);
    if (!nextVideos.length && !nextFailures.length && log.status !== "生成中") {
        await logStore.removeItem(logId);
        return null;
    }
    const nextLog: GenerationLog = {
        ...log,
        updatedAt: Date.now(),
        video: nextVideos[nextVideos.length - 1],
        videos: nextVideos,
        failures: nextFailures,
        status: nextVideos.length ? "成功" : log.status === "生成中" ? "生成中" : "失败",
        error: nextVideos.length ? undefined : nextFailures[0]?.error,
    };
    await logStore.setItem(logId, serializeLog(nextLog));
    return nextLog;
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

function logVideos(log?: Partial<GenerationLog> | null) {
    if (!log) return [];
    return dedupeVideos(Array.isArray(log.videos) && log.videos.length ? log.videos : log.video ? [log.video] : []);
}

function resultsFromVideoLog(log: GenerationLog, current: GenerationResult[] = []) {
    const videos = logVideos(log);
    const failures = log.failures || [];
    const storedIds = new Set([...videos.map((video) => video.id), ...failures.map((failure) => failure.id)]);
    const pending = current.filter((item) => item.status === "pending" && !storedIds.has(item.id));
    return [
        ...videos.map((video) => ({ id: video.id, status: "success" as const, video })),
        ...failures.map((failure) => ({ id: failure.id, status: "failed" as const, error: failure.error })),
        ...(pending.length ? pending : log.status === "生成中" ? [{ id: log.id, status: "pending" as const }] : []),
    ];
}

function normalizeVideoFailures(failures?: Partial<GeneratedFailure>[], fallback: Partial<GeneratedFailure>[] = []) {
    return (failures?.length ? failures : fallback).map((item) => ({
        id: item.id || nanoid(),
        error: item.error || "生成失败",
        durationMs: item.durationMs || 0,
    }));
}

function appendVideoToLog(log: GenerationLog, video: GeneratedVideo): GenerationLog {
    const videoKey = videoIdentityKey(video);
    const videos = dedupeVideos([...logVideos(log).filter((item) => item.id !== video.id && videoIdentityKey(item) !== videoKey), video]);
    return {
        ...log,
        status: "成功",
        updatedAt: Date.now(),
        durationMs: log.durationMs + video.durationMs,
        video,
        videos,
        error: undefined,
    };
}

function appendFailureToVideoLog(log: GenerationLog, failure: GeneratedFailure): GenerationLog {
    const failures = [...(log.failures || []).filter((item) => item.id !== failure.id), failure];
    const videos = logVideos(log);
    return {
        ...log,
        status: videos.length ? "成功" : "失败",
        updatedAt: Date.now(),
        durationMs: log.durationMs + failure.durationMs,
        video: videos[videos.length - 1],
        videos,
        failures,
        error: videos.length ? undefined : failure.error,
    };
}

function ReferenceOrderButtons({ index, total, onMove }: { index: number; total: number; onMove: (offset: number) => void }) {
    if (total <= 1) return null;
    return (
        <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
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
    createdAt,
    pinnedAt,
    time,
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
    videos = [],
    failures = [],
    error,
}: {
    id?: string;
    createdAt?: number;
    pinnedAt?: number;
    time?: string;
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
    videos?: GeneratedVideo[];
    failures?: GeneratedFailure[];
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
    const nextVideos = dedupeVideos(video ? [...videos, video] : videos);
    return {
        id: id || nanoid(),
        createdAt: createdAt || Date.now(),
        updatedAt: Date.now(),
        pinnedAt,
        title: prompt.slice(0, 12) || "未命名",
        prompt,
        time: time || new Date().toLocaleString("zh-CN", { hour12: false }),
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
        video: video || nextVideos[nextVideos.length - 1],
        videos: nextVideos,
        failures: normalizeVideoFailures(failures),
        error,
    };
}

function videoIdentityKey(video: Pick<GeneratedVideo, "id" | "storageKey" | "url">) {
    return video.storageKey || video.url || video.id || "";
}

function resultIdentityKey(result: GenerationResult) {
    if (result.video) return `video:${videoIdentityKey(result.video)}`;
    if (result.status === "failed") return `failed:${result.id}:${result.error || ""}`;
    return `pending:${result.id}`;
}

function dedupeGenerationResults(results: GenerationResult[]) {
    const seen = new Set<string>();
    return results.filter((result) => {
        const key = resultIdentityKey(result);
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function dedupeVideos(videos: GeneratedVideo[]) {
    const seen = new Set<string>();
    return videos.filter((video) => {
        const key = videoIdentityKey(video);
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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

function expectedVideoDurationMs(source: { config?: Partial<GenerationLogConfig>; seconds?: string }) {
    const raw = String(source.config?.videoSeconds || source.seconds || "").trim();
    if (!raw || raw === "-1") return undefined;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60) return undefined;
    return Math.round(seconds * 1000);
}

function trustedVideoDurationMs(video: Pick<GeneratedVideo, "videoDurationMs">) {
    const value = Number(video.videoDurationMs || 0);
    return Number.isFinite(value) && value > 0 && value <= 60_000 ? value : undefined;
}

function videoDurationLabel(video: Pick<GeneratedVideo, "videoDurationMs">) {
    const durationMs = trustedVideoDurationMs(video);
    return durationMs ? formatDuration(durationMs) : "";
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

async function cacheVideoThumbnail(logId: string, videoId: string, thumbnail: string) {
    const normalized = normalizeVideoThumbnail(thumbnail);
    if (!normalized) return;
    try {
        const log = await logStore.getItem<GenerationLog>(logId);
        if (!log?.video && !log?.videos?.length) return;
        const videos = (log.videos || []).map((video) => (video.id === videoId ? { ...video, thumbnail: normalized } : video));
        const video = log.video && (!videoId || log.video.id === videoId) ? { ...log.video, thumbnail: normalized } : log.video;
        await logStore.setItem(logId, { ...log, video, videos });
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
    let matched = false;
    const updated = results.map((item) => {
        if (item.id !== id) return item;
        matched = true;
        return { ...item, ...next };
    });
    return matched ? updated : [...updated, { id, status: next.status || "pending", ...next } as GenerationResult];
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
