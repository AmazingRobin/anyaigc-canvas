import { useLanguageStore, type LanguageName } from "@/stores/use-language-store";

export const GROK_IMAGINE_EDIT_MODEL = "grok-imagine-edit";
export const GROK_IMAGINE_IMAGE_QUALITY_MODEL = "grok-imagine-image-quality";
export const GROK_IMAGINE_VIDEO_BASE_MODEL = "grok-imagine-video";
export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video-1.5";

export const GROK_VIDEO_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;
export const GROK_VIDEO_BASE_RESOLUTIONS = ["480p", "720p"] as const;
export const GROK_VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"] as const;
export const GROK_VIDEO_MODES = ["text-to-video", "image-to-video", "reference-to-video", "edit-video", "extend-video"] as const;

export type GrokVideoMode = (typeof GROK_VIDEO_MODES)[number];

type GrokImageCapability = {
    kind: "image";
    generation: boolean;
    edit: true;
    maxReferenceImages: 3;
    maxOutputs: 10;
};

export type GrokVideoOperationCapability = {
    minReferenceImages: number;
    maxReferenceImages: number;
    minReferenceVideos: number;
    maxReferenceVideos: number;
    minDuration?: number;
    maxDuration?: number;
    minSourceVideoDurationMs?: number;
    maxSourceVideoDurationMs?: number;
    aspectRatio: "configurable" | "source";
    resolutions: readonly string[];
};

type GrokVideoCapability = {
    kind: "video";
    asyncOnly: true;
    defaultMode: GrokVideoMode;
    operations: Partial<Record<GrokVideoMode, GrokVideoOperationCapability>>;
};

const BASE_GENERATION_OPERATION = {
    minReferenceVideos: 0,
    maxReferenceVideos: 0,
    minDuration: 1,
    maxDuration: 15,
    aspectRatio: "configurable",
    resolutions: GROK_VIDEO_BASE_RESOLUTIONS,
} as const;

export const GROK_MEDIA_MODEL_CAPABILITIES: Record<string, GrokImageCapability | GrokVideoCapability> = {
    [GROK_IMAGINE_EDIT_MODEL]: {
        kind: "image",
        generation: false,
        edit: true,
        maxReferenceImages: 3,
        maxOutputs: 10,
    },
    [GROK_IMAGINE_IMAGE_QUALITY_MODEL]: {
        kind: "image",
        generation: true,
        edit: true,
        maxReferenceImages: 3,
        maxOutputs: 10,
    },
    [GROK_IMAGINE_VIDEO_BASE_MODEL]: {
        kind: "video",
        asyncOnly: true,
        defaultMode: "text-to-video",
        operations: {
            "text-to-video": { ...BASE_GENERATION_OPERATION, minReferenceImages: 0, maxReferenceImages: 0 },
            "image-to-video": { ...BASE_GENERATION_OPERATION, minReferenceImages: 1, maxReferenceImages: 1 },
            "reference-to-video": { ...BASE_GENERATION_OPERATION, minReferenceImages: 1, maxReferenceImages: 7, maxDuration: 10 },
            "edit-video": {
                minReferenceImages: 0,
                maxReferenceImages: 0,
                minReferenceVideos: 1,
                maxReferenceVideos: 1,
                maxSourceVideoDurationMs: 8700,
                aspectRatio: "source",
                resolutions: [],
            },
            "extend-video": {
                minReferenceImages: 0,
                maxReferenceImages: 0,
                minReferenceVideos: 1,
                maxReferenceVideos: 1,
                minDuration: 2,
                maxDuration: 10,
                minSourceVideoDurationMs: 2000,
                maxSourceVideoDurationMs: 15000,
                aspectRatio: "source",
                resolutions: [],
            },
        },
    },
    [GROK_IMAGINE_VIDEO_MODEL]: {
        kind: "video",
        asyncOnly: true,
        defaultMode: "image-to-video",
        operations: {
            "image-to-video": {
                minReferenceImages: 1,
                maxReferenceImages: 1,
                minReferenceVideos: 0,
                maxReferenceVideos: 0,
                minDuration: 1,
                maxDuration: 15,
                aspectRatio: "configurable",
                resolutions: GROK_VIDEO_RESOLUTIONS,
            },
        },
    },
};

