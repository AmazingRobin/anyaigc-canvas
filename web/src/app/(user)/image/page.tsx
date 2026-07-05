"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, ChevronDown, ClipboardPaste, Download, FolderPlus, History, ImagePlus, LoaderCircle, PenLine, Pin, Plus, RefreshCw, Search, Sparkles, Trash2, Upload, VideoIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { App, Button, Drawer, Empty, Image, Input, Modal, Tooltip, Typography } from "antd";
import localforage from "localforage";
import { saveAs } from "file-saver";

import { IMAGE_QUALITY_OPTIONS, ImageSettingsPanel, imageSizeLabel as imageSizeName } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { SelectionBubble } from "@/components/selection-bubble";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { canvasThemes } from "@/lib/canvas-theme";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { matchesWorkbenchPromptSearch, sortWorkbenchHistoryItems } from "@/lib/workbench-history-search";
import { createZip } from "@/lib/zip";
import { fileExtensionFromMime, notifyWorkbenchTask, safeArchiveName, shouldSubmitPrompt, timestampForFileName } from "@/lib/workbench-preferences";
import { modelOptionLabel, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { nanoid } from "nanoid";
import { AZURE_IMAGE_EDIT_ACCEPT, formatBytes, formatDuration, getDataUrlByteSize, readImageMeta, validateAzureImageEditFile } from "@/lib/image-utils";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { isPromptOptimizerReady, optimizeGenerationPrompt } from "@/services/api/prompt";
import { clearDeletedSyncIds, recordDeletedSyncIds } from "@/services/app-sync";
import { deleteStoredImages, getImageBlob, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { queueImageToVideoReferences } from "@/services/workbench-handoff";
import { emptyWorkbenchTrash, formatTrashExpiry, moveLogToWorkbenchTrash, moveLogsToWorkbenchTrash, purgeExpiredWorkbenchTrash, readWorkbenchTrash, removeWorkbenchTrashEntry, restoreWorkbenchTrashEntry, WORKBENCH_TRASH_RETENTION_DAYS, type WorkbenchTrashEntry } from "@/services/workbench-trash";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import type { ReferenceImage } from "@/types/image";

type GenerationRequestSnapshot = {
    prompt: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    createdAt: number;
};

type GeneratedImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType?: string;
    request?: GenerationRequestSnapshot;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    image?: GeneratedImage;
    error?: string;
    request?: GenerationRequestSnapshot;
};

type GeneratedFailure = {
    id: string;
    error: string;
    durationMs: number;
    request?: GenerationRequestSnapshot;
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
    updatedAt: number;
    pinnedAt?: number;
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

const LOG_STORE_KEY = "infinite-canvas:image_generation_logs";
const IMAGE_WORKBENCH_DRAFT_KEY = "relaybases-canvas:image-workbench-draft";
const RESULT_OVERLAY_ICON_BUTTON_CLASS = "!inline-flex !size-8 !items-center !justify-center !rounded-full !border-0 !bg-transparent !p-0 !text-white !shadow-none hover:!bg-white/16 hover:!text-white disabled:!bg-transparent disabled:!text-white/45 [&_.ant-btn-icon]:!m-0 [&_.ant-btn-icon]:shrink-0";
const RESULT_OVERLAY_DANGER_BUTTON_CLASS = `${RESULT_OVERLAY_ICON_BUTTON_CLASS} hover:!bg-rose-500/45`;
const RESULT_FAILED_ICON_BUTTON_CLASS = "!inline-flex !size-8 !items-center !justify-center !rounded-full !border-0 !bg-red-100/70 !p-0 !text-red-600 !shadow-none hover:!bg-red-200/80 dark:!bg-red-950/60 dark:!text-red-200 dark:hover:!bg-red-900/80 [&_.ant-btn-icon]:!m-0 [&_.ant-btn-icon]:shrink-0";
const COMPOSER_CONTROL_CLASS = "h-8 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors hover:bg-stone-100/70 dark:hover:bg-stone-900/70";
const HISTORY_SEARCH_INPUT_CLASS = "mb-3 !rounded-lg !border-stone-200 !bg-background !shadow-none transition-colors hover:!border-stone-300 focus-within:!border-stone-300 focus-within:!shadow-none [&.ant-input-affix-wrapper-focused]:!border-stone-300 [&.ant-input-affix-wrapper-focused]:!shadow-none [&_input]:!outline-none dark:!border-stone-800 dark:hover:!border-stone-700 dark:focus-within:!border-stone-700 dark:[&.ant-input-affix-wrapper-focused]:!border-stone-700";
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });

