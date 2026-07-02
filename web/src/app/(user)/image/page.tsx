"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, ClipboardPaste, Download, FolderPlus, History, ImagePlus, LoaderCircle, PenLine, Plus, SlidersHorizontal, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { App, Button, Checkbox, Drawer, Empty, Image, Input, Modal, Tooltip, Typography } from "antd";
import localforage from "localforage";
import { saveAs } from "file-saver";

import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { canvasThemes } from "@/lib/canvas-theme";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { modelOptionLabel, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { nanoid } from "nanoid";
import { AZURE_IMAGE_EDIT_ACCEPT, formatBytes, formatDuration, getDataUrlByteSize, readImageMeta, validateAzureImageEditFile } from "@/lib/image-utils";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { recordDeletedSyncIds } from "@/services/app-sync";
import { deleteStoredImages, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import type { ReferenceImage } from "@/types/image";

type GeneratedImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType?: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    image?: GeneratedImage;
    error?: string;
};

type GeneratedFailure = {
    id: string;
    error: string;
    durationMs: number;
};

type RunningSession = {
    startedAt: number;
    count: number;
};

type WorkbenchSession = {
    id: string;
    createdAt: number;
    requestCount: number;
    prompt: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
};

type WorkbenchSessionView = WorkbenchSession & {
    running?: RunningSession;
    requestCount: number;
    successCount: number;
    failCount: number;
    pendingCount: number;
    imageCount: number;
    firstImage?: GeneratedImage;
};

type GenerationLog = {
    id: string;
    sessionId?: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    imageCount: number;
    size: string;
    quality: string;
    status: "成功" | "失败";
    images: GeneratedImage[];
    failures: GeneratedFailure[];
    thumbnails: string[];
};

type GenerationLogConfig = Pick<AiConfig, "model" | "imageModel" | "quality" | "size" | "count">;

const IMAGE_REFERENCE_LIMIT = 5;
const INITIAL_LOG_VISIBLE_COUNT = 60;
const LOG_VISIBLE_BATCH_SIZE = 60;
const LOG_THUMBNAIL_SIZE = 512;
const LOG_THUMBNAIL_MIN_RENDER_EDGE = 320;
const LOG_THUMBNAIL_MAX_DATA_URL_LENGTH = 700_000;
const LOG_THUMBNAIL_QUALITY = 0.84;

type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;

const LOG_STORE_KEY = "infinite-canvas:image_generation_logs";
const RESULT_ACTION_BUTTON_CLASS = "min-w-0 px-1.5 [&_.ant-btn-icon]:shrink-0 [&>span:last-child]:min-w-0 [&>span:last-child]:truncate";
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });

export default function ImagePage() {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewRequestIdRef = useRef(0);
    const deletedResultIdsRef = useRef<Set<string>>(new Set());
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const [prompt, setPrompt] = useState("");
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [activeSessionId, setActiveSessionId] = useState(() => nanoid());
    const [resultsBySession, setResultsBySession] = useState<Record<string, GenerationResult[]>>({});
    const [sessionsById, setSessionsById] = useState<Record<string, WorkbenchSession>>({});
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [runningBySession, setRunningBySession] = useState<Record<string, RunningSession>>({});
    const [logsOpen, setLogsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [resultDeleteTargets, setResultDeleteTargets] = useState<GenerationResult[]>([]);

    const model = effectiveConfig.imageModel || effectiveConfig.model;
    const canGenerate = Boolean(prompt.trim());
    const generationCount = Math.max(1, Math.min(15, Number(config.count) || 1));
    const results = resultsBySession[activeSessionId] || [];
    const selectedResults = results.filter((result) => selectedResultIds.includes(result.id));
    const allResultsSelected = Boolean(results.length) && selectedResultIds.length === results.length;
    const activeRunning = runningBySession[activeSessionId];
    const running = Boolean(activeRunning);
    const runningCount = activeRunning?.count || 0;
    const workbenchSessions: WorkbenchSessionView[] = Object.values(sessionsById)
        .map((session) => {
            const sessionResults = resultsBySession[session.id] || [];
            const successImages = sessionResults.filter((item) => item.status === "success" && item.image).map((item) => item.image as GeneratedImage);
            const failCount = sessionResults.filter((item) => item.status === "failed").length;
            const pendingCount = sessionResults.filter((item) => item.status === "pending").length;
            return {
                ...session,
                running: runningBySession[session.id],
                requestCount: session.requestCount || sessionResults.length,
                successCount: successImages.length,
                failCount,
                pendingCount,
                imageCount: successImages.length,
                firstImage: successImages[0],
            };
        })
        .filter((session) => session.running || session.requestCount || session.id === activeSessionId)
        .sort((a, b) => b.createdAt - a.createdAt);

    useEffect(() => {
        if (!activeRunning?.startedAt) {
            setElapsedMs(0);
            return;
        }
        const timer = window.setInterval(() => setElapsedMs(performance.now() - activeRunning.startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [activeRunning?.startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, []);

    useEffect(() => {
        setSelectedResultIds((ids) => {
            if (!ids.length) return ids;
            const available = new Set(results.map((result) => result.id));
            const next = ids.filter((id) => available.has(id));
            return next.length === ids.length ? ids : next;
        });
    }, [results]);

    const updateSessionResults = (sessionId: string, updater: (value: GenerationResult[]) => GenerationResult[]) => {
        setResultsBySession((value) => ({ ...value, [sessionId]: updater(value[sessionId] || []) }));
    };

    const rememberWorkbenchSession = (sessionId: string, next: Omit<WorkbenchSession, "id" | "createdAt" | "requestCount">, requestCountDelta = 0) => {
        setSessionsById((value) => ({
            ...value,
            [sessionId]: {
                id: sessionId,
                createdAt: value[sessionId]?.createdAt || Date.now(),
                requestCount: (value[sessionId]?.requestCount || 0) + requestCountDelta,
                ...next,
                references: next.references.slice(0, IMAGE_REFERENCE_LIMIT),
            },
        }));
    };

    const startSessionRun = (sessionId: string, startedAt: number) => {
        setRunningBySession((value) => {
            const current = value[sessionId];
            return { ...value, [sessionId]: { startedAt: current?.startedAt || startedAt, count: (current?.count || 0) + 1 } };
        });
    };

    const finishSessionRun = (sessionId: string) => {
        setRunningBySession((value) => {
            const current = value[sessionId];
            if (!current) return value;
            if (current.count > 1) return { ...value, [sessionId]: { ...current, count: current.count - 1 } };
            const next = { ...value };
            delete next[sessionId];
            return next;
        });
    };

    const addReferences = async (files?: FileList | null) => {
        const imageFiles: File[] = [];
        for (const file of Array.from(files || [])) {
            if (imageFiles.length >= Math.max(0, IMAGE_REFERENCE_LIMIT - references.length)) break;
            try {
                await validateAzureImageEditFile(file, { index: imageFiles.length + references.length + 1 });
                imageFiles.push(file);
            } catch (error) {
                message.warning(error instanceof Error ? error.message : "已忽略不支持的参考图");
            }
        }
        const nextReferences = await Promise.all(
            imageFiles.map(async (file) => {
                const image = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }),
        );
        setReferences((value) => [...value, ...nextReferences].slice(0, IMAGE_REFERENCE_LIMIT));
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的图片");
                return;
            }
            const validBlobs: Blob[] = [];
            for (const blob of blobs) {
                if (validBlobs.length >= Math.max(0, IMAGE_REFERENCE_LIMIT - references.length)) break;
                try {
                    await validateAzureImageEditFile(blob, { index: validBlobs.length + references.length + 1 });
                    validBlobs.push(blob);
                } catch (error) {
                    message.warning(error instanceof Error ? error.message : "已忽略不支持的参考图");
                }
            }
            if (!validBlobs.length) return;
            const nextReferences = await Promise.all(
                validBlobs.map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, IMAGE_REFERENCE_LIMIT));
            message.success(`已读取 ${nextReferences.length} 张参考图`);
        } catch {
            message.error("剪切板里没有可读取的图片");
        }
    };

    const generate = () => {
        const text = prompt.trim();
        if (!text) {
            message.error("请输入生图提示词");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning("请先完成配置");
            openConfigDialog(true);
            return;
        }

        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;

        const sessionId = activeSessionId;
        rememberWorkbenchSession(sessionId, {
            prompt: text,
            model,
            config: { ...snapshot.config, count: String(generationCount) },
            references: snapshot.references,
        }, generationCount);
        if (!runningBySession[sessionId]) setElapsedMs(0);
        setPreviewLog(null);
        setSelectedResultIds([]);
        const pendingResults = Array.from({ length: generationCount }, () => ({ id: nanoid(), status: "pending" as const }));
        updateSessionResults(sessionId, (value) => [...value, ...pendingResults]);
        const batchStartedAt = performance.now();
        startSessionRun(sessionId, batchStartedAt);

        const tasks = pendingResults.map((item) =>
            runGenerationSlot(sessionId, item.id, snapshot).then(
                (image) => ({ resultId: item.id, status: "success" as const, image }),
                (error) => ({ resultId: item.id, status: "failed" as const, error: error instanceof Error ? error.message : "生成失败" }),
            ),
        );
        void finishGenerationBatch({ sessionId, text, model, snapshot, generationCount, batchStartedAt, tasks });
    };

    const finishGenerationBatch = async ({
        sessionId,
        text,
        model,
        snapshot,
        generationCount,
        batchStartedAt,
        tasks,
    }: {
        sessionId: string;
        text: string;
        model: string;
        snapshot: { text: string; config: AiConfig; references: ReferenceImage[] };
        generationCount: number;
        batchStartedAt: number;
        tasks: Array<Promise<{ resultId: string; status: "success"; image: GeneratedImage } | { resultId: string; status: "failed"; error: string }>>;
    }) => {
        const result = await Promise.all(tasks);
        const visibleResults = result.filter((item) => !deletedResultIdsRef.current.has(item.resultId));
        const successImages = visibleResults.filter((item): item is { resultId: string; status: "success"; image: GeneratedImage } => item.status === "success").map((item) => item.image);
        const failures = visibleResults
            .filter((item): item is { resultId: string; status: "failed"; error: string } => item.status === "failed")
            .map((item) => ({ id: item.resultId, error: item.error, durationMs: performance.now() - batchStartedAt }));
        const successCount = successImages.length;
        const failCount = failures.length;
        const failed = result.find((item): item is { resultId: string; status: "failed"; error: string } => item.status === "failed");
        const durationMs = performance.now() - batchStartedAt;
        finishSessionRun(sessionId);
        successCount ? message.success("图片已生成") : message.error(failed?.error || "生成失败");

        void (async () => {
            const logImages = await Promise.all(
                successImages.map(async (image) => {
                    const stored = await uploadImage(image.dataUrl);
                    return { ...image, dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType };
                }),
            );
            const thumbnails = await createLogThumbnails(logImages);
            if (!logImages.length && !failures.length) return;
            saveLog(
                buildLog({
                    sessionId,
                    prompt: text,
                    model,
                    config: { ...snapshot.config, count: String(generationCount) },
                    references: snapshot.references,
                    durationMs,
                    successCount,
                    failCount,
                    status: successCount ? "成功" : "失败",
                    images: logImages,
                    failures,
                    thumbnails,
                }),
            );
        })().catch(() => message.warning("生成记录保存失败"));
    };

    const downloadImage = (image: GeneratedImage, index: number) => {
        saveAs(image.dataUrl, `image-${index + 1}.png`);
    };

    const addResultToReferences = async (image: GeneratedImage, index: number) => {
        const stored = await uploadImage(image.dataUrl);
        setReferences((value) => [...value, { id: nanoid(), name: `result-${index + 1}.png`, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, IMAGE_REFERENCE_LIMIT));
        message.success("已加入参考图");
    };

    const saveResultToAssets = async (image: GeneratedImage, index: number) => {
        const stored = await uploadImage(image.dataUrl);
        addAsset({
            kind: "image",
            title: `生成结果 ${index + 1}`,
            coverUrl: stored.url,
            tags: [],
            source: "生图工作台",
            data: { dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType },
            metadata: { source: "image-page", prompt },
        });
        message.success("已加入我的素材");
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, IMAGE_REFERENCE_LIMIT));
        } else {
            message.warning("生图工作台只能使用文本或图片素材");
        }
        setAssetPickerOpen(false);
    };

    const createSession = () => {
        previewRequestIdRef.current += 1;
        const sessionId = nanoid();
        setActiveSessionId(sessionId);
        setPrompt("");
        setReferences([]);
        setElapsedMs(0);
        setSelectedLogIds([]);
        setSelectedResultIds([]);
        setPreviewLog(null);
    };

    const deleteSelectedLogs = async () => {
        previewRequestIdRef.current += 1;
        const ids = [...selectedLogIds];
        const imageKeys = logs.filter((log) => ids.includes(log.id)).flatMap((log) => log.images.map((image) => image.storageKey).filter((key): key is string => Boolean(key)));
        await recordDeletedSyncIds("image-workbench", ids);
        await Promise.all([deleteStoredImages(imageKeys), ...ids.map((id) => logStore.removeItem(id))]);
        if (previewLog && ids.includes(previewLog.id)) {
            setPreviewLog(null);
            updateSessionResults(activeSessionId, () => []);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
        await refreshLogs();
    };

    const deleteResult = async (result: GenerationResult) => {
        deletedResultIdsRef.current.add(result.id);
        updateSessionResults(activeSessionId, (value) => value.filter((item) => item.id !== result.id));
        const logId = previewLog?.id || (await findLogIdForSession(activeSessionId));
        if (logId) {
            const nextLog = await deleteResultFromLog(logId, result);
            if (!nextLog) await recordDeletedSyncIds("image-workbench", [logId]);
            if (previewLog?.id === logId) setPreviewLog(nextLog);
            await refreshLogs();
            return;
        }
        if (result.image?.storageKey) await deleteStoredImages([result.image.storageKey]);
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

    const saveLog = (log: GenerationLog) => {
        void logStore.setItem(log.id, serializeLog(log)).then(refreshLogs);
    };

    const refreshLogs = async () => setLogs(await readStoredLogs());

    const previewGenerationLog = async (log: GenerationLog) => {
        const requestId = (previewRequestIdRef.current += 1);
        const sessionId = `log:${log.id}`;
        setActiveSessionId(sessionId);
        setPreviewLog(log);
        setSelectedResultIds([]);
        setLogsOpen(false);
        const hydratedLog = await hydrateLogMedia(log);
        if (requestId !== previewRequestIdRef.current) return;
        setPreviewLog(hydratedLog);
        setPrompt(hydratedLog.prompt);
        setReferences((hydratedLog.references || []).slice(0, IMAGE_REFERENCE_LIMIT));
        if (hydratedLog.config.imageModel || hydratedLog.model) updateConfig("imageModel", hydratedLog.config.imageModel || hydratedLog.model);
        if (hydratedLog.config.quality) updateConfig("quality", hydratedLog.config.quality);
        if (hydratedLog.config.size) updateConfig("size", hydratedLog.config.size);
        if (hydratedLog.config.count) updateConfig("count", hydratedLog.config.count);
        updateSessionResults(sessionId, () => [
            ...hydratedLog.images.map((image) => ({ id: image.id, status: "success" as const, image })),
            ...hydratedLog.failures.map((failure) => ({ id: failure.id, status: "failed" as const, error: failure.error })),
        ]);
    };

    const previewWorkbenchSession = (session: WorkbenchSession) => {
        previewRequestIdRef.current += 1;
        setActiveSessionId(session.id);
        setPreviewLog(null);
        setSelectedResultIds([]);
        setLogsOpen(false);
        setPrompt(session.prompt);
        setReferences(session.references.slice(0, IMAGE_REFERENCE_LIMIT));
        if (session.config.imageModel || session.model) updateConfig("imageModel", session.config.imageModel || session.model);
        if (session.config.quality) updateConfig("quality", session.config.quality);
        if (session.config.size) updateConfig("size", session.config.size);
        if (session.config.count) updateConfig("count", session.config.count);
    };

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            message.error("请输入生图提示词");
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning("请先完成配置");
            openConfigDialog(true);
            return null;
        }
        return { text, config: { ...effectiveConfig, model, count: "1" }, references: [...references] };
    };

    const runGenerationSlot = async (sessionId: string, resultId: string, snapshot: { text: string; config: AiConfig; references: ReferenceImage[] }) => {
        const itemStartedAt = performance.now();
        try {
            const result = snapshot.references.length ? await requestEdit(snapshot.config, snapshot.text, snapshot.references) : await requestGeneration(snapshot.config, snapshot.text);
            const image = result[0];
            if (!image) throw new Error("接口没有返回图片");
            const meta = await readImageMeta(image.dataUrl);
            const nextImage = { id: image.id, dataUrl: image.dataUrl, durationMs: performance.now() - itemStartedAt, width: meta.width, height: meta.height, bytes: getDataUrlByteSize(image.dataUrl) };
            updateSessionResults(sessionId, (value) => updateResultById(value, resultId, { status: "success", image: nextImage }));
            return nextImage;
        } catch (error) {
            updateSessionResults(sessionId, (value) => updateResultById(value, resultId, { status: "failed", error: error instanceof Error ? error.message : "生成失败" }));
            throw error;
        }
    };

    const retryResult = (index: number) => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        setPreviewLog(null);
        const sessionId = activeSessionId;
        const resultId = results[index]?.id;
        if (!resultId) return;
        if (!runningBySession[sessionId]) setElapsedMs(0);
        if (sessionsById[sessionId]) setSessionsById((value) => ({ ...value, [sessionId]: { ...value[sessionId], requestCount: (value[sessionId].requestCount || 0) + 1 } }));
        updateSessionResults(sessionId, (value) => updateResultById(value, resultId, { status: "pending", error: undefined, image: undefined }));
        startSessionRun(sessionId, performance.now());
        void runGenerationSlot(sessionId, resultId, snapshot)
            .catch(() => {})
            .finally(() => finishSessionRun(sessionId));
    };

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            <main className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[460px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[520px_minmax(0,1fr)]">
                <aside className="hidden h-full min-h-0 overflow-hidden rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:block">
                    <LogPanel
                        sessions={workbenchSessions}
                        logs={logs}
                        activeSessionId={activeSessionId}
                        selectedLogIds={selectedLogIds}
                        activeLogId={previewLog?.id}
                        onSelectedLogIdsChange={setSelectedLogIds}
                        onCreateSession={createSession}
                        onDeleteSelected={() => setDeleteConfirmOpen(true)}
                        onPreviewSession={previewWorkbenchSession}
                        onPreviewLog={(log) => void previewGenerationLog(log)}
                    />
                </aside>

                <section className="grid h-full min-h-0 gap-3 lg:overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
                    <div className="flex h-full min-h-0 flex-col rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800">
                        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                            <div>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">生图工作台</h1>
                                    </div>
                                    <div className="flex shrink-0 gap-2 lg:hidden">
                                        <Button icon={<History className="size-4" />} onClick={() => setLogsOpen(true)}>
                                            记录
                                        </Button>
                                        <Button icon={<SlidersHorizontal className="size-4" />} onClick={() => setSettingsOpen(true)}>
                                            参数
                                        </Button>
                                    </div>
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
                                    <Input.TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} placeholder="描述画面主体、风格、构图、光线和用途" />
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
                                    <div
                                        className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700"
                                        onWheel={(event) => {
                                            if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
                                            event.preventDefault();
                                            event.currentTarget.scrollLeft += event.deltaY;
                                        }}
                                    >
                                        {references.map((item, index) => (
                                            <div key={item.id} className="group relative size-20 shrink-0 overflow-hidden rounded-md border border-stone-200 dark:border-stone-800">
                                                <img src={item.dataUrl} alt={item.name} className="size-full object-cover" />
                                                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{imageReferenceLabel(index)}</span>
                                                <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => setReferences((value) => moveListItem(value, index, offset))} />
                                                <button
                                                    type="button"
                                                    className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex"
                                                    onClick={() => setReferences((value) => value.filter((ref) => ref.id !== item.id))}
                                                    aria-label="移除参考图"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {!references.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考图，最多 5 张，PNG/JPG，单张 50MB 内</div> : null}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900 sm:hidden">
                                    <span className="truncate text-stone-500 dark:text-stone-400">
                                        {modelOptionLabel(effectiveConfig, model)} · {effectiveConfig.size} · {effectiveConfig.quality}
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
                            <Button type="primary" size="large" block icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={generate}>
                                开始生成
                            </Button>
                        </div>
                    </div>

                    <div className="thin-scrollbar h-full min-h-0 rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:overflow-y-auto lg:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-semibold">生成结果</h2>
                            </div>
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
                                        {runningCount > 1 ? ` · ${runningCount} 批` : ""}
                                    </HistoryPill>
                                ) : null}
                            </div>
                        </div>
                        {results.length ? (
                            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                                {results.map((result, index) =>
                                    result.status === "success" && result.image ? (
                                        <ResultImageCard key={result.id} image={result.image} index={index} selected={selectedResultIds.includes(result.id)} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} onEdit={addResultToReferences} onDownload={downloadImage} onSaveAsset={saveResultToAssets} onDelete={() => requestDeleteResults([result])} />
                                    ) : result.status === "failed" ? (
                                        <FailedImageCard key={result.id} error={result.error || "生成失败"} selected={selectedResultIds.includes(result.id)} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} onRetry={() => retryResult(index)} onDelete={() => requestDeleteResults([result])} />
                                    ) : (
                                        <PendingImageCard key={result.id} selected={selectedResultIds.includes(result.id)} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} />
                                    ),
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-center dark:border-stone-700 lg:min-h-[560px]">
                                <ImagePlus className="mb-4 size-11 text-stone-400" />
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有生成图片" />
                            </div>
                        )}
                    </div>
                </section>
            </main>
            <input
                ref={fileInputRef}
                type="file"
                accept={AZURE_IMAGE_EDIT_ACCEPT}
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <Drawer title="生成记录" placement="bottom" size="large" open={logsOpen} onClose={() => setLogsOpen(false)}>
                <LogPanel
                    sessions={workbenchSessions}
                    logs={logs}
                    activeSessionId={activeSessionId}
                    selectedLogIds={selectedLogIds}
                    activeLogId={previewLog?.id}
                    onSelectedLogIdsChange={setSelectedLogIds}
                    onCreateSession={createSession}
                    onDeleteSelected={() => setDeleteConfirmOpen(true)}
                    onPreviewSession={previewWorkbenchSession}
                    onPreviewLog={(log) => void previewGenerationLog(log)}
                />
            </Drawer>
            <Drawer title="参数" placement="bottom" size="82vh" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <div className="grid grid-cols-2 gap-3 pb-4">
                    <GenerationSettings config={effectiveConfig} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
                </div>
            </Drawer>
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal title="删除生成结果" open={Boolean(resultDeleteTargets.length)} onCancel={() => setResultDeleteTargets([])} onOk={() => void confirmDeleteResults()} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {resultDeleteTargets.length} 个生成结果吗？成功图片会同步删除本地媒体文件。
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
                <ModelPicker config={config} value={model} onChange={(value) => updateConfig("imageModel", value)} capability="image" fullWidth onMissingConfig={() => openConfigDialog(false)} />
            </label>
            <div className="col-span-2">
                <ImageSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-4" />
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

