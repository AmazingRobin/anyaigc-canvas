import { useLanguageStore, type LanguageName } from "@/stores/use-language-store";

export const GPT_IMAGE_2_MODEL = "gpt-image-2";
export const GPT_IMAGE_2_C_MODEL = "gpt-image-2-c";
export const GPT_IMAGE_2_5_SUNBURST_MODEL = "gpt-image-2.5-sunburst";
export const GPT_IMAGE_2_5_SUNBURST_C_MODEL = "gpt-image-2.5-sunburst-c";
export const GPT_IMAGE_2_5_FLARE_MODEL = "gpt-image-2.5-flare";
export const GPT_IMAGE_2_5_FLARE_C_MODEL = "gpt-image-2.5-flare-c";
export const GEMINI_FLASH_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const GEMINI_PRO_IMAGE_MODEL = "gemini-3-pro-image-preview";
export const GROK_IMAGINE_IMAGE_MODEL = "grok-imagine-image";
export const GROK_IMAGINE_IMAGE_PRO_MODEL = "grok-imagine-image-pro";
export const DOUBAO_SEEDREAM_5_MODEL = "doubao-seedream-5-0-260128";
export const DOUBAO_SEEDREAM_5_PRO_MODEL = "doubao-seedream-5-0-pro-260628";
export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video";
export const GROK_IMAGINE_VIDEO_15_MODEL = "grok-imagine-video-1.5";
export const KLING_MOTION_CONTROL_MODEL = "kling-motion-control";
export const KLING_OMNI_VIDEO_MODEL = "kling-omni-video";
export const KLING_OMNI_VIDEO_API_MODEL = "kling-v3-omni";
export const KLING_3_TURBO_MODEL = "kling-3.0-turbo";
export const MINIMAX_HAILUO_02_MODEL = "MiniMax-Hailuo-02";
export const MINIMAX_HAILUO_23_MODEL = "MiniMax-Hailuo-2.3";

export const ANYAIGC_MEDIA_MODEL_IDS = [
    GPT_IMAGE_2_MODEL,
    GPT_IMAGE_2_C_MODEL,
    GPT_IMAGE_2_5_SUNBURST_MODEL,
    GPT_IMAGE_2_5_SUNBURST_C_MODEL,
    GPT_IMAGE_2_5_FLARE_MODEL,
    GPT_IMAGE_2_5_FLARE_C_MODEL,
    GEMINI_FLASH_IMAGE_MODEL,
    GEMINI_PRO_IMAGE_MODEL,
    GROK_IMAGINE_IMAGE_MODEL,
    GROK_IMAGINE_IMAGE_PRO_MODEL,
    DOUBAO_SEEDREAM_5_MODEL,
    DOUBAO_SEEDREAM_5_PRO_MODEL,
    GROK_IMAGINE_VIDEO_MODEL,
    GROK_IMAGINE_VIDEO_15_MODEL,
    KLING_MOTION_CONTROL_MODEL,
    KLING_OMNI_VIDEO_MODEL,
    KLING_3_TURBO_MODEL,
    MINIMAX_HAILUO_02_MODEL,
    MINIMAX_HAILUO_23_MODEL,
] as const;

export type AnyAIGCMediaModelId = (typeof ANYAIGC_MEDIA_MODEL_IDS)[number];
export type VideoOperation = "text-to-video" | "image-to-video" | "first-last-frame" | "motion-control" | "omni-video";
type MediaLimits = { min: number; max: number };

type ImageCapability = {
    kind: "image";
    invocation: "openai" | "gemini" | "seedream";
    allowsReferences: boolean;
    allowsMask: boolean;
    maxReferences: number;
};

type VideoCapability = {
    kind: "video";
    invocation: "grok" | "kling-motion-control" | "kling-omni-video" | "kling-3-turbo" | "minimax-hailuo";
    defaultOperation: VideoOperation;
    operations: VideoOperation[];
    imageCount: MediaLimits;
    videoCount: MediaLimits;
};

export type MediaModelCapability = ImageCapability | VideoCapability;