export function mediaModelName(value: string) {
    const separatorIndex = value.indexOf("::");
    return separatorIndex >= 0 ? value.slice(separatorIndex + 2) : value;
}

export function grokMediaModelCapability(model: string) {
    return GROK_MEDIA_MODEL_CAPABILITIES[mediaModelName(model)];
}

export function grokImageModelCapability(model: string) {
    const capability = grokMediaModelCapability(model);
    return capability?.kind === "image" ? capability : undefined;
}

export function grokVideoModelCapability(model: string) {
    const capability = grokMediaModelCapability(model);
    return capability?.kind === "video" ? capability : undefined;
}

export function grokVideoOperationCapability(model: string, mode: unknown) {
    const capability = grokVideoModelCapability(model);
    if (!capability) return undefined;
    return capability.operations[normalizeGrokVideoMode(model, mode)];
}

export function isGrokImagineEditModel(model: string) {
    return mediaModelName(model) === GROK_IMAGINE_EDIT_MODEL;
}

/** Exact matcher retained for the 1.5-only single-image behavior. */
export function isGrokImagineVideoModel(model: string) {
    return mediaModelName(model) === GROK_IMAGINE_VIDEO_MODEL;
}

export function isGrokImagineVideoBaseModel(model: string) {
    return mediaModelName(model) === GROK_IMAGINE_VIDEO_BASE_MODEL;
}

export function isGrokImagineVideoFamilyModel(model: string) {
    return Boolean(grokVideoModelCapability(model));
}

export function normalizeGrokVideoMode(model: string, value: unknown): GrokVideoMode {
    const capability = grokVideoModelCapability(model);
    if (!capability) return "text-to-video";
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    return (GROK_VIDEO_MODES as readonly string[]).includes(normalized) && capability.operations[normalized as GrokVideoMode] ? (normalized as GrokVideoMode) : capability.defaultMode;
}

export function grokVideoModeLabel(mode: GrokVideoMode, language: LanguageName = useLanguageStore.getState().language) {
    const labels: Record<GrokVideoMode, [string, string]> = {
        "text-to-video": ["文生视频", "Text to video"],
        "image-to-video": ["图生视频", "Image to video"],
        "reference-to-video": ["参考图生视频", "Reference to video"],
        "edit-video": ["视频编辑", "Edit video"],
        "extend-video": ["视频延长", "Extend video"],
    };
    return language === "en" ? labels[mode][1] : labels[mode][0];
}

export function normalizeGrokVideoAspectRatio(value: string) {
    const normalized = value.trim().toLowerCase();
    const match = normalized.match(/^(\d+)[x×:](\d+)$/);
    if (!match) return "16:9";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "16:9";
    return width === height ? "1:1" : width > height ? "16:9" : "9:16";
}

export function normalizeGrokVideoResolution(value: string, model = GROK_IMAGINE_VIDEO_MODEL) {
    const normalized = value.trim().toLowerCase().endsWith("p") ? value.trim().toLowerCase() : `${value.trim().toLowerCase()}p`;
    const available = isGrokImagineVideoBaseModel(model) ? GROK_VIDEO_BASE_RESOLUTIONS : GROK_VIDEO_RESOLUTIONS;
    return (available as readonly string[]).includes(normalized) ? normalized : "720p";
}

export function grokVideoResolutionOptions(model: string, mode: unknown) {
    return grokVideoOperationCapability(model, mode)?.resolutions || [];
}

export function grokVideoUsesSourceOutput(model: string, mode: unknown) {
    return grokVideoOperationCapability(model, mode)?.aspectRatio === "source";
}

export function grokVideoBillingSeconds(mode: unknown, sourceDurationMs?: number) {
    if (mode !== "edit-video") return undefined;
    const duration = Number(sourceDurationMs || 0);
    return Number.isFinite(duration) && duration > 0 ? Math.ceil(duration / 1000) : undefined;
}

export function normalizeGrokReferencePrompt(prompt: string) {
    return prompt
        .replace(/图片\s*(\d+)/giu, (_match, index: string) => `<IMAGE_${Number(index)}>`)
        .replace(/\bImage\s*(\d+)\b/giu, (_match, index: string) => `<IMAGE_${Number(index)}>`);
}