function ResultImageCard({
    image,
    index,
    selected,
    onSelectedChange,
    onEdit,
    onDownload,
    onSaveAsset,
    onDelete,
}: {
    image: GeneratedImage;
    index: number;
    selected: boolean;
    onSelectedChange: (checked: boolean) => void;
    onEdit: (image: GeneratedImage, index: number) => void;
    onDownload: (image: GeneratedImage, index: number) => void;
    onSaveAsset: (image: GeneratedImage, index: number) => void;
    onDelete: () => void;
}) {
    const [resolvedUrl, setResolvedUrl] = useState(image.dataUrl);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setResolvedUrl(image.dataUrl);
        setLoadFailed(false);
        if (image.dataUrl) return;
        if (!image.storageKey) {
            setLoadFailed(true);
            return;
        }
        void resolveImageUrl(image.storageKey).then((url) => {
            if (cancelled) return;
            setResolvedUrl(url);
            setLoadFailed(!url);
        });
        return () => {
            cancelled = true;
        };
    }, [image.dataUrl, image.id, image.storageKey]);

    const displayImage = resolvedUrl && !loadFailed ? { ...image, dataUrl: resolvedUrl } : null;

    return (
        <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <div className="absolute right-3 top-3 z-10 rounded-md bg-white/95 p-1 shadow-sm ring-1 ring-stone-200 dark:bg-stone-950/90 dark:ring-stone-700">
                <Checkbox checked={selected} onChange={(event) => onSelectedChange(event.target.checked)} aria-label="选择生成结果" />
            </div>
            {displayImage ? (
                <Image src={displayImage.dataUrl} alt={`生成结果 ${index + 1}`} className="aspect-square object-cover" onError={() => setLoadFailed(true)} />
            ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-stone-50 p-5 text-center text-sm text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                    {loadFailed ? <ImagePlus className="size-8 opacity-70" /> : <LoaderCircle className="size-6 animate-spin opacity-60" />}
                    <span>{loadFailed ? "图片文件缺失" : "正在读取图片"}</span>
                </div>
            )}
            <div className="space-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {image.width}x{image.height}
                    </span>
                    <span>{formatBytes(image.bytes)}</span>
                    <span>{formatDuration(image.durationMs)}</span>
                </div>
                <div className="grid min-w-0 grid-cols-4 gap-2">
                    <Tooltip title="添加到素材">
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<FolderPlus className="size-3.5" />} disabled={!displayImage} onClick={() => displayImage && void onSaveAsset(displayImage, index)}>
                            素材
                        </Button>
                    </Tooltip>
                    <Tooltip title="加入参考图">
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<PenLine className="size-3.5" />} disabled={!displayImage} onClick={() => displayImage && void onEdit(displayImage, index)}>
                            参考
                        </Button>
                    </Tooltip>
                    <Tooltip title="下载">
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<Download className="size-3.5" />} disabled={!displayImage} onClick={() => displayImage && onDownload(displayImage, index)}>
                            下载
                        </Button>
                    </Tooltip>
                    <Tooltip title="删除结果">
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                            删除
                        </Button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