export const ANYAIGC_MEDIA_MODEL_CAPABILITIES: Record<AnyAIGCMediaModelId, MediaModelCapability> = {
    [GPT_IMAGE_2_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true, maxReferences: 5 },
    [GPT_IMAGE_2_C_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true, maxReferences: 5 },
    [GPT_IMAGE_2_5_SUNBURST_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true, maxReferences: 5 },
    [GPT_IMAGE_2_5_SUNBURST_C_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true, maxReferences: 5 },
    [GPT_IMAGE_2_5_FLARE_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true, maxReferences: 5 },
    [GPT_IMAGE_2_5_FLARE_C_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true, maxReferences: 5 },
    [GEMINI_FLASH_IMAGE_MODEL]: { kind: "image", invocation: "gemini", allowsReferences: true, allowsMask: false, maxReferences: 5 },
    [GEMINI_PRO_IMAGE_MODEL]: { kind: "image", invocation: "gemini", allowsReferences: true, allowsMask: false, maxReferences: 5 },
    [GROK_IMAGINE_IMAGE_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: false, maxReferences: 1 },
    [GROK_IMAGINE_IMAGE_PRO_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: false, maxReferences: 1 },
    [DOUBAO_SEEDREAM_5_MODEL]: { kind: "image", invocation: "seedream", allowsReferences: true, allowsMask: false, maxReferences: 14 },
    [DOUBAO_SEEDREAM_5_PRO_MODEL]: { kind: "image", invocation: "seedream", allowsReferences: true, allowsMask: false, maxReferences: 10 },
    [GROK_IMAGINE_VIDEO_MODEL]: {
        kind: "video",
        invocation: "grok",
        defaultOperation: "text-to-video",
        operations: ["text-to-video", "image-to-video"],
        imageCount: { min: 0, max: 1 },
        videoCount: { min: 0, max: 0 },
    },
    [GROK_IMAGINE_VIDEO_15_MODEL]: {
        kind: "video",
        invocation: "grok",
        defaultOperation: "image-to-video",
        operations: ["image-to-video"],
        imageCount: { min: 1, max: 1 },
        videoCount: { min: 0, max: 0 },
    },
    [KLING_MOTION_CONTROL_MODEL]: {
        kind: "video",
        invocation: "kling-motion-control",
        defaultOperation: "motion-control",
        operations: ["motion-control"],
        imageCount: { min: 1, max: 1 },
        videoCount: { min: 1, max: 1 },
    },
    [KLING_OMNI_VIDEO_MODEL]: {
        kind: "video",
        invocation: "kling-omni-video",
        defaultOperation: "omni-video",
        operations: ["omni-video"],
        imageCount: { min: 0, max: 5 },
        videoCount: { min: 0, max: 1 },
    },
    [KLING_3_TURBO_MODEL]: {
        kind: "video",
        invocation: "kling-3-turbo",
        defaultOperation: "text-to-video",
        operations: ["text-to-video", "image-to-video"],
        imageCount: { min: 0, max: 1 },
        videoCount: { min: 0, max: 0 },
    },
    [MINIMAX_HAILUO_02_MODEL]: {
        kind: "video",
        invocation: "minimax-hailuo",
        defaultOperation: "text-to-video",
        operations: ["text-to-video", "image-to-video", "first-last-frame"],
        imageCount: { min: 0, max: 2 },
        videoCount: { min: 0, max: 0 },
    },
    [MINIMAX_HAILUO_23_MODEL]: {
        kind: "video",
        invocation: "minimax-hailuo",
        defaultOperation: "text-to-video",
        operations: ["text-to-video", "image-to-video", "first-last-frame"],
        imageCount: { min: 0, max: 2 },
        videoCount: { min: 0, max: 0 },
    },
};

export function mediaModelName(value: string) {
    const index = value.indexOf("::");
    return (index >= 0 ? value.slice(index + 2) : value).trim();
}

export function mediaModelCapability(value: string) {
    return ANYAIGC_MEDIA_MODEL_CAPABILITIES[mediaModelName(value) as AnyAIGCMediaModelId];
}

export function isAnyAIGCMediaModel(value: string): value is AnyAIGCMediaModelId {
    return Boolean(mediaModelCapability(value));
}

export function filterMediaModels(models: string[], kind?: MediaModelCapability["kind"]) {
    return models.filter((model) => {
        const capability = mediaModelCapability(model);
        return Boolean(capability && (!kind || capability.kind === kind));
    });
}