export type GrokVideoRequestPayloadInput = {
    model: string;
    prompt: string;
    mode: unknown;
    duration: number;
    aspectRatio: string;
    resolution: string;
    imageUrls?: string[];
    videoUrls?: string[];
    sourceVideoDurationMs?: number;
};

export function buildGrokVideoRequestPayload(input: GrokVideoRequestPayloadInput): Record<string, unknown> {
    const mode = normalizeGrokVideoMode(input.model, input.mode);
    const payload: Record<string, unknown> = {
        model: mediaModelName(input.model),
        prompt: mode === "reference-to-video" ? normalizeGrokReferencePrompt(input.prompt) : input.prompt,
    };
    if (isGrokImagineVideoBaseModel(input.model)) payload.mode = mode;
    if (mode === "edit-video") {
        payload.video_url = input.videoUrls?.[0];
        payload.seconds = String(grokVideoBillingSeconds(mode, input.sourceVideoDurationMs));
        return payload;
    }
    if (mode === "extend-video") {
        payload.video_url = input.videoUrls?.[0];
        payload.duration = input.duration;
        return payload;
    }
    payload.duration = input.duration;
    payload.aspect_ratio = normalizeGrokVideoAspectRatio(input.aspectRatio);
    payload.resolution = normalizeGrokVideoResolution(input.resolution, input.model);
    if (mode === "image-to-video" || mode === "reference-to-video") payload.images = input.imageUrls || [];
    return payload;
}

export function relayBasesMediaText(zh: string, en: string, language: LanguageName = useLanguageStore.getState().language) {
    return language === "en" ? en : zh;
}

export function grokImageRequestError(model: string, referenceCount: number, outputCount = 1, language?: LanguageName) {
    const capability = grokImageModelCapability(model);
    if (!capability) return "";
    if (!referenceCount && !capability.generation) return relayBasesMediaText("grok-imagine-edit 仅支持图片编辑，请添加 1-3 张参考图", "grok-imagine-edit only supports image editing. Add 1-3 reference images.", language);
    if (referenceCount > capability.maxReferenceImages) return relayBasesMediaText(`当前 Grok 图片模型最多支持 ${capability.maxReferenceImages} 张参考图`, `The current Grok image model supports up to ${capability.maxReferenceImages} reference images.`, language);
    if (outputCount > capability.maxOutputs) return relayBasesMediaText(`当前 Grok 图片模型单次最多生成 ${capability.maxOutputs} 张图片`, `The current Grok image model can generate up to ${capability.maxOutputs} images per request.`, language);
    return "";
}

export type GrokVideoRequestState = {
    imageCount: number;
    videoCount?: number;
    audioCount?: number;
    duration?: number;
    sourceVideoDurationMs?: number;
    sourceVideoName?: string;
    sourceVideoType?: string;
};