export default function ImagePage() {
    const { message, modal } = App.useApp();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sizePopoverRef = useRef<HTMLDivElement>(null);
    const sizePopoverDesktopPanelRef = useRef<HTMLDivElement>(null);
    const sizePopoverMobilePanelRef = useRef<HTMLDivElement>(null);
    const previewRequestIdRef = useRef(0);
    const deletedResultIdsRef = useRef<Set<string>>(new Set());
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const addAsset = useAssetStore((state) => state.addAsset);
    const replaceAssets = useAssetStore((state) => state.replaceAssets);
    const assets = useAssetStore((state) => state.assets);
    const [prompt, setPrompt] = useState("");
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [activeSessionId, setActiveSessionId] = useState(() => nanoid());
    const [resultsBySession, setResultsBySession] = useState<Record<string, GenerationResult[]>>({});
    const [sessionsById, setSessionsById] = useState<Record<string, WorkbenchSession>>({});
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [runningBySession, setRunningBySession] = useState<Record<string, RunningSession>>({});
    const [logsOpen, setLogsOpen] = useState(false);
    const [sizePopoverOpen, setSizePopoverOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [promptOptimizing, setPromptOptimizing] = useState(false);
    const [promptCollapsed, setPromptCollapsed] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [resultDeleteTargets, setResultDeleteTargets] = useState<GenerationResult[]>([]);
    const [trashOpen, setTrashOpen] = useState(false);
    const [trashItems, setTrashItems] = useState<WorkbenchTrashEntry<GenerationLog>[]>([]);
    const [draftHydrated, setDraftHydrated] = useState(false);

    const model = effectiveConfig.imageModel || effectiveConfig.model;
    const canGenerate = Boolean(prompt.trim());
    const generationCount = Math.max(1, Math.min(15, Number(config.count) || 1));
    const results = resultsBySession[activeSessionId] || [];
    const selectedResults = results.filter((result) => selectedResultIds.includes(result.id));
    const selectedSuccessResults = selectedResults.filter((result) => result.status === "success" && result.image);
    const allResultsSelected = Boolean(results.length) && selectedResultIds.length === results.length;
    const activeRunning = runningBySession[activeSessionId];
    const running = Boolean(activeRunning);
    const runningCount = activeRunning?.count || 0;
    const persistedSessionIds = new Set(logs.map((log) => log.sessionId).filter((id): id is string => Boolean(id)));
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
        .filter((session) => !logIdFromSession(session.id) && !persistedSessionIds.has(session.id) && (session.running || session.requestCount || session.id === activeSessionId))
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
        if (!sizePopoverOpen) return;
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (sizePopoverRef.current?.contains(event.target as Node)) return;
            if (sizePopoverDesktopPanelRef.current?.contains(event.target as Node)) return;
            if (sizePopoverMobilePanelRef.current?.contains(event.target as Node)) return;
            setSizePopoverOpen(false);
        };
        document.addEventListener("mousedown", closeOnOutsideClick);
        return () => document.removeEventListener("mousedown", closeOnOutsideClick);
    }, [sizePopoverOpen]);

    useEffect(() => {
        void refreshLogs();
        void refreshTrash();
    }, []);

    useEffect(() => {
        void purgeExpiredWorkbenchTrash("image-workbench").then(() => refreshTrash());
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (effectiveConfig.restoreWorkbenchDraftOnStart !== "true") {
            setDraftHydrated(true);
            return;
        }
        try {
            const draft = JSON.parse(window.localStorage.getItem(IMAGE_WORKBENCH_DRAFT_KEY) || "{}") as Partial<Pick<WorkbenchSession, "prompt" | "references">>;
            if (typeof draft.prompt === "string") setPrompt(draft.prompt);
            if (Array.isArray(draft.references)) setReferences(draft.references.slice(0, IMAGE_REFERENCE_LIMIT));
        } catch {}
        setDraftHydrated(true);
    }, []);

    useEffect(() => {
        if (!draftHydrated || typeof window === "undefined") return;
        if (effectiveConfig.restoreWorkbenchDraftOnStart !== "true") return;
        const timer = window.setTimeout(() => {
            window.localStorage.setItem(
                IMAGE_WORKBENCH_DRAFT_KEY,
                JSON.stringify({
                    prompt,
                    references: references.slice(0, IMAGE_REFERENCE_LIMIT),
                }),
            );
        }, 150);
        return () => window.clearTimeout(timer);
    }, [draftHydrated, effectiveConfig.restoreWorkbenchDraftOnStart, prompt, references]);

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

    const forgetWorkbenchSession = (sessionId?: string) => {
        if (!sessionId || logIdFromSession(sessionId)) return;
        setSessionsById((value) => {
            if (!value[sessionId]) return value;
            const next = { ...value };
            delete next[sessionId];
            return next;
        });
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
            setPrompt(await optimizeGenerationPrompt(effectiveConfig, "image", text));
            message.success("提示词已优化");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "提示词优化失败");
        } finally {
            setPromptOptimizing(false);
        }
    };

    const generate = (countOverride?: number) => {
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
        const requestCount = Math.max(1, Math.min(15, Math.floor(countOverride || generationCount)));
        const requestSnapshot = buildImageRequestSnapshot(snapshot, model, { count: String(requestCount) });
        if (!logIdFromSession(sessionId)) {
            rememberWorkbenchSession(sessionId, {
                prompt: text,
                model,
                config: { ...snapshot.config, count: String(requestCount) },
                references: snapshot.references,
            }, requestCount);
        }
        if (!runningBySession[sessionId]) setElapsedMs(0);
        if (!logIdFromSession(sessionId)) setPreviewLog(null);
        setSelectedResultIds([]);
        const pendingResults = Array.from({ length: requestCount }, () => ({ id: nanoid(), status: "pending" as const, request: requestSnapshot }));
        updateSessionResults(sessionId, (value) => [...value, ...pendingResults]);
        const batchStartedAt = performance.now();
        startSessionRun(sessionId, batchStartedAt);
        if (effectiveConfig.clearImageInputsAfterSubmit === "true") {
            setPrompt("");
            setReferences([]);
        }

        const tasks = pendingResults.map((item) =>
            runGenerationSlot(sessionId, item.id, snapshot, requestSnapshot).then(
                (image) => ({ resultId: item.id, status: "success" as const, image }),
                (error) => ({ resultId: item.id, status: "failed" as const, error: error instanceof Error ? error.message : "生成失败", request: requestSnapshot }),
            ),
        );
        void finishGenerationBatch({ sessionId, text, model, snapshot, generationCount: requestCount, batchStartedAt, tasks });
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
            .filter((item): item is { resultId: string; status: "failed"; error: string; request: GenerationRequestSnapshot } => item.status === "failed")
            .map((item) => ({ id: item.resultId, error: item.error, durationMs: performance.now() - batchStartedAt, request: item.request }));
        const successCount = successImages.length;
        const failCount = failures.length;
        const failed = result.find((item): item is { resultId: string; status: "failed"; error: string } => item.status === "failed");
        const durationMs = performance.now() - batchStartedAt;
        finishSessionRun(sessionId);
        successCount ? message.success("图片已生成") : message.error(failed?.error || "生成失败");
        notifyWorkbenchTask(
            effectiveConfig.notifyOnGenerationComplete === "true",
            successCount ? "图片生成完成" : "图片生成失败",
            successCount ? `成功 ${successCount} 张${failCount ? `，失败 ${failCount} 张` : ""}` : failed?.error || "生成失败",
            { tag: `relaybases-image-${sessionId}`, requireInteraction: true },
        );

        void (async () => {
            const logImages = await Promise.all(
                successImages.map(async (image) => {
                    const stored = await uploadImage(image.dataUrl);
                    return { ...image, dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType };
                }),
            );
            const thumbnails = await createLogThumbnails(logImages);
            if (!logImages.length && !failures.length) return;
            await saveBatchLog({
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
            });
        })().catch(() => message.warning("生成记录保存失败"));
    };

    const downloadImage = (image: GeneratedImage, index: number) => {
        saveAs(image.dataUrl, `image-${index + 1}.png`);
    };

    const downloadSelectedImages = async () => {
        const targets = selectedSuccessResults.map((result) => result.image).filter((image): image is GeneratedImage => Boolean(image));
        if (!targets.length) {
            message.warning("请选择可下载的图片结果");
            return;
        }
        const messageKey = "image-workbench-download-zip";
        message.loading({ key: messageKey, content: "正在打包图片", duration: 0 });
        try {
            const files = await Promise.all(
                targets.map(async (image, index) => {
                    const blob = image.storageKey ? await getImageBlob(image.storageKey) : image.dataUrl ? await (await fetch(image.dataUrl)).blob() : null;
                    if (!blob) throw new Error("图片文件缺失");
                    return {
                        name: `${String(index + 1).padStart(2, "0")}-${safeArchiveName(image.id)}.${fileExtensionFromMime(blob.type || image.mimeType, "png")}`,
                        data: blob,
                    };
                }),
            );
            const zip = await createZip(files);
            saveAs(zip, `relaybases-images-${timestampForFileName()}.zip`);
            message.success({ key: messageKey, content: `已打包 ${files.length} 张图片` });
        } catch (error) {
            message.error({ key: messageKey, content: error instanceof Error ? error.message : "图片打包失败" });
        }
    };

    const addResultToReferences = async (image: GeneratedImage, index: number) => {
        const stored = await uploadImage(image.dataUrl);
        const reference = { id: nanoid(), name: `result-${index + 1}.png`, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey };
        const applyReference = (mode: "append" | "replace") => {
            setReferences((value) => (mode === "replace" ? [reference] : [reference, ...value]).slice(0, IMAGE_REFERENCE_LIMIT));
            message.success(mode === "replace" ? "已替换参考图" : "已加入参考图");
        };
        if (effectiveConfig.referenceEditMode === "ask" && references.length) {
            modal.confirm({
                title: "处理参考图",
                content: "将当前结果加入参考图，或替换已有参考图。",
                okText: "替换",
                cancelText: "追加",
                onOk: () => applyReference("replace"),
                onCancel: () => applyReference("append"),
            });
            return;
        }
        applyReference(effectiveConfig.referenceEditMode === "replace" ? "replace" : "append");
    };

    const generateVideoFromImage = async (image: GeneratedImage, index: number) => {
        const stored = await uploadImage(image.dataUrl);
        queueImageToVideoReferences([{ id: nanoid(), name: `image-to-video-${index + 1}.png`, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }], prompt);
        message.success("已带入视频工作台参考图");
        router.push("/video");
    };

    const saveResultToAssets = async (image: GeneratedImage, index: number) => {
        const savedAsset = findGeneratedImageAsset(image, assets);
        if (savedAsset) {
            replaceAssets(assets.filter((asset) => asset.id !== savedAsset.id));
            if (savedAsset.kind === "image" && savedAsset.data.storageKey && savedAsset.data.storageKey !== image.storageKey) await deleteStoredImages([savedAsset.data.storageKey]);
            message.success("已取消加入素材");
            return;
        }
        const stored = await uploadImage(image.dataUrl);
        addAsset({
            kind: "image",
            title: `生成结果 ${index + 1}`,
            coverUrl: stored.url,
            tags: [],
            source: "生图工作台",
            data: { dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType },
            metadata: { source: "image-page", prompt, sourceResultId: image.id, sourceStorageKey: image.storageKey || "" },
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
        const targetLogs = logs.filter((log) => ids.includes(log.id)).map(serializeLog);
        await moveLogsToWorkbenchTrash("image-workbench", targetLogs);
        await recordDeletedSyncIds("image-workbench", ids);
        await Promise.all(ids.map((id) => logStore.removeItem(id)));
        if (previewLog && ids.includes(previewLog.id)) {
            setPreviewLog(null);
            updateSessionResults(activeSessionId, () => []);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
        await Promise.all([refreshLogs(), refreshTrash()]);
    };

    const deleteResult = async (result: GenerationResult) => {
        deletedResultIdsRef.current.add(result.id);
        updateSessionResults(activeSessionId, (value) => value.filter((item) => item.id !== result.id));
        const logId = previewLog?.id || (await findLogIdForSession(activeSessionId));
        if (logId) {
            const nextLog = await deleteResultFromLog(logId, result);
            if (!nextLog) await recordDeletedSyncIds("image-workbench", [logId]);
            if (previewLog?.id === logId) setPreviewLog(nextLog);
            await Promise.all([refreshLogs(), refreshTrash()]);
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

    const saveLog = async (log: GenerationLog) => {
        await logStore.setItem(log.id, serializeLog(log));
        await refreshLogs();
    };

    const saveBatchLog = async (payload: Parameters<typeof buildLog>[0]) => {
        const nextBatch = buildLog(payload);
        const targetLogId = logIdFromSession(payload.sessionId || "");
        if (targetLogId) {
            const stored = await logStore.getItem<GenerationLog>(targetLogId);
            if (stored) {
                const existing = normalizeLogMetadata(stored);
                const merged = recalculateLogCounts({
                    ...nextBatch,
                    id: targetLogId,
                    sessionId: existing.sessionId,
                    createdAt: existing.createdAt,
                    updatedAt: Date.now(),
                    pinnedAt: existing.pinnedAt,
                    time: existing.time,
                    durationMs: existing.durationMs + nextBatch.durationMs,
                    images: [...existing.images, ...nextBatch.images],
                    failures: [...existing.failures, ...nextBatch.failures],
                    thumbnails: normalizeLogThumbnails([...existing.thumbnails, ...nextBatch.thumbnails]),
                });
                await logStore.setItem(targetLogId, serializeLog(merged));
                forgetWorkbenchSession(payload.sessionId);
                setPreviewLog(merged);
                await refreshLogs();
                return;
            }
        }
        await saveLog(nextBatch);
        forgetWorkbenchSession(payload.sessionId);
    };

    const refreshLogs = async () => setLogs(await readStoredLogs());

    const refreshTrash = async () => setTrashItems(await readWorkbenchTrash<GenerationLog>("image-workbench"));

    const openTrash = async () => {
        await refreshTrash();
        setTrashOpen(true);
    };

    const restoreTrashItems = async (entries: WorkbenchTrashEntry<GenerationLog>[]) => {
        const restoredLogs: GenerationLog[] = [];
        for (const entry of entries) {
            const restored = await restoreWorkbenchTrashEntry<GenerationLog>("image-workbench", entry.id);
            if (!restored?.log?.id) continue;
            restoredLogs.push(normalizeLogMetadata({ ...restored.log, updatedAt: Date.now() }));
        }
        if (!restoredLogs.length) return;
        await clearDeletedSyncIds(
            "image-workbench",
            restoredLogs.map((log) => log.id),
        );
        await Promise.all(restoredLogs.map((log) => logStore.setItem(log.id, serializeLog(log))));
        await Promise.all([refreshLogs(), refreshTrash()]);
        message.success(restoredLogs.length === 1 ? "生成记录已恢复" : `已恢复 ${restoredLogs.length} 条生成记录`);
    };

    const restoreTrashItem = async (entry: WorkbenchTrashEntry<GenerationLog>) => {
        await restoreTrashItems([entry]);
    };

    const removeTrashItems = async (entries: WorkbenchTrashEntry<GenerationLog>[]) => {
        for (const entry of entries) {
            await removeWorkbenchTrashEntry("image-workbench", entry.id);
        }
        await refreshTrash();
        message.success(entries.length === 1 ? "已彻底删除" : `已彻底删除 ${entries.length} 条生成记录`);
    };

    const removeTrashItem = async (entry: WorkbenchTrashEntry<GenerationLog>) => {
        await removeTrashItems([entry]);
    };

    const clearTrash = async () => {
        await emptyWorkbenchTrash("image-workbench");
        await refreshTrash();
        message.success("回收站已清空");
    };

    const togglePinnedLog = async (log: GenerationLog) => {
        const stored = await logStore.getItem<GenerationLog>(log.id);
        const current = normalizeLogMetadata(stored || log);
        const next: GenerationLog = {
            ...current,
            pinnedAt: current.pinnedAt ? undefined : Date.now(),
            updatedAt: Date.now(),
        };
        await logStore.setItem(log.id, serializeLog(next));
        setLogs((value) => sortWorkbenchHistoryItems(value.map((item) => (item.id === next.id ? next : item))));
        setPreviewLog((currentPreview) => (currentPreview?.id === next.id ? { ...currentPreview, pinnedAt: next.pinnedAt, updatedAt: next.updatedAt } : currentPreview));
    };

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
            ...hydratedLog.failures.map((failure) => ({ id: failure.id, status: "failed" as const, error: failure.error, request: failure.request })),
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

    const reuseImageRequest = (request?: GenerationRequestSnapshot) => {
        if (!request) {
            message.warning("这条结果缺少可复用的生成配置");
            return;
        }
        setPrompt(request.prompt);
        setReferences((request.references || []).slice(0, IMAGE_REFERENCE_LIMIT));
        if (request.config.imageModel || request.model) updateConfig("imageModel", request.config.imageModel || request.model);
        if (request.config.quality) updateConfig("quality", request.config.quality);
        if (request.config.size) updateConfig("size", request.config.size);
        if (request.config.count) updateConfig("count", request.config.count);
        message.success("已复用生成配置");
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

    const buildImageRequestSnapshot = (snapshot: { text: string; config: AiConfig; references: ReferenceImage[] }, modelValue: string, overrides: Partial<GenerationLogConfig> = {}): GenerationRequestSnapshot => ({
        prompt: snapshot.text,
        model: modelValue,
        config: {
            model: snapshot.config.model,
            imageModel: snapshot.config.imageModel || modelValue,
            quality: snapshot.config.quality,
            size: snapshot.config.size,
            count: snapshot.config.count,
            ...overrides,
        },
        references: snapshot.references,
        createdAt: Date.now(),
    });

    const runGenerationSlot = async (sessionId: string, resultId: string, snapshot: { text: string; config: AiConfig; references: ReferenceImage[] }, requestSnapshot: GenerationRequestSnapshot) => {
        const itemStartedAt = performance.now();
        try {
            const result = snapshot.references.length ? await requestEdit(snapshot.config, snapshot.text, snapshot.references) : await requestGeneration(snapshot.config, snapshot.text);
            const image = result[0];
            if (!image) throw new Error("接口没有返回图片");
            const meta = await readImageMeta(image.dataUrl);
            const nextImage = { id: image.id, dataUrl: image.dataUrl, durationMs: performance.now() - itemStartedAt, width: meta.width, height: meta.height, bytes: getDataUrlByteSize(image.dataUrl), request: requestSnapshot };
            updateSessionResults(sessionId, (value) => updateResultById(value, resultId, { status: "success", image: nextImage }));
            return nextImage;
        } catch (error) {
            updateSessionResults(sessionId, (value) => updateResultById(value, resultId, { status: "failed", error: error instanceof Error ? error.message : "生成失败", request: requestSnapshot }));
            throw error;
        }
    };

    const retryResult = (index: number) => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        const sessionId = activeSessionId;
        if (!logIdFromSession(sessionId)) setPreviewLog(null);
        const resultId = results[index]?.id;
        if (!resultId) return;
        const requestSnapshot = buildImageRequestSnapshot(snapshot, model, { count: "1" });
        if (!runningBySession[sessionId]) setElapsedMs(0);
        if (sessionsById[sessionId]) setSessionsById((value) => ({ ...value, [sessionId]: { ...value[sessionId], requestCount: (value[sessionId].requestCount || 0) + 1 } }));
        updateSessionResults(sessionId, (value) => updateResultById(value, resultId, { status: "pending", error: undefined, image: undefined, request: requestSnapshot }));
        startSessionRun(sessionId, performance.now());
        void runGenerationSlot(sessionId, resultId, snapshot, requestSnapshot)
            .catch(() => {})
            .finally(() => finishSessionRun(sessionId));
    };

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-background text-stone-900 dark:text-stone-100">
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
                        onOpenTrash={() => void openTrash()}
                        trashCount={trashItems.length}
                        onTogglePin={togglePinnedLog}
                        onPreviewSession={previewWorkbenchSession}
                        onPreviewLog={(log) => void previewGenerationLog(log)}
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
                                    <Button size="small" icon={<Download className="size-3.5" />} disabled={!selectedSuccessResults.length} onClick={() => void downloadSelectedImages()}>
                                        下载选中
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

                    <div
                        className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5"
                        style={{
                            backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.16) 1px, transparent 1px)",
                            backgroundSize: "22px 22px",
                        }}
                    >
                        <div className="mx-auto max-w-6xl">
                            {results.length ? (
                                <Image.PreviewGroup>
                                    <div className="grid justify-center gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 200px))" }}>
                                        {results.map((result, index) =>
                                            result.status === "success" && result.image ? (
                                                <ResultImageCard key={result.id} image={result.image} index={index} selected={selectedResultIds.includes(result.id)} savedToAsset={Boolean(findGeneratedImageAsset(result.image, assets))} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} onReuse={() => reuseImageRequest(result.image?.request || result.request)} onEdit={addResultToReferences} onGenerateVideo={generateVideoFromImage} onRegenerate={() => generate(1)} onDownload={downloadImage} onSaveAsset={saveResultToAssets} onDelete={() => requestDeleteResults([result])} />
                                            ) : result.status === "failed" ? (
                                                <FailedImageCard key={result.id} error={result.error || "生成失败"} request={result.request} selected={selectedResultIds.includes(result.id)} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} onReuse={() => reuseImageRequest(result.request)} onRetry={() => retryResult(index)} onDelete={() => requestDeleteResults([result])} />
                                            ) : (
                                                <PendingImageCard key={result.id} selected={selectedResultIds.includes(result.id)} onSelectedChange={(checked) => setSelectedResultIds((ids) => (checked ? [...ids, result.id] : ids.filter((id) => id !== result.id)))} />
                                            ),
                                        )}
                                    </div>
                                </Image.PreviewGroup>
                            ) : (
                                <ImageWorkbenchEmptyState />
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
                                        generate();
                                    }}
                                    rows={promptCollapsed ? 1 : 2}
                                    autoSize={promptCollapsed ? { minRows: 1, maxRows: 1 } : { minRows: 2, maxRows: 5 }}
                                    placeholder="描述画面主体、风格、构图、光线和用途"
                                    className="!resize-none !rounded-none !border-0 !bg-transparent !px-0 !py-0 !text-base !shadow-none focus:!shadow-none"
                                />

                                <div className="flex min-w-0 items-center gap-2 pt-1">
                                    <span className="shrink-0 text-xs font-semibold text-stone-500 dark:text-stone-400">参考图</span>
                                    <Image.PreviewGroup>
                                        <div
                                        className="hide-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain"
                                        onWheel={(event) => {
                                            if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
                                            event.preventDefault();
                                            event.currentTarget.scrollLeft += event.deltaY;
                                        }}
                                    >
                                        {references.map((item, index) => (
                                            <div key={item.id} className="group relative size-16 shrink-0 overflow-hidden rounded-lg bg-stone-100 shadow-sm ring-1 ring-stone-200/70 dark:bg-stone-900 dark:ring-stone-800/70">
                                                <Image src={item.dataUrl} alt={item.name} className="!size-16 object-cover" preview={{ mask: null }} />
                                                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">{imageReferenceLabel(index)}</span>
                                                <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => setReferences((value) => moveListItem(value, index, offset))} />
                                                <button
                                                    type="button"
                                                    className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/58 text-white shadow-sm transition hover:bg-[#ff4d4f] active:bg-[#d9363e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setReferences((value) => value.filter((ref) => ref.id !== item.id));
                                                    }}
                                                    aria-label="移除参考图"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {!references.length ? <span className="flex h-9 items-center text-sm text-stone-400">PNG/JPG · 最多 5 张 · 单张≤50MB</span> : null}
                                        </div>
                                    </Image.PreviewGroup>
                                    <div className="flex shrink-0 gap-2">
                                        <Tooltip title="从剪切板读取参考图">
                                            <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={() => void addReferencesFromClipboard()} />
                                        </Tooltip>
                                        <Tooltip title="上传参考图">
                                            <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => fileInputRef.current?.click()} />
                                        </Tooltip>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 pt-1 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <ModelPicker config={effectiveConfig} value={model} onChange={(value) => updateConfig("imageModel", value)} capability="image" className={`${COMPOSER_CONTROL_CLASS} max-w-[240px]`} onMissingConfig={() => openConfigDialog(false)} />
                                        <div ref={sizePopoverRef} className="relative">
                                            <ComposerMetric label="尺寸" value={imageSizeName(effectiveConfig.size || "auto")} onClick={() => setSizePopoverOpen((open) => !open)} />
                                            {sizePopoverOpen ? (
                                                <div ref={sizePopoverDesktopPanelRef} className="absolute bottom-full left-0 z-[3000] mb-3 hidden max-h-[min(68vh,560px)] w-[384px] max-w-[calc(100vw-40px)] isolate overflow-y-auto rounded-[18px] bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.18)] ring-1 ring-stone-200/90 dark:bg-stone-950 dark:shadow-[0_18px_44px_rgba(0,0,0,0.42)] dark:ring-stone-800/90 sm:block">
                                                    <ImageSettingsPanel
                                                        config={effectiveConfig}
                                                        onConfigChange={(key, value) => updateConfig(key, value)}
                                                        theme={theme}
                                                        showTitle={false}
                                                        showQuality={false}
                                                        showCount={false}
                                                        className="space-y-4"
                                                        quickCount={0}
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                        <ComposerQualitySelect value={effectiveConfig.quality || "auto"} onChange={(value) => updateConfig("quality", value)} />
                                        <label className={`inline-flex items-center overflow-hidden ${COMPOSER_CONTROL_CLASS} px-0`}>
                                            <span className="pl-3 pr-2 text-xs text-stone-500 dark:text-stone-400">张数</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={15}
                                                value={generationCount}
                                                onChange={(event) => updateConfig("count", String(Math.max(1, Math.min(15, Math.floor(Number(event.target.value) || 1)))))}
                                                className="h-full w-10 bg-transparent pl-1 pr-3 text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            />
                                        </label>
                                    </div>
                                    <Button type="primary" size="large" icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={() => generate()} className="xl:min-w-36">
                                        生成 {generationCount} 张
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            {sizePopoverOpen && typeof document !== "undefined"
                ? createPortal(
                      <div
                          ref={sizePopoverMobilePanelRef}
                          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[3000] max-h-[min(54dvh,500px)] isolate overflow-y-auto rounded-[18px] bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 ring-stone-200/90 dark:bg-stone-950 dark:shadow-[0_24px_70px_rgba(0,0,0,0.48)] dark:ring-stone-800/90 sm:hidden"
                          onMouseDown={(event) => event.stopPropagation()}
                      >
                          <ImageSettingsPanel
                              config={effectiveConfig}
                              onConfigChange={(key, value) => updateConfig(key, value)}
                              theme={theme}
                              showTitle={false}
                              showQuality={false}
                              showCount={false}
                              className="space-y-4"
                              quickCount={0}
                          />
                      </div>,
                      document.body,
                  )
                : null}
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
                    sessions={workbenchSessions}
                    logs={logs}
                    activeSessionId={activeSessionId}
                    selectedLogIds={selectedLogIds}
                    activeLogId={previewLog?.id}
                    onSelectedLogIdsChange={setSelectedLogIds}
                    onCreateSession={createSession}
                    onDeleteSelected={() => setDeleteConfirmOpen(true)}
                    onOpenTrash={() => void openTrash()}
                    trashCount={trashItems.length}
                    onClose={() => setLogsOpen(false)}
                    onTogglePin={togglePinnedLog}
                    onPreviewSession={(session) => {
                        previewWorkbenchSession(session);
                        setLogsOpen(false);
                    }}
                    onPreviewLog={(log) => {
                        void previewGenerationLog(log);
                        setLogsOpen(false);
                    }}
                />
            </Drawer>
            <Drawer title="回收站" placement="right" width="min(560px, 100vw)" open={trashOpen} onClose={() => setTrashOpen(false)} styles={{ body: { padding: 12 } }}>
                <TrashPanel
                    entries={trashItems}
                    onRestore={(entry) => void restoreTrashItem(entry)}
                    onRestoreSelected={(entries) => void restoreTrashItems(entries)}
                    onRemove={(entry) =>
                        modal.confirm({
                            title: "彻底删除生成记录",
                            content: "彻底删除后将无法从回收站恢复，相关本地媒体文件也会被清理。",
                            okText: "彻底删除",
                            okButtonProps: { danger: true },
                            cancelText: "取消",
                            onOk: () => removeTrashItem(entry),
                        })
                    }
                    onRemoveSelected={(entries) =>
                        modal.confirm({
                            title: "彻底删除生成记录",
                            content: `确定彻底删除选中的 ${entries.length} 条生成记录吗？相关本地媒体文件也会被清理。`,
                            okText: "彻底删除",
                            okButtonProps: { danger: true },
                            cancelText: "取消",
                            onOk: () => removeTrashItems(entries),
                        })
                    }
                    onClear={() =>
                        modal.confirm({
                            title: "清空回收站",
                            content: "回收站内的生成记录和相关本地媒体文件会被彻底删除。",
                            okText: "清空",
                            okButtonProps: { danger: true },
                            cancelText: "取消",
                            onOk: clearTrash,
                        })
                    }
                />
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

function ImageWorkbenchEmptyState() {
    return (
        <div className="grid min-h-[min(54dvh,560px)] place-items-center rounded-2xl bg-background/70 text-center dark:bg-background/70">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-sm text-stone-400">还没有生成图片</span>} />
        </div>
    );
}

function HistoryEmptyState() {
    return (
        <div className="grid min-h-48 place-items-center rounded-xl bg-stone-50/50 dark:bg-stone-900/25">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-sm text-stone-400">暂无生成记录</span>} />
        </div>
    );
}

function HistorySearchEmptyState() {
    return <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">未找到匹配的生成记录</div>;
}

function TrashPanel({
    entries,
    onRestore,
    onRestoreSelected,
    onRemove,
    onRemoveSelected,
    onClear,
}: {
    entries: WorkbenchTrashEntry<GenerationLog>[];
    onRestore: (entry: WorkbenchTrashEntry<GenerationLog>) => void;
    onRestoreSelected: (entries: WorkbenchTrashEntry<GenerationLog>[]) => void;
    onRemove: (entry: WorkbenchTrashEntry<GenerationLog>) => void;
    onRemoveSelected: (entries: WorkbenchTrashEntry<GenerationLog>[]) => void;
    onClear: () => void;
}) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        setSelectedIds((ids) => ids.filter((id) => entries.some((entry) => entry.id === id)));
    }, [entries]);

    const selectedEntries = entries.filter((entry) => selectedIds.includes(entry.id));
    const allSelected = entries.length > 0 && selectedEntries.length === entries.length;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/40">
                <div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">生成记录回收站</div>
                    <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">删除后保留 {WORKBENCH_TRASH_RETENTION_DAYS} 天，每条记录按自己的到期时间自动清理。</div>
                </div>
                <Button size="small" danger disabled={!entries.length} onClick={onClear}>
                    清空
                </Button>
            </div>
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
                <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!entries.length} onClick={() => setSelectedIds(allSelected ? [] : entries.map((entry) => entry.id))}>
                    {allSelected ? "取消全选" : "全选"}
                </Button>
                <Button size="small" icon={<RefreshCw className="size-3.5" />} disabled={!selectedEntries.length} onClick={() => onRestoreSelected(selectedEntries)}>
                    恢复选中{selectedEntries.length ? ` ${selectedEntries.length}` : ""}
                </Button>
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedEntries.length} onClick={() => onRemoveSelected(selectedEntries)}>
                    彻底删除{selectedEntries.length ? ` ${selectedEntries.length}` : ""}
                </Button>
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {entries.map((entry) => {
                    const promptPreview = entry.log.prompt || entry.log.title || "未命名";
                    const selected = selectedIds.includes(entry.id);
                    const thumbnail = trashImageThumbnail(entry.log);
                    const successCount = actualLogImageCount(entry.log);
                    const failCount = actualLogFailureCount(entry.log);
                    const expirePercent = trashRemainingPercent(entry);
                    return (
                        <div key={entry.id} className={`relative overflow-hidden rounded-xl border bg-background p-3 shadow-sm transition ${selected ? "border-stone-400 ring-2 ring-stone-200 dark:border-stone-600 dark:ring-stone-800" : "border-stone-200 hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-700"}`}>
                            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={(checked) => setSelectedIds((ids) => (checked ? Array.from(new Set([...ids, entry.id])) : ids.filter((id) => id !== entry.id)))} ariaLabel="选择回收站记录" />
                            <div className="flex gap-3 pr-8">
                                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200/70 dark:bg-stone-900 dark:ring-stone-800/70">
                                    {thumbnail ? <img src={thumbnail} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center bg-[linear-gradient(135deg,rgba(47,125,225,.14),rgba(233,76,137,.10))] text-stone-400"><ImagePlus className="size-5" /></div>}
                                    {successCount > 1 ? <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">{successCount}</span> : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="line-clamp-2 text-sm font-semibold leading-5 text-stone-900 dark:text-stone-100">{promptPreview}</div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        <HistoryPill label="模型">{entry.log.config?.imageModel || entry.log.model || "默认"}</HistoryPill>
                                        <HistoryPill label="尺寸">{imageSizeLabel(entry.log.config?.size || entry.log.size)}</HistoryPill>
                                        {successCount ? <HistoryPill tone="success" label="成功">{successCount}</HistoryPill> : null}
                                        {failCount ? <HistoryPill tone="danger" label="失败">{failCount}</HistoryPill> : null}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        <HistoryPill label="删除">{formatTrashDate(entry.deletedAt)}</HistoryPill>
                                        <HistoryPill tone="danger" label="清理">{formatTrashExpiry(entry.expiresAt)}</HistoryPill>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-amber-300 transition-[width]" style={{ width: `${expirePercent}%` }} />
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                                <Button size="small" icon={<RefreshCw className="size-3.5" />} onClick={() => onRestore(entry)}>
                                    恢复
                                </Button>
                                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => onRemove(entry)}>
                                    彻底删除
                                </Button>
                            </div>
                        </div>
                    );
                })}
                {!entries.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-sm text-stone-400">回收站为空</span>} /> : null}
            </div>
        </div>
    );
}