export function isGeminiImageModel(value: string) {
    const capability = mediaModelCapability(value);
    return capability?.kind === "image" && capability.invocation === "gemini";
}

export function isGrokImageModel(value: string) {
    const capability = mediaModelCapability(value);
    return capability?.kind === "image" && mediaModelName(value).startsWith("grok-imagine-image");
}

export function isSeedreamImageModel(value: string) {
    const capability = mediaModelCapability(value);
    return capability?.kind === "image" && capability.invocation === "seedream";
}

export function isSeedreamProImageModel(value: string) {
    return mediaModelName(value) === DOUBAO_SEEDREAM_5_PRO_MODEL;
}

export function imageReferenceLimit(model: string) {
    const capability = mediaModelCapability(model);
    if (!capability || capability.kind !== "image" || !capability.allowsReferences) return 0;
    return capability.maxReferences;
}

export function isGrokVideoModel(value: string) {
    return mediaModelCapability(value)?.kind === "video" && mediaModelCapability(value)?.invocation === "grok";
}

export function isKlingVideoModel(value: string) {
    const invocation = mediaModelCapability(value)?.kind === "video" ? mediaModelCapability(value).invocation : "";
    return invocation === "kling-motion-control" || invocation === "kling-omni-video" || invocation === "kling-3-turbo";
}

export function isKling3TurboVideoModel(value: string) {
    return mediaModelCapability(value)?.kind === "video" && mediaModelCapability(value)?.invocation === "kling-3-turbo";
}

export function isMiniMaxHailuoVideoModel(value: string) {
    return mediaModelCapability(value)?.kind === "video" && mediaModelCapability(value)?.invocation === "minimax-hailuo";
}

export function normalizeVideoOperation(model: string, value: unknown): VideoOperation {
    const capability = mediaModelCapability(model);
    if (!capability || capability.kind !== "video") return "text-to-video";
    return capability.operations.includes(value as VideoOperation) ? (value as VideoOperation) : capability.defaultOperation;
}

export type MediaRequestState = { imageCount?: number; videoCount?: number; hasMask?: boolean; operation?: unknown };

export function mediaRequestError(model: string, state: MediaRequestState, language: LanguageName = useLanguageStore.getState().language) {
    const capability = mediaModelCapability(model);
    if (!capability) return mediaText("当前模型未接入 AnyAIGC Canvas", "The selected model is not supported by AnyAIGC Canvas.", language);
    const images = state.imageCount || 0;
    const videos = state.videoCount || 0;
    if (capability.kind === "image") {
        if (images && !capability.allowsReferences) return mediaText("当前图片模型不支持参考图片", "The selected image model does not support reference images.", language);
        if (images > capability.maxReferences) return mediaText(`当前图片模型最多支持 ${capability.maxReferences} 张参考图`, `The selected image model supports up to ${capability.maxReferences} reference image${capability.maxReferences === 1 ? "" : "s"}.`, language);
        if (state.hasMask && !capability.allowsMask) return mediaText("当前图片模型不支持蒙版编辑", "The selected image model does not support masked editing.", language);
        return "";
    }
    if (!capability.operations.includes(normalizeVideoOperation(model, state.operation))) return mediaText("当前视频模型不支持所选生成方式", "The selected video model does not support this generation mode.", language);
    if (capability.invocation === "kling-3-turbo" && normalizeVideoOperation(model, state.operation) === "image-to-video" && images !== 1) return countError("图片", "image", { min: 1, max: 1 }, language);
    if (capability.invocation === "minimax-hailuo") {
        const operation = normalizeVideoOperation(model, state.operation);
        const requiredImages = operation === "text-to-video" ? 0 : operation === "image-to-video" ? 1 : 2;
        if (images !== requiredImages) return countError("图片", "image", { min: requiredImages, max: requiredImages }, language);
    }
    if (images < capability.imageCount.min || images > capability.imageCount.max) return countError("图片", "image", capability.imageCount, language);
    if (videos < capability.videoCount.min || videos > capability.videoCount.max) return countError("视频", "video", capability.videoCount, language);
    return "";
}

export function buildGrokVideoPayload(input: { model: string; prompt: string; size: string; imageUrls?: string[] }) {
    return {
        model: mediaModelName(input.model),
        prompt: input.prompt,
        aspect_ratio: normalizeAspectRatio(input.size),
        size: "720P",
        images: input.imageUrls || [],
    };
}