function PendingImageCard({ selected, onSelectedChange }: { selected: boolean; onSelectedChange: (checked: boolean) => void }) {
    return (
        <div className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div className="absolute right-3 top-3 z-10 rounded-md bg-white/95 p-1 shadow-sm ring-1 ring-stone-200 dark:bg-stone-950/90 dark:ring-stone-700">
                <Checkbox checked={selected} onChange={(event) => onSelectedChange(event.target.checked)} aria-label="选择生成结果" />
            </div>
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.35) 1.4px, transparent 1.6px)",
                    backgroundSize: "16px 16px",
                }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <LoaderCircle className="size-6 animate-spin" />
                <span>生成中</span>
            </div>
        </div>
    );
}

function FailedImageCard({ error, selected, onSelectedChange, onRetry, onDelete }: { error: string; selected: boolean; onSelectedChange: (checked: boolean) => void; onRetry: () => void; onDelete: () => void }) {
    return (
        <div className="relative overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="absolute right-3 top-3 z-10 rounded-md bg-white/95 p-1 shadow-sm ring-1 ring-stone-200 dark:bg-stone-950/90 dark:ring-stone-700">
                <Checkbox checked={selected} onChange={(event) => onSelectedChange(event.target.checked)} aria-label="选择生成结果" />
            </div>
            <div className="flex aspect-square flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end gap-2 border-t border-red-200 p-3 dark:border-red-950">
                <Button size="small" onClick={onRetry}>
                    重试
                </Button>
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                    删除
                </Button>
            </div>
        </div>
    );
}