function trashImageThumbnail(log: GenerationLog) {
    return normalizeLogThumbnails(log.thumbnails)[0] || log.images?.[0]?.dataUrl || "";
}

function trashRemainingPercent(entry: WorkbenchTrashEntry<GenerationLog>) {
    const total = Math.max(1, entry.expiresAt - entry.deletedAt);
    const remaining = Math.max(0, entry.expiresAt - Date.now());
    return Math.max(3, Math.min(100, Math.round((remaining / total) * 100)));
}

function formatTrashDate(value: number) {
    return new Date(value).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ComposerMetric({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
    const content = (
        <>
            <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">{label}</span>
            <span className="min-w-0 truncate text-stone-700 dark:text-stone-200">{value}</span>
        </>
    );
    if (onClick) {
        return (
            <button
                type="button"
                className={`inline-flex max-w-[180px] cursor-pointer items-center gap-1 overflow-hidden ${COMPOSER_CONTROL_CLASS}`}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }
    return (
        <span className={`inline-flex max-w-[180px] items-center gap-1 overflow-hidden ${COMPOSER_CONTROL_CLASS}`}>
            {content}
        </span>
    );
}

function ComposerQualitySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const selected = IMAGE_QUALITY_OPTIONS.find((item) => item.value === (value || "auto")) || IMAGE_QUALITY_OPTIONS[0];
    return (
        <Select value={value || "auto"} onValueChange={onChange}>
            <SelectTrigger
                className={`w-auto max-w-[9rem] justify-start gap-1.5 ${COMPOSER_CONTROL_CLASS}`}
                aria-label="选择生成质量"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">质量</span>
                <span className="min-w-0 shrink-0 truncate text-left text-stone-700 dark:text-stone-200">{selected.label}</span>
            </SelectTrigger>
            <SelectContent className="z-[3000] min-w-[8rem] rounded-xl border border-border/70 bg-white p-1 shadow-xl dark:bg-stone-950" position="popper" align="start" side="bottom" sideOffset={6} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                {IMAGE_QUALITY_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                        {item.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
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
    savedToAsset,
    onSelectedChange,
    onReuse,
    onEdit,
    onGenerateVideo,
    onRegenerate,
    onDownload,
    onSaveAsset,
    onDelete,
}: {
    image: GeneratedImage;
    index: number;
    selected: boolean;
    savedToAsset: boolean;
    onSelectedChange: (checked: boolean) => void;
    onReuse: () => void;
    onEdit: (image: GeneratedImage, index: number) => void;
    onGenerateVideo: (image: GeneratedImage, index: number) => void;
    onRegenerate: () => void;
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
    const promptPreview = image.request?.prompt || "";

    return (
        <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <SelectionBubble className="absolute right-3 top-3 z-20" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成结果" />
            {displayImage ? (
                <>
                    <Image src={displayImage.dataUrl} alt={`生成结果 ${index + 1}`} className="aspect-square object-cover" onError={() => setLoadFailed(true)} />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-2.5 pb-2 pt-9 text-white">
                        {promptPreview ? (
                            <Tooltip title={promptPreview}>
                                <div className="pointer-events-auto mb-1 line-clamp-2 text-xs font-medium leading-4 text-white">{promptPreview}</div>
                            </Tooltip>
                        ) : null}
                        <div className="mb-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[11px] leading-none text-white/78">
                            <span>
                                {image.width}x{image.height}
                            </span>
                            <span>{formatBytes(image.bytes)}</span>
                            <span>{formatDuration(image.durationMs)}</span>
                        </div>
                        <div className="pointer-events-auto flex items-center justify-end gap-1">
                            <Tooltip title={savedToAsset ? "已加入我的素材，点击取消" : "添加到素材"}>
                                <Button type="text" aria-label={savedToAsset ? "取消加入素材" : "添加到素材"} className={`${RESULT_OVERLAY_ICON_BUTTON_CLASS} ${savedToAsset ? "!bg-emerald-500/40 !text-white hover:!bg-emerald-500/55" : ""}`} size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => void onSaveAsset(displayImage, index)} />
                            </Tooltip>
                            <Tooltip title="复用提示词和配置">
                                <Button type="text" aria-label="复用提示词和配置" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={onReuse} />
                            </Tooltip>
                            <Tooltip title="作为参考图继续编辑">
                                <Button type="text" aria-label="作为参考图继续编辑" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<PenLine className="size-3.5" />} onClick={() => void onEdit(displayImage, index)} />
                            </Tooltip>
                            <Tooltip title="用这张图生成视频">
                                <Button type="text" aria-label="用这张图生成视频" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<VideoIcon className="size-3.5" />} onClick={() => void onGenerateVideo(displayImage, index)} />
                            </Tooltip>
                            <Tooltip title="重新生成">
                                <Button type="text" aria-label="重新生成" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<RefreshCw className="size-3.5" />} onClick={onRegenerate} />
                            </Tooltip>
                            <Tooltip title="下载">
                                <Button type="text" aria-label="下载图片" className={RESULT_OVERLAY_ICON_BUTTON_CLASS} size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(displayImage, index)} />
                            </Tooltip>
                            <Tooltip title="删除结果">
                                <Button type="text" aria-label="删除结果" className={RESULT_OVERLAY_DANGER_BUTTON_CLASS} size="small" icon={<Trash2 className="size-3.5" />} onClick={onDelete} />
                            </Tooltip>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-stone-50 p-5 text-center text-sm text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                    {loadFailed ? <ImagePlus className="size-8 opacity-70" /> : <LoaderCircle className="size-6 animate-spin opacity-60" />}
                    <span>{loadFailed ? "图片文件缺失" : "正在读取图片"}</span>
                    <Tooltip title="删除结果">
                        <Button type="text" aria-label="删除结果" className={RESULT_FAILED_ICON_BUTTON_CLASS} size="small" icon={<Trash2 className="size-3.5" />} onClick={onDelete} />
                    </Tooltip>
                </div>
            )}
        </div>
    );
}