export function grokVideoRequestError(model: string, mode: unknown, state: GrokVideoRequestState, language?: LanguageName) {
    const capability = grokVideoModelCapability(model);
    if (!capability) return "";
    const normalizedMode = normalizeGrokVideoMode(model, mode);
    const operation = capability.operations[normalizedMode];
    if (!operation) return relayBasesMediaText("当前 Grok 视频模型不支持所选生成模式", "The selected mode is not supported by this Grok video model.", language);
    const imageCount = state.imageCount || 0;
    const videoCount = state.videoCount || 0;
    const audioCount = state.audioCount || 0;
    if (audioCount) return relayBasesMediaText("Grok 视频模型不支持参考音频", "Grok video models do not support reference audio.", language);
    if (imageCount < operation.minReferenceImages || imageCount > operation.maxReferenceImages) {
        if (operation.maxReferenceImages === 0) return relayBasesMediaText(`“${grokVideoModeLabel(normalizedMode, "zh")}”不使用图片`, `“${grokVideoModeLabel(normalizedMode, "en")}” does not use images.`, language);
        if (operation.minReferenceImages === operation.maxReferenceImages) {
            return relayBasesMediaText(`“${grokVideoModeLabel(normalizedMode, "zh")}”必须使用 ${operation.minReferenceImages} 张图片`, `“${grokVideoModeLabel(normalizedMode, "en")}” requires exactly ${operation.minReferenceImages} image${operation.minReferenceImages === 1 ? "" : "s"}.`, language);
        }
        return relayBasesMediaText(`“${grokVideoModeLabel(normalizedMode, "zh")}”需要 ${operation.minReferenceImages}-${operation.maxReferenceImages} 张图片`, `“${grokVideoModeLabel(normalizedMode, "en")}” requires ${operation.minReferenceImages}-${operation.maxReferenceImages} images.`, language);
    }
    if (videoCount < operation.minReferenceVideos || videoCount > operation.maxReferenceVideos) {
        if (operation.maxReferenceVideos === 0) return relayBasesMediaText(`“${grokVideoModeLabel(normalizedMode, "zh")}”不使用视频输入`, `“${grokVideoModeLabel(normalizedMode, "en")}” does not use video input.`, language);
        if (operation.minReferenceVideos === operation.maxReferenceVideos) {
            return relayBasesMediaText(`“${grokVideoModeLabel(normalizedMode, "zh")}”必须使用 ${operation.minReferenceVideos} 个视频`, `“${grokVideoModeLabel(normalizedMode, "en")}” requires exactly ${operation.minReferenceVideos} video${operation.minReferenceVideos === 1 ? "" : "s"}.`, language);
        }
        return relayBasesMediaText(`“${grokVideoModeLabel(normalizedMode, "zh")}”需要 ${operation.minReferenceVideos}-${operation.maxReferenceVideos} 个视频`, `“${grokVideoModeLabel(normalizedMode, "en")}” requires ${operation.minReferenceVideos}-${operation.maxReferenceVideos} videos.`, language);
    }
    const duration = Number(state.duration);
    if (operation.minDuration !== undefined && operation.maxDuration !== undefined && (!Number.isFinite(duration) || duration < operation.minDuration || duration > operation.maxDuration)) {
        return relayBasesMediaText(`“${grokVideoModeLabel(normalizedMode, "zh")}”时长需要在 ${operation.minDuration}-${operation.maxDuration} 秒之间`, `“${grokVideoModeLabel(normalizedMode, "en")}” duration must be ${operation.minDuration}-${operation.maxDuration} seconds.`, language);
    }
    const sourceVideoType = String(state.sourceVideoType || "").split(";", 1)[0].trim().toLowerCase();
    if (operation.minReferenceVideos && ((sourceVideoType && sourceVideoType !== "video/mp4") || (!sourceVideoType && state.sourceVideoName && !state.sourceVideoName.toLowerCase().endsWith(".mp4")))) {
        return relayBasesMediaText("Grok 视频编辑和延长仅支持 MP4 输入", "Grok video editing and extension require an MP4 input.", language);
    }
    if (operation.minReferenceVideos && !state.sourceVideoDurationMs) {
        return relayBasesMediaText("无法读取源视频时长，请重新上传 MP4 后再试", "The source video duration could not be read. Upload the MP4 again and retry.", language);
    }
    if (operation.minSourceVideoDurationMs !== undefined && Number(state.sourceVideoDurationMs) < operation.minSourceVideoDurationMs) {
        return relayBasesMediaText(`源视频时长不能少于 ${formatVideoDurationLimit(operation.minSourceVideoDurationMs)}`, `The source video must be at least ${formatVideoDurationLimit(operation.minSourceVideoDurationMs)} long.`, language);
    }
    if (operation.maxSourceVideoDurationMs !== undefined && Number(state.sourceVideoDurationMs) > operation.maxSourceVideoDurationMs) {
        return relayBasesMediaText(`源视频时长不能超过 ${formatVideoDurationLimit(operation.maxSourceVideoDurationMs)}`, `The source video cannot exceed ${formatVideoDurationLimit(operation.maxSourceVideoDurationMs)}.`, language);
    }
    return "";
}

function formatVideoDurationLimit(durationMs: number) {
    return `${Number.isInteger(durationMs / 1000) ? durationMs / 1000 : (durationMs / 1000).toFixed(1)}s`;
}