function updateResultById(results: GenerationResult[], id: string, next: Partial<GenerationResult>) {
    return results.map((item) => (item.id === id ? { ...item, ...next } : item));
}

function LogPanel({
    sessions,
    logs,
    activeSessionId,
    selectedLogIds,
    activeLogId,
    onSelectedLogIdsChange,
    onCreateSession,
    onDeleteSelected,
    onPreviewSession,
    onPreviewLog,
}: {
    sessions: WorkbenchSessionView[];
    logs: GenerationLog[];
    activeSessionId: string;
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onDeleteSelected: () => void;
    onPreviewSession: (session: WorkbenchSession) => void;
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
                    <div>
                        <h2 className="text-base font-semibold">生成记录</h2>
                    </div>
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
                {sessions.length ? (
                    <div className="mb-5">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                            <span>当前会话</span>
                            <HistoryPill>{sessions.length}</HistoryPill>
                        </div>
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <SessionCard key={session.id} session={session} active={!activeLogId && activeSessionId === session.id} onClick={() => onPreviewSession(session)} />
                            ))}
                        </div>
                    </div>
                ) : null}
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
                    {!logs.length && !sessions.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">暂无生成记录</div> : null}
                </div>
            </div>
        </div>
    );
}

function SessionCard({ session, active, onClick }: { session: WorkbenchSessionView; active: boolean; onClick: () => void }) {
    const displayTitle = compactLogTitle(session.prompt || session.model || "");
    const promptPreview = session.prompt || session.model || "";
    const ratioLabel = imageRatioLabel(session.config.size);
    const sizeLabel = imageSizeLabel(session.config.size);

    return (
        <button
            type="button"
            className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`}
            onClick={onClick}
            title={promptPreview}
        >
            <div className="grid min-h-[184px] grid-cols-[176px_minmax(0,1fr)] gap-3 xl:min-h-[204px] xl:grid-cols-[200px_minmax(0,1fr)]">
                <SessionCover image={session.firstImage} pending={Boolean(session.running || session.pendingCount)} count={session.successCount} ratioLabel={ratioLabel} sizeLabel={sizeLabel} />
                <div className="flex min-w-0 flex-col py-1">
                    <div className="line-clamp-3 text-base font-medium leading-6">{displayTitle}</div>
                    <div className="mt-1 line-clamp-4 text-sm leading-5 text-stone-500 dark:text-stone-400">{promptPreview}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                        <HistoryPill label="模型" className="max-w-full">
                            {session.model || "默认"}
                        </HistoryPill>
                        <HistoryPill label="质量">{session.config.quality || "默认"}</HistoryPill>
                        <HistoryPill label="尺寸">{sizeLabel}</HistoryPill>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1 pt-2">
                        <HistoryPill label="请求">{session.requestCount}</HistoryPill>
                        <HistoryPill tone="success" label="成功">
                            {session.successCount}
                        </HistoryPill>
                        {session.pendingCount ? (
                            <HistoryPill tone="pending" label="生成中">
                                {session.pendingCount}
                            </HistoryPill>
                        ) : null}
                        {session.failCount ? (
                            <HistoryPill tone="danger" label="失败">
                                {session.failCount}
                            </HistoryPill>
                        ) : null}
                        {session.running && session.running.count > 1 ? (
                            <HistoryPill label="并发">{session.running.count} 批</HistoryPill>
                        ) : null}
                        <HistoryPill label="时间">{formatSessionTime(session.createdAt)}</HistoryPill>
                    </div>
                </div>
            </div>
        </button>
    );
}

function SessionCover({ image, pending, count, ratioLabel, sizeLabel }: { image?: GeneratedImage; pending: boolean; count: number; ratioLabel: string; sizeLabel: string }) {
    return (
        <span
            className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-md border border-stone-200 bg-stone-100 text-stone-400 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-500"
            style={image?.dataUrl ? undefined : { backgroundImage: "linear-gradient(135deg, rgba(47,125,225,.14), rgba(233,76,137,.10))" }}
        >
            {image?.dataUrl ? <img src={image.dataUrl} alt="" className="size-full object-cover" loading="lazy" decoding="async" /> : pending ? <LoaderCircle className="size-7 animate-spin opacity-60" /> : <ImagePlus className="size-7 opacity-75" />}
            <span className="absolute left-2 top-2 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{ratioLabel}</span>
            <span className="absolute left-2 top-8 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{sizeLabel}</span>
            {count > 1 ? <span className="absolute bottom-2 right-2 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{count}</span> : null}
        </span>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void }) {
    const thumbnail = normalizeLogThumbnails(log.thumbnails)[0] || "";
    const actualImageCount = actualLogImageCount(log);
    const actualFailureCount = actualLogFailureCount(log);
    const requestCount = requestedLogImageCount(log);
    const coverImage = log.images.find((image) => image.dataUrl || image.storageKey);
    const displayTitle = compactLogTitle(log.prompt || log.title || log.model || "");
    const promptPreview = log.prompt || log.title || "";
    const ratioLabel = imageRatioLabel(log.config.size || log.size);
    const sizeLabel = imageSizeLabel(log.config.size || log.size);

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
            <div className="absolute right-3 top-3 z-10 rounded-md bg-white/95 p-1 shadow-sm ring-1 ring-stone-200 dark:bg-stone-950/90 dark:ring-stone-700" onClick={(event) => event.stopPropagation()}>
                <Checkbox checked={selected} onChange={(event) => onSelectedChange(event.target.checked)} aria-label="选择生成记录" />
            </div>
            <div className="grid min-h-[184px] grid-cols-[176px_minmax(0,1fr)] gap-3 xl:min-h-[204px] xl:grid-cols-[200px_minmax(0,1fr)]">
                <div className="relative">
                    <LogCover logId={log.id} image={thumbnail} source={coverImage} count={actualImageCount} ratioLabel={ratioLabel} sizeLabel={sizeLabel} />
                </div>
                <div className="flex min-w-0 flex-col py-1 pr-9">
                    <div className="line-clamp-3 text-base font-medium leading-6">{displayTitle}</div>
                    <div className="mt-1 line-clamp-4 text-sm leading-5 text-stone-500 dark:text-stone-400">{promptPreview}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                        <HistoryPill label="模型" className="max-w-full">
                            {log.model || "默认"}
                        </HistoryPill>
                        <HistoryPill label="质量">{log.quality || log.config.quality || "默认"}</HistoryPill>
                        <HistoryPill label="尺寸">{sizeLabel}</HistoryPill>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1 pt-2">
                        <HistoryPill label="请求">{requestCount}</HistoryPill>
                        <HistoryPill tone="success" label="成功">
                            {actualImageCount}
                        </HistoryPill>
                        {actualFailureCount ? (
                            <HistoryPill tone="danger" label="失败">
                                {actualFailureCount}
                            </HistoryPill>
                        ) : null}
                        <HistoryPill tone="info" label="耗时">
                            {formatDuration(log.durationMs)}
                        </HistoryPill>
                        <HistoryPill label="时间">{log.time}</HistoryPill>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LogCover({ logId, image, source, count, ratioLabel, sizeLabel }: { logId: string; image: string; source?: GeneratedImage; count: number; ratioLabel: string; sizeLabel: string }) {
    const [thumbnail, setThumbnail] = useState(image);
    const [failed, setFailed] = useState(false);
    const coverRef = useRef<HTMLSpanElement>(null);
    const hasSource = Boolean(source?.dataUrl || source?.storageKey);

    useEffect(() => {
        setThumbnail(image);
        setFailed(false);
    }, [image, logId]);

    useEffect(() => {
        if (thumbnail || failed || !source || !hasSource) return;
        let cancelled = false;
        let idleId = 0;
        let timerId: ReturnType<typeof globalThis.setTimeout> | null = null;
        let observer: IntersectionObserver | null = null;
        const run = () => {
            const load = async () => {
                const sourceUrl = await resolveImageUrl(source.storageKey, source.dataUrl);
                if (cancelled) return;
                if (!sourceUrl) {
                    setFailed(true);
                    return;
                }
                const nextThumbnail = await createImageThumbnail(sourceUrl);
                if (cancelled) return;
                if (!nextThumbnail) {
                    setFailed(true);
                    return;
                }
                setThumbnail(nextThumbnail);
                void cacheLogThumbnail(logId, nextThumbnail);
            };
            if ("requestIdleCallback" in window) {
                idleId = window.requestIdleCallback(() => void load(), { timeout: 1500 });
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
    }, [failed, hasSource, logId, source, thumbnail]);

    return (
        <span
            ref={coverRef}
            className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-md border border-stone-200 bg-stone-100 text-stone-400 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-500"
            style={thumbnail ? undefined : { backgroundImage: "linear-gradient(135deg, rgba(47,125,225,.14), rgba(233,76,137,.10))" }}
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
                        if (hasSource && Math.max(image.naturalWidth, image.naturalHeight) < LOG_THUMBNAIL_MIN_RENDER_EDGE) {
                            setThumbnail("");
                            setFailed(true);
                        }
                    }}
                    onError={() => {
                        setThumbnail("");
                        setFailed(true);
                    }}
                />
            ) : hasSource && !failed ? (
                <LoaderCircle className="size-7 animate-spin opacity-60" />
            ) : failed ? (
                <span className="flex flex-col items-center gap-1 text-[11px] font-medium">
                    <ImagePlus className="size-7 opacity-75" />
                    图片缺失
                </span>
            ) : (
                <ImagePlus className="size-7 opacity-75" />
            )}
            <span className="absolute left-2 top-2 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{ratioLabel}</span>
            <span className="absolute left-2 top-8 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{sizeLabel}</span>
            {count > 1 ? <span className="absolute bottom-2 right-2 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{count}</span> : null}
        </span>
    );
}

async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const values: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            values.push(value);
        });
        const logs = values.map(normalizeLogMetadata);
        return logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

function normalizeLogMetadata(log: Partial<GenerationLog>): GenerationLog {
    const config = normalizeLogConfig(log);
    const images = (log.images || []).map(normalizeGeneratedImageMetadata);
    const failures = normalizeGeneratedFailures(log.failures, Array.isArray(log.failures) ? 0 : log.failCount || 0);
    const hasImageList = Array.isArray(log.images);
    return {
        id: log.id || nanoid(),
        sessionId: log.sessionId,
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || "未命名",
        prompt: log.prompt || log.title || "",
        time: log.time || new Date().toLocaleString("zh-CN", { hour12: false }),
        model: log.model || config.imageModel || "",
        config,
        references: (log.references || []).map(normalizeReferenceMetadata),
        durationMs: log.durationMs || 0,
        successCount: hasImageList ? images.length : (log.successCount ?? log.imageCount ?? 0),
        failCount: failures.length,
        imageCount: log.imageCount || log.successCount || 0,
        size: log.size || config.size || "",
        quality: log.quality || config.quality || "",
        status: log.status || "成功",
        images,
        failures,
        thumbnails: normalizeLogThumbnails(log.thumbnails),
    };
}

async function hydrateLogMedia(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const references = await Promise.all(
        (log.references || []).map(async (item) => ({
            ...item,
            dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
        })),
    );
    const images = await Promise.all(
        (log.images || []).map(async (item) => ({
            ...item,
            dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
        })),
    );
    const config = normalizeLogConfig(log);
    const failures = normalizeGeneratedFailures(log.failures, Array.isArray(log.failures) ? 0 : log.failCount || 0);
    const hasImageList = Array.isArray(log.images);
    return {
        id: log.id || nanoid(),
        sessionId: log.sessionId,
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || "未命名",
        prompt: log.prompt || log.title || "",
        time: log.time || new Date().toLocaleString("zh-CN", { hour12: false }),
        model: log.model || config.imageModel || "",
        config,
        references,
        durationMs: log.durationMs || 0,
        successCount: hasImageList ? images.length : (log.successCount ?? log.imageCount ?? 0),
        failCount: failures.length,
        imageCount: log.imageCount || log.successCount || 0,
        size: log.size || config.size || "",
        quality: log.quality || config.quality || "",
        status: log.status || "成功",
        images,
        failures,
        thumbnails: normalizeLogThumbnails(log.thumbnails),
    };
}

function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        images: log.images.map((image) => ({ ...image, dataUrl: image.storageKey ? "" : image.dataUrl })),
        failures: normalizeGeneratedFailures(log.failures),
        thumbnails: normalizeLogThumbnails(log.thumbnails),
    };
}

function normalizeReferenceMetadata(item: Partial<ReferenceImage>, index: number): ReferenceImage {
    return {
        id: item.id || nanoid(),
        name: item.name || `reference-${index + 1}.png`,
        type: item.type || "",
        dataUrl: item.storageKey ? "" : item.dataUrl || "",
        url: item.url,
        storageKey: item.storageKey,
    };
}

function normalizeGeneratedImageMetadata(item: Partial<GeneratedImage>, index: number): GeneratedImage {
    return {
        id: item.id || nanoid(),
        dataUrl: item.storageKey ? "" : item.dataUrl || "",
        storageKey: item.storageKey,
        durationMs: item.durationMs || 0,
        width: item.width || 0,
        height: item.height || 0,
        bytes: item.bytes || 0,
        mimeType: item.mimeType,
    };
}

function normalizeGeneratedFailures(failures?: Partial<GeneratedFailure>[], fallbackCount = 0) {
    const items = failures?.length ? failures : Array.from({ length: Math.max(0, fallbackCount) }, (_, index) => ({ id: `legacy-failure-${index + 1}`, error: "生成失败", durationMs: 0 }));
    return items.map((item) => ({
        id: item.id || nanoid(),
        error: item.error || "生成失败",
        durationMs: item.durationMs || 0,
    }));
}

function normalizeLogThumbnails(thumbnails?: string[]) {
    return (thumbnails || []).filter((item) => Boolean(item) && (!item.startsWith("data:") || item.length <= LOG_THUMBNAIL_MAX_DATA_URL_LENGTH)).slice(0, 1);
}

function actualLogImageCount(log: GenerationLog) {
    return (log.images || []).filter((image) => Boolean(image.storageKey || image.dataUrl)).length;
}

function actualLogFailureCount(log: GenerationLog) {
    return log.failures.length;
}

function requestedLogImageCount(log: GenerationLog) {
    const configuredCount = Number(log.config?.count);
    const knownCount = log.imageCount || log.successCount || 0;
    const completedCount = actualLogImageCount(log) + actualLogFailureCount(log);
    return Math.max(Number.isFinite(configuredCount) && configuredCount > 0 ? configuredCount : 0, knownCount, completedCount, 1);
}

function imageSizeLabel(value?: string) {
    const text = value?.trim();
    if (!text) return "auto";
    return text.replace(/^(\d+)[xX](\d+)$/, "$1×$2");
}

function imageRatioLabel(value?: string) {
    const text = value?.trim();
    if (!text || text.toLowerCase() === "auto") return "auto";
    if (/^\d+\s*:\s*\d+$/.test(text)) return text.replace(/\s+/g, "");
    const match = text.match(/^(\d+)[xX×](\d+)$/);
    if (!match) return text;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return text;
    const divisor = greatestCommonDivisor(width, height);
    return `${width / divisor}:${height / divisor}`;
}

function greatestCommonDivisor(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
        [x, y] = [y, x % y];
    }
    return x || 1;
}

function formatSessionTime(value: number) {
    return new Date(value).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

async function cacheLogThumbnail(logId: string, thumbnail: string) {
    if (!thumbnail) return;
    try {
        const log = await logStore.getItem<GenerationLog>(logId);
        if (!log) return;
        await logStore.setItem(logId, { ...log, thumbnails: normalizeLogThumbnails([thumbnail]) });
    } catch {}
}

async function findLogIdForSession(sessionId: string) {
    if (!sessionId || sessionId.startsWith("log:")) return "";
    let matched = "";
    await logStore.iterate<GenerationLog, void>((value, key) => {
        if (!matched && value?.sessionId === sessionId) matched = key;
    });
    return matched;
}

async function deleteResultFromLog(logId: string, result: GenerationResult) {
    const stored = await logStore.getItem<GenerationLog>(logId);
    if (!stored) return null;
    const log = normalizeLogMetadata(stored);
    const resultIds = new Set([result.id, result.image?.id].filter((id): id is string => Boolean(id)));
    const removedImages = log.images.filter((image) => resultIds.has(image.id));
    const nextImages = log.images.filter((image) => !resultIds.has(image.id));
    const nextFailures = log.failures.filter((failure) => !resultIds.has(failure.id));
    const removedKeys = removedImages.map((image) => image.storageKey).filter((key): key is string => Boolean(key));
    if (removedKeys.length) await deleteStoredImages(removedKeys);
    if (!nextImages.length && !nextFailures.length) {
        await logStore.removeItem(logId);
        return null;
    }
    const nextLog = recalculateLogCounts({ ...log, images: nextImages, failures: nextFailures, thumbnails: [] });
    await logStore.setItem(logId, serializeLog(nextLog));
    return nextLog;
}

function recalculateLogCounts(log: GenerationLog): GenerationLog {
    const successCount = actualLogImageCount(log);
    const failCount = actualLogFailureCount(log);
    return {
        ...log,
        successCount,
        failCount,
        status: successCount ? "成功" : "失败",
    };
}

function compactLogTitle(value: string) {
    const text = value.replace(/\s+/g, " ").replace(/^[,.;:，。；：、\s]+/, "").trim();
    if (!text) return "未命名";
    const sentence = text.split(/[。！？!?]/, 1)[0]?.trim() || text;
    if (sentence.length <= 30) return sentence;
    return `${sentence.slice(0, 30)}…`;
}

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        imageModel: log.config?.imageModel || log.model || "",
        quality: log.config?.quality || log.quality || "",
        size: log.config?.size || log.size || "",
        count: log.config?.count || String(log.imageCount || log.successCount || 1),
    };
}

function moveListItem<T>(items: T[], index: number, offset: number) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
}

function ReferenceOrderButtons({ index, total, onMove }: { index: number; total: number; onMove: (offset: number) => void }) {
    if (total <= 1) return null;
    return (
        <div className="absolute inset-x-1 bottom-1 flex justify-between">
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowLeft className="size-3" />} disabled={index <= 0} onClick={() => onMove(-1)} />
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowRight className="size-3" />} disabled={index >= total - 1} onClick={() => onMove(1)} />
        </div>
    );
}

function buildLog({
    sessionId,
    prompt,
    model,
    config,
    references,
    durationMs,
    successCount,
    failCount,
    status,
    images,
    failures = [],
    thumbnails,
}: {
    sessionId?: string;
    prompt: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    status: GenerationLog["status"];
    images: GeneratedImage[];
    failures?: GeneratedFailure[];
    thumbnails?: string[];
}): GenerationLog {
    const logConfig = {
        model: config.model,
        imageModel: config.imageModel,
        quality: config.quality,
        size: config.size,
        count: config.count,
    };
    return {
        id: nanoid(),
        sessionId,
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || "未命名",
        prompt,
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        model,
        config: logConfig,
        references,
        durationMs,
        successCount,
        failCount,
        imageCount: Number(logConfig.count) || successCount,
        size: logConfig.size,
        quality: logConfig.quality,
        status,
        images,
        failures: normalizeGeneratedFailures(failures),
        thumbnails: normalizeLogThumbnails(thumbnails),
    };
}

async function createLogThumbnails(images: GeneratedImage[]) {
    if (typeof window === "undefined") return [];
    const thumbnails = await Promise.all(images.slice(0, 1).map((image) => createImageThumbnail(image.dataUrl)));
    return thumbnails.filter(Boolean);
}

function createImageThumbnail(source: string) {
    return new Promise<string>((resolve) => {
        if (!source) {
            resolve("");
            return;
        }
        const image = new window.Image();
        let settled = false;
        const done = (value: string) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve(value);
        };
        const timeout = window.setTimeout(() => done(""), 3000);
        image.onload = () => {
            try {
                const width = image.naturalWidth || LOG_THUMBNAIL_SIZE;
                const height = image.naturalHeight || LOG_THUMBNAIL_SIZE;
                const scale = LOG_THUMBNAIL_SIZE / Math.max(width, height, 1);
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                const context = canvas.getContext("2d");
                if (!context) {
                    done("");
                    return;
                }
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                done(canvas.toDataURL("image/webp", LOG_THUMBNAIL_QUALITY));
            } catch {
                done("");
            }
        };
        image.onerror = () => done("");
        image.decoding = "async";
        image.src = source;
    });
}