function PendingImageCard({ selected, onSelectedChange }: { selected: boolean; onSelectedChange: (checked: boolean) => void }) {
    return (
        <div className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成结果" />
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

function FailedImageCard({ error, request, selected, onSelectedChange, onReuse, onRetry, onDelete }: { error: string; request?: GenerationRequestSnapshot; selected: boolean; onSelectedChange: (checked: boolean) => void; onReuse: () => void; onRetry: () => void; onDelete: () => void }) {
    const promptPreview = request?.prompt || "";
    return (
        <div className="relative overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成结果" />
            <div className="flex aspect-square flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                {promptPreview ? (
                    <Tooltip title={promptPreview}>
                        <Typography.Paragraph ellipsis={{ rows: 3 }} className="!mb-0 !text-xs !font-medium !text-red-700 dark:!text-red-200">
                            {promptPreview}
                        </Typography.Paragraph>
                    </Tooltip>
                ) : null}
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end gap-1.5 px-2 pb-2">
                <Tooltip title="复用提示词和配置">
                    <Button type="text" aria-label="复用提示词和配置" className={RESULT_FAILED_ICON_BUTTON_CLASS} size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={onReuse} />
                </Tooltip>
                <Tooltip title="重新生成">
                    <Button type="text" aria-label="重新生成" className={RESULT_FAILED_ICON_BUTTON_CLASS} size="small" icon={<RefreshCw className="size-3.5" />} onClick={onRetry} />
                </Tooltip>
                <Tooltip title="删除结果">
                    <Button type="text" aria-label="删除结果" className={RESULT_FAILED_ICON_BUTTON_CLASS} size="small" icon={<Trash2 className="size-3.5" />} onClick={onDelete} />
                </Tooltip>
            </div>
        </div>
    );
}