export function buildKlingMotionControlPayload(input: { prompt: string; imageUrl: string; videoUrl: string }) {
    return {
        model_name: KLING_MOTION_CONTROL_MODEL,
        prompt: input.prompt,
        image_url: input.imageUrl,
        video_url: input.videoUrl,
        keep_original_sound: "no",
        character_orientation: "image",
        mode: "std",
    };
}

export function buildKlingOmniVideoPayload(input: { prompt: string; duration: number; aspectRatio?: string; imageUrls?: string[]; videoUrls?: string[] }) {
    return {
        model_name: KLING_OMNI_VIDEO_API_MODEL,
        prompt: input.prompt,
        mode: "std",
        duration: String(normalizeVideoDuration(input.duration)),
        aspect_ratio: normalizeAspectRatio(input.aspectRatio || "16:9"),
        multi_shot: false,
        sound: "off",
        ...(input.imageUrls?.length ? { image_list: input.imageUrls.map((image_url, index) => ({ image_url, type: index === 0 ? "first_frame" : "reference" })) } : {}),
        ...(input.videoUrls?.length ? { video_list: input.videoUrls.map((video_url) => ({ video_url, refer_type: "feature", keep_original_sound: "no" })) } : {}),
    };
}

export function buildKling3TurboVideoPayload(input: { prompt: string; imageUrl?: string; duration: number; aspectRatio?: string; resolution?: string }) {
    const resolution = input.resolution === "1080p" ? "1080p" : "720p";
    const duration = normalizeKling3TurboDuration(input.duration);
    return input.imageUrl
        ? { contents: [{ type: "first_frame" as const, url: input.imageUrl }, ...(input.prompt.trim() ? [{ type: "prompt" as const, text: input.prompt }] : [])], settings: { resolution, aspect_ratio: normalizeAspectRatio(input.aspectRatio || "16:9"), duration } }
        : { prompt: input.prompt, settings: { resolution, aspect_ratio: normalizeAspectRatio(input.aspectRatio || "16:9"), duration } };
}

export function buildMiniMaxHailuoVideoPayload(input: { model: string; prompt: string; duration: number; operation: VideoOperation; imageUrls?: string[] }) {
    const imageUrls = input.imageUrls || [];
    return {
        model: mediaModelName(input.model),
        prompt: input.prompt,
        duration: normalizeMiniMaxHailuoDuration(input.duration),
        resolution: "768P",
        prompt_optimizer: true,
        ...(input.operation === "image-to-video" ? { first_frame_image: imageUrls[0] } : input.operation === "first-last-frame" ? { first_frame_image: imageUrls[0], last_frame_image: imageUrls[1] } : {}),
    };
}

export function normalizeVideoDuration(value: number | string) {
    const seconds = Math.round(Number(value) || 5);
    return Math.min(10, Math.max(3, seconds));
}

export function normalizeKling3TurboDuration(value: number | string) {
    const seconds = Math.round(Number(value) || 5);
    return Math.min(15, Math.max(3, seconds));
}

export function videoDurationLimits(model: string) {
    if (isMiniMaxHailuoVideoModel(model)) return { min: 6, max: 10 };
    return isKling3TurboVideoModel(model) ? { min: 3, max: 15 } : { min: 3, max: 10 };
}