function findGeneratedImageAsset(image: GeneratedImage, assets: Asset[]) {
    return assets.find((asset) => {
        if (asset.kind !== "image") return false;
        if (assetMetadataString(asset, "sourceResultId") === image.id) return true;
        const sourceStorageKey = assetMetadataString(asset, "sourceStorageKey");
        return Boolean(image.storageKey && sourceStorageKey === image.storageKey);
    });
}

function assetMetadataString(asset: Asset, key: string) {
    const value = asset.metadata?.[key];
    return typeof value === "string" ? value : "";
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
    onOpenTrash,
    trashCount,
    onClose,
    onTogglePin,
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
    onOpenTrash: () => void;
    trashCount: number;
    onClose?: () => void;
    onTogglePin: (log: GenerationLog) => void | Promise<void>;
    onPreviewSession: (session: WorkbenchSession) => void;
    onPreviewLog: (log: GenerationLog) => void;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const filteredSessions = sessions.filter((session) => matchesWorkbenchPromptSearch(session.prompt || session.model || "", searchQuery));
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
                    <div>
                        <h2 className="text-base font-semibold">生成记录</h2>
                    </div>
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
                    <Button size="small" icon={<Trash2 className="size-3.5" />} onClick={onOpenTrash}>
                        回收站{trashCount ? ` ${trashCount}` : ""}
                    </Button>
                </div>
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                {filteredSessions.length ? (
                    <div className="mb-5">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                            <span>当前会话</span>
                            <HistoryPill>{filteredSessions.length}</HistoryPill>
                        </div>
                        <div className="space-y-3">
                            {filteredSessions.map((session) => (
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
                            onTogglePin={() => void onTogglePin(log)}
                            onClick={() => onPreviewLog(log)}
                        />
                    ))}
                    {hiddenCount ? (
                        <Button block size="small" onClick={() => setVisibleCount((value) => value + LOG_VISIBLE_BATCH_SIZE)}>
                            加载更多 {hiddenCount}
                        </Button>
                    ) : null}
                    {!logs.length && !sessions.length ? <HistoryEmptyState /> : null}
                    {hasSearch && !filteredLogs.length && !filteredSessions.length ? <HistorySearchEmptyState /> : null}
                </div>
            </div>
        </div>
    );
}

function SessionCard({ session, active, onClick }: { session: WorkbenchSessionView; active: boolean; onClick: () => void }) {
    const promptPreview = session.prompt || session.model || "";
    const ratioLabel = imageRatioLabel(session.config.size);
    const sizeLabel = imageSizeLabel(session.config.size);

    return (
        <button
            type="button"
            className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-200 bg-stone-100/80 dark:border-stone-800 dark:bg-stone-900/80" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`}
            onClick={onClick}
            title={promptPreview}
        >
            <div className="grid min-h-[112px] grid-cols-[112px_minmax(0,1fr)] gap-2 sm:min-h-[160px] sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-3">
                <SessionCover image={session.firstImage} pending={Boolean(session.running || session.pendingCount)} count={session.successCount} ratioLabel={ratioLabel} sizeLabel={sizeLabel} />
                <div className="flex min-w-0 flex-col py-1">
                    <div className="line-clamp-3 text-sm leading-5 text-stone-600 dark:text-stone-300 sm:line-clamp-5">{promptPreview}</div>
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
    const thumbnail = normalizeLogThumbnails(log.thumbnails)[0] || "";
    const actualImageCount = actualLogImageCount(log);
    const actualFailureCount = actualLogFailureCount(log);
    const requestCount = requestedLogImageCount(log);
    const coverImage = log.images.find((image) => image.dataUrl || image.storageKey);
    const promptPreview = log.prompt || log.title || "";
    const ratioLabel = imageRatioLabel(log.config.size || log.size);
    const sizeLabel = imageSizeLabel(log.config.size || log.size);

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
                    className={`!absolute !right-3 !top-12 z-10 !inline-grid !size-7 !place-items-center !rounded-full !border !p-0 !shadow-[0_2px_7px_rgba(15,23,42,0.06)] !backdrop-blur-md [&_.ant-btn-icon]:!m-0 ${log.pinnedAt ? "!border-stone-300/60 !bg-white/80 !text-stone-700 dark:!border-stone-600/60 dark:!bg-stone-950/75 dark:!text-stone-200" : "!border-stone-200/60 !bg-white/40 !text-stone-400 !opacity-[0.68] hover:!bg-white/70 hover:!text-stone-700 dark:!border-white/10 dark:!bg-stone-950/40 dark:!text-stone-500 dark:hover:!bg-stone-950/70 dark:hover:!text-stone-200"}`}
                    icon={
                        <span className={`grid size-3.5 place-items-center rounded-[4px] border transition ${log.pinnedAt ? "border-stone-400/50 bg-stone-200/70 text-stone-700 dark:border-stone-500/50 dark:bg-stone-700/60 dark:text-stone-100" : "border-current/35 bg-transparent"}`}>
                            <Pin className={`size-2.5 ${log.pinnedAt ? "fill-current" : ""}`} />
                        </span>
                    }
                    onClick={(event) => {
                        event.stopPropagation();
                        onTogglePin();
                    }}
                />
            </Tooltip>
            <SelectionBubble className="absolute right-3 top-3 z-10" selected={selected} onSelectedChange={onSelectedChange} ariaLabel="选择生成记录" />
            <div className="grid min-h-[112px] grid-cols-[112px_minmax(0,1fr)] gap-2 sm:min-h-[160px] sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-3">
                <div className="relative">
                    <LogCover logId={log.id} image={thumbnail} source={coverImage} count={actualImageCount} ratioLabel={ratioLabel} sizeLabel={sizeLabel} />
                </div>
                <div className="flex min-w-0 flex-col py-1 pr-9">
                    <div className="line-clamp-3 text-sm leading-5 text-stone-600 dark:text-stone-300 sm:line-clamp-5">{promptPreview}</div>
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
                        <HistoryPill tone="info" label="总耗时">
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
        return sortWorkbenchHistoryItems(logs);
    } catch {
        return [];
    }
}

function normalizeLogMetadata(log: Partial<GenerationLog>): GenerationLog {
    const config = normalizeLogConfig(log);
    const references = (log.references || []).map(normalizeReferenceMetadata);
    const fallbackRequest = imageLogRequestSnapshot(log, config, references);
    const images = (log.images || []).map((item, index) => normalizeGeneratedImageMetadata(item, index, fallbackRequest));
    const failures = normalizeGeneratedFailures(log.failures, Array.isArray(log.failures) ? 0 : log.failCount || 0, fallbackRequest);
    const hasImageList = Array.isArray(log.images);
    return {
        id: log.id || nanoid(),
        sessionId: log.sessionId,
        createdAt: log.createdAt || Date.now(),
        updatedAt: log.updatedAt || log.createdAt || Date.now(),
        pinnedAt: log.pinnedAt,
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

async function hydrateLogMedia(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const references = await Promise.all(
        (log.references || []).map(async (item) => ({
            ...item,
            dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
        })),
    );
    const config = normalizeLogConfig(log);
    const fallbackRequest = imageLogRequestSnapshot(log, config, references);
    const images = await Promise.all(
        (log.images || []).map(async (item, index) => ({
            ...normalizeGeneratedImageMetadata(item, index, fallbackRequest),
            dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
            request: await hydrateImageRequestSnapshot(normalizeImageRequestSnapshot(item.request, fallbackRequest)),
        })),
    );
    const failures = await Promise.all(normalizeGeneratedFailures(log.failures, Array.isArray(log.failures) ? 0 : log.failCount || 0, fallbackRequest).map(async (failure) => ({ ...failure, request: await hydrateImageRequestSnapshot(failure.request || fallbackRequest) })));
    const hasImageList = Array.isArray(log.images);
    return {
        id: log.id || nanoid(),
        sessionId: log.sessionId,
        createdAt: log.createdAt || Date.now(),
        updatedAt: log.updatedAt || log.createdAt || Date.now(),
        pinnedAt: log.pinnedAt,
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
        images: log.images.map((image) => ({ ...image, dataUrl: image.storageKey ? "" : image.dataUrl, request: serializeImageRequestSnapshot(image.request) })),
        failures: normalizeGeneratedFailures(log.failures).map((failure) => ({ ...failure, request: serializeImageRequestSnapshot(failure.request) })),
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

function imageLogRequestSnapshot(log: Partial<GenerationLog>, config: GenerationLogConfig, references: ReferenceImage[]): GenerationRequestSnapshot {
    return {
        prompt: log.prompt || log.title || "",
        model: log.model || config.imageModel || config.model || "",
        config,
        references,
        createdAt: log.createdAt || Date.now(),
    };
}

function normalizeImageRequestSnapshot(value: Partial<GenerationRequestSnapshot> | undefined, fallback: GenerationRequestSnapshot): GenerationRequestSnapshot {
    const config = {
        ...fallback.config,
        ...(value?.config || {}),
    };
    return {
        prompt: value?.prompt || fallback.prompt,
        model: value?.model || fallback.model || config.imageModel || config.model || "",
        config,
        references: (value?.references?.length ? value.references : fallback.references).map(normalizeReferenceMetadata).slice(0, IMAGE_REFERENCE_LIMIT),
        createdAt: value?.createdAt || fallback.createdAt || Date.now(),
    };
}

function serializeImageRequestSnapshot(request?: GenerationRequestSnapshot) {
    if (!request) return undefined;
    return {
        ...request,
        references: request.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
    };
}

async function hydrateImageRequestSnapshot(request: GenerationRequestSnapshot): Promise<GenerationRequestSnapshot> {
    return {
        ...request,
        references: await Promise.all(
            request.references.map(async (item) => ({
                ...item,
                dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
            })),
        ),
    };
}

function normalizeGeneratedImageMetadata(item: Partial<GeneratedImage>, index: number, fallbackRequest: GenerationRequestSnapshot): GeneratedImage {
    return {
        id: item.id || nanoid(),
        dataUrl: item.storageKey ? "" : item.dataUrl || "",
        storageKey: item.storageKey,
        durationMs: item.durationMs || 0,
        width: item.width || 0,
        height: item.height || 0,
        bytes: item.bytes || 0,
        mimeType: item.mimeType,
        request: normalizeImageRequestSnapshot(item.request, fallbackRequest),
    };
}

function normalizeGeneratedFailures(failures?: Partial<GeneratedFailure>[], fallbackCount = 0, fallbackRequest?: GenerationRequestSnapshot) {
    const items: Partial<GeneratedFailure>[] = failures?.length ? failures : Array.from({ length: Math.max(0, fallbackCount) }, (_, index) => ({ id: `legacy-failure-${index + 1}`, error: "生成失败", durationMs: 0 }));
    return items.map((item) => ({
        id: item.id || nanoid(),
        error: item.error || "生成失败",
        durationMs: item.durationMs || 0,
        request: fallbackRequest ? normalizeImageRequestSnapshot(item.request, fallbackRequest) : item.request,
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

function logIdFromSession(sessionId: string) {
    return sessionId.startsWith("log:") ? sessionId.slice(4) : "";
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
    if (removedImages.length || nextFailures.length !== log.failures.length) {
        await moveLogToWorkbenchTrash("image-workbench", serializeLog(log), { purgeStorageKeys: removedKeys });
    }
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
        updatedAt: Date.now(),
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
        updatedAt: Date.now(),
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