export function videoDurationOptions(model: string) {
    if (isMiniMaxHailuoVideoModel(model)) return [6, 10];
    const { min, max } = videoDurationLimits(model);
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

export function videoReferenceImageLimit(model: string, operation: unknown) {
    if (!isMiniMaxHailuoVideoModel(model)) {
        const capability = mediaModelCapability(model);
        return capability?.kind === "video" ? capability.imageCount.max : 0;
    }
    const selectedOperation = normalizeVideoOperation(model, operation);
    return selectedOperation === "text-to-video" ? 0 : selectedOperation === "image-to-video" ? 1 : 2;
}

export function normalizeVideoDurationForModel(model: string, value: number | string) {
    if (isMiniMaxHailuoVideoModel(model)) return normalizeMiniMaxHailuoDuration(value);
    const limits = videoDurationLimits(model);
    const seconds = Math.round(Number(value) || 5);
    return Math.min(limits.max, Math.max(limits.min, seconds));
}

export function normalizeMiniMaxHailuoDuration(value: number | string) {
    return Number(value) >= 8 ? 10 : 6;
}

export function normalizeKling3TurboResolution(value: string) {
    return value === "1080" || value === "1080p" ? "1080p" : "720p";
}

export function normalizeAspectRatio(value: string) {
    return value === "9:16" || value === "1:1" ? value : "16:9";
}

const SEEDREAM_SIZE_PRESETS = [
    { value: "1024x1024", width: 1024, height: 1024, tier: "1K" as const },
    { value: "1152x864", width: 1152, height: 864, tier: "1K" as const },
    { value: "864x1152", width: 864, height: 1152, tier: "1K" as const },
    { value: "1424x800", width: 1424, height: 800, tier: "1K" as const },
    { value: "800x1424", width: 800, height: 1424, tier: "1K" as const },
    { value: "1248x832", width: 1248, height: 832, tier: "1K" as const },
    { value: "832x1248", width: 832, height: 1248, tier: "1K" as const },
    { value: "1568x672", width: 1568, height: 672, tier: "1K" as const },
    { value: "2048x2048", width: 2048, height: 2048, tier: "2K" as const },
    { value: "2368x1776", width: 2368, height: 1776, tier: "2K" as const },
    { value: "1776x2368", width: 1776, height: 2368, tier: "2K" as const },
    { value: "2816x1584", width: 2816, height: 1584, tier: "2K" as const },
    { value: "1584x2816", width: 1584, height: 2816, tier: "2K" as const },
    { value: "2496x1664", width: 2496, height: 1664, tier: "2K" as const },
    { value: "1664x2496", width: 1664, height: 2496, tier: "2K" as const },
    { value: "3136x1344", width: 3136, height: 1344, tier: "2K" as const },
];
const SEEDREAM_LITE_TIER_SIZES = ["2K", "3K", "4K"] as const;
const SEEDREAM_PRO_TIER_SIZES = ["1K", "2K"] as const;

export function seedreamImageSize(model: string, quality: string, size: string) {
    const pro = isSeedreamProImageModel(model);
    const requested = size.trim();
    if (/^[1-4]K$/i.test(requested)) {
        const tier = requested.toUpperCase();
        if (pro) return SEEDREAM_PRO_TIER_SIZES.includes(tier as (typeof SEEDREAM_PRO_TIER_SIZES)[number]) ? tier : "2K";
        return SEEDREAM_LITE_TIER_SIZES.includes(tier as (typeof SEEDREAM_LITE_TIER_SIZES)[number]) ? tier : "2K";
    }
    const dimensions = requested.match(/^(\d+)x(\d+)$/i);
    if (dimensions) {
        const width = Number(dimensions[1]);
        const height = Number(dimensions[2]);
        const presets = pro ? SEEDREAM_SIZE_PRESETS : SEEDREAM_SIZE_PRESETS.filter((item) => item.tier !== "1K");
        return presets.reduce((best, item) => (sizeDistance(width, height, item) < sizeDistance(width, height, best) ? item : best)).value;
    }
    const normalizedQuality = quality.trim().toLowerCase();
    if (normalizedQuality === "low") return pro ? "1K" : "2K";
    if (normalizedQuality === "high") return pro ? "2K" : "4K";
    return "2K";
}

function sizeDistance(width: number, height: number, candidate: { width: number; height: number }) {
    return Math.abs(Math.log(width / height) - Math.log(candidate.width / candidate.height)) + Math.abs(Math.log(Math.max(width, height)) - Math.log(Math.max(candidate.width, candidate.height))) * 0.25;
}

function countError(zh: string, en: string, limits: MediaLimits, language: LanguageName) {
    const exact = limits.min === limits.max;
    const quantity = exact ? `${limits.min}` : `${limits.min}-${limits.max}`;
    return mediaText(`当前视频模型需要 ${quantity} 个${zh}参考素材`, `The selected video model requires ${quantity} ${en} reference${exact && limits.min === 1 ? "" : "s"}.`, language);
}

function mediaText(zh: string, en: string, language: LanguageName) {
    return language === "en" ? en : zh;
}
