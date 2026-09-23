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
export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video";
export const GROK_IMAGINE_VIDEO_15_MODEL = "grok-imagine-video-1.5";
export const KLING_MOTION_CONTROL_MODEL = "kling-motion-control";
export const KLING_OMNI_VIDEO_MODEL = "kling-omni-video";
export const KLING_OMNI_VIDEO_API_MODEL = "kling-v3-omni";
export const KLING_3_TURBO_MODEL = "kling-3.0-turbo";
export const MINIMAX_HAILUO_02_MODEL = "MiniMax-Hailuo-02";
export const MINIMAX_HAILUO_23_MODEL = "MiniMax-Hailuo-2.3";
export const SEEDANCE_2_5_MODEL = "doubao-seedance-2-5-260628";
export const SEEDANCE_2_0_MODEL = "doubao-seedance-2-0-260128";
export const SEEDANCE_2_0_FAST_MODEL = "doubao-seedance-2-0-fast-260128";
const SEEDANCE_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"] as const;

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
    GROK_IMAGINE_VIDEO_MODEL,
    GROK_IMAGINE_VIDEO_15_MODEL,
    KLING_MOTION_CONTROL_MODEL,
    KLING_OMNI_VIDEO_MODEL,
    KLING_3_TURBO_MODEL,
    MINIMAX_HAILUO_02_MODEL,
    MINIMAX_HAILUO_23_MODEL,
    SEEDANCE_2_5_MODEL,
    SEEDANCE_2_0_MODEL,
    SEEDANCE_2_0_FAST_MODEL,
] as const;

export type AnyAIGCMediaModelId = (typeof ANYAIGC_MEDIA_MODEL_IDS)[number];
export type VideoOperation = "text-to-video" | "image-to-video" | "first-last-frame" | "motion-control" | "omni-video";
type MediaLimits = { min: number; max: number };

type ImageCapability = {
    kind: "image";
    invocation: "openai" | "gemini";
    allowsReferences: boolean;
    allowsMask: boolean;
};

type VideoCapability = {
    kind: "video";
    invocation: "grok" | "kling-motion-control" | "kling-omni-video" | "kling-3-turbo" | "minimax-hailuo" | "seedance";
    defaultOperation: VideoOperation;
    operations: VideoOperation[];
    imageCount: MediaLimits;
    videoCount: MediaLimits;
    audioCount?: MediaLimits;
};

export type MediaModelCapability = ImageCapability | VideoCapability;

export const ANYAIGC_MEDIA_MODEL_CAPABILITIES: Record<AnyAIGCMediaModelId, MediaModelCapability> = {
    [GPT_IMAGE_2_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true },
    [GPT_IMAGE_2_C_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true },
    [GPT_IMAGE_2_5_SUNBURST_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true },
    [GPT_IMAGE_2_5_SUNBURST_C_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true },
    [GPT_IMAGE_2_5_FLARE_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true },
    [GPT_IMAGE_2_5_FLARE_C_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: true },
    [GEMINI_FLASH_IMAGE_MODEL]: { kind: "image", invocation: "gemini", allowsReferences: true, allowsMask: false },
    [GEMINI_PRO_IMAGE_MODEL]: { kind: "image", invocation: "gemini", allowsReferences: true, allowsMask: false },
    [GROK_IMAGINE_IMAGE_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: false },
    [GROK_IMAGINE_IMAGE_PRO_MODEL]: { kind: "image", invocation: "openai", allowsReferences: true, allowsMask: false },
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
    [SEEDANCE_2_5_MODEL]: seedanceCapability({ images: 30, videos: 10, audios: 10 }),
    [SEEDANCE_2_0_MODEL]: seedanceCapability({ images: 9, videos: 3, audios: 3 }),
    [SEEDANCE_2_0_FAST_MODEL]: seedanceCapability({ images: 9, videos: 3, audios: 3 }),
};

function seedanceCapability(limits: { images: number; videos: number; audios: number }): VideoCapability {
    return {
        kind: "video",
        invocation: "seedance",
        defaultOperation: "omni-video",
        operations: ["omni-video", "image-to-video", "first-last-frame"],
        imageCount: { min: 0, max: limits.images },
        videoCount: { min: 0, max: limits.videos },
        audioCount: { min: 0, max: limits.audios },
    };
}

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

export function isSeedanceVideoModel(value: string) {
    return mediaModelCapability(value)?.kind === "video" && mediaModelCapability(value)?.invocation === "seedance";
}

export function isSeedanceFrameOperation(model: string, operation: unknown) {
    if (!isSeedanceVideoModel(model)) return false;
    const selected = normalizeVideoOperation(model, operation);
    return selected === "image-to-video" || selected === "first-last-frame";
}

export function seedanceForcesAdaptiveRatio(model: string, operation: unknown) {
    return mediaModelName(model) === SEEDANCE_2_5_MODEL && isSeedanceFrameOperation(model, operation);
}

export function normalizeVideoOperation(model: string, value: unknown): VideoOperation {
    const capability = mediaModelCapability(model);
    if (!capability || capability.kind !== "video") return "text-to-video";
    return capability.operations.includes(value as VideoOperation) ? (value as VideoOperation) : capability.defaultOperation;
}

export type MediaRequestState = { imageCount?: number; videoCount?: number; audioCount?: number; hasMask?: boolean; operation?: unknown };

export function mediaRequestError(model: string, state: MediaRequestState, language: LanguageName = useLanguageStore.getState().language) {
    const capability = mediaModelCapability(model);
    if (!capability) return mediaText("当前模型未接入 AnyAIGC Canvas", "The selected model is not supported by AnyAIGC Canvas.", language);
    const images = state.imageCount || 0;
    const videos = state.videoCount || 0;
    const audios = state.audioCount || 0;
    if (capability.kind === "image") {
        if (images && !capability.allowsReferences) return mediaText("当前图片模型不支持参考图片", "The selected image model does not support reference images.", language);
        if (isGrokImageModel(model) && images > 1) return mediaText("当前 Grok 图片模型仅支持一张参考图", "The selected Grok image model supports exactly one reference image.", language);
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
    if (capability.invocation === "seedance" && isSeedanceFrameOperation(model, state.operation)) {
        const requiredImages = normalizeVideoOperation(model, state.operation) === "image-to-video" ? 1 : 2;
        if (images !== requiredImages) return countError("图片", "image", { min: requiredImages, max: requiredImages }, language);
        if (videos || audios) return mediaText("首帧和首尾帧模式不能同时使用参考视频或参考音频", "First-frame and first & last frame modes cannot be combined with reference video or audio.", language);
    }
    if (images < capability.imageCount.min || images > capability.imageCount.max) return countError("图片", "image", capability.imageCount, language);
    if (videos < capability.videoCount.min || videos > capability.videoCount.max) return countError("视频", "video", capability.videoCount, language);
    const audioLimits = capability.audioCount || { min: 0, max: 0 };
    if (audios < audioLimits.min || audios > audioLimits.max) return countError("音频", "audio", audioLimits, language);
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

export type SeedanceImageRole = "reference_image" | "first_frame" | "last_frame";
export type SeedanceContentItem =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string }; role: SeedanceImageRole }
    | { type: "video_url"; video_url: { url: string }; role: "reference_video" }
    | { type: "audio_url"; audio_url: { url: string }; role: "reference_audio" };

export function buildSeedanceVideoPayload(input: {
    model: string;
    prompt: string;
    duration?: number | string;
    operation?: unknown;
    aspectRatio?: string;
    resolution?: string;
    generateAudio?: boolean;
    watermark?: boolean;
    imageUrls?: string[];
    videoUrls?: string[];
    audioUrls?: string[];
}) {
    const operation = normalizeVideoOperation(input.model, input.operation);
    const frameMode = operation === "image-to-video" || operation === "first-last-frame";
    const images = input.imageUrls || [];
    const content: SeedanceContentItem[] = [{ type: "text", text: input.prompt }];
    if (operation === "first-last-frame") {
        const roles: SeedanceImageRole[] = ["first_frame", "last_frame"];
        images.slice(0, 2).forEach((url, index) => content.push({ type: "image_url", image_url: { url }, role: roles[index] }));
    } else if (operation === "image-to-video") {
        for (const url of images.slice(0, 1)) content.push({ type: "image_url", image_url: { url }, role: "first_frame" });
    } else {
        for (const url of images) content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
    }
    // The three image modes are mutually exclusive upstream: frame modes must not carry omni references.
    if (!frameMode) {
        for (const url of input.videoUrls || []) content.push({ type: "video_url", video_url: { url }, role: "reference_video" });
        for (const url of input.audioUrls || []) content.push({ type: "audio_url", audio_url: { url }, role: "reference_audio" });
    }
    return {
        model: mediaModelName(input.model),
        content,
        generate_audio: input.generateAudio !== false,
        ratio: seedanceForcesAdaptiveRatio(input.model, operation) ? "adaptive" : normalizeSeedanceAspectRatio(input.aspectRatio || "adaptive"),
        duration: normalizeSeedanceDuration(input.model, input.duration),
        resolution: normalizeSeedanceResolution(input.model, input.resolution),
        watermark: input.watermark === true,
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
    if (isSeedanceVideoModel(model)) return { min: 4, max: mediaModelName(model) === SEEDANCE_2_5_MODEL ? 30 : 15 };
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
        if (capability?.kind !== "video") return 0;
        if (isSeedanceFrameOperation(model, operation)) return normalizeVideoOperation(model, operation) === "image-to-video" ? 1 : 2;
        return capability.imageCount.max;
    }
    const selectedOperation = normalizeVideoOperation(model, operation);
    return selectedOperation === "text-to-video" ? 0 : selectedOperation === "image-to-video" ? 1 : 2;
}

export function videoReferenceVideoLimit(model: string, operation: unknown) {
    const capability = mediaModelCapability(model);
    if (capability?.kind !== "video") return 0;
    return isSeedanceFrameOperation(model, operation) ? 0 : capability.videoCount.max;
}

export function videoReferenceAudioLimit(model: string, operation?: unknown) {
    const capability = mediaModelCapability(model);
    if (capability?.kind !== "video") return 0;
    return isSeedanceFrameOperation(model, operation) ? 0 : capability.audioCount?.max || 0;
}

export function normalizeVideoDurationForModel(model: string, value: number | string) {
    if (isMiniMaxHailuoVideoModel(model)) return normalizeMiniMaxHailuoDuration(value);
    if (isSeedanceVideoModel(model)) return normalizeSeedanceDuration(model, value);
    const limits = videoDurationLimits(model);
    const seconds = Math.round(Number(value) || 5);
    return Math.min(limits.max, Math.max(limits.min, seconds));
}

export function normalizeSeedanceDuration(model: string, value?: number | string) {
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

export function normalizeSeedanceResolution(model: string, value?: string) {
    const normalized = String(value || "")
        .toLowerCase()
        .replace(/^(480|720|1080)$/, "$1p");
    const options = seedanceResolutionOptions(model);
    if (normalized === "480p") return "480p";
    // Values above the model ceiling step down to the highest supported option instead of dropping to 720p.
    if (normalized === "4k") return options.includes("4k") ? "4k" : options.includes("1080p") ? "1080p" : "720p";
    if (normalized === "1080p") return options.includes("1080p") ? "1080p" : "720p";
    return "720p";
}

export function seedanceResolutionOptions(model: string) {
    // Upstream ceilings differ per model: 2.0 standard reaches 4k, 2.5 stops at 1080p, 2.0-fast at 720p.
    const name = mediaModelName(model);
    if (name === SEEDANCE_2_0_FAST_MODEL) return ["480p", "720p"];
    if (name === SEEDANCE_2_0_MODEL) return ["480p", "720p", "1080p", "4k"];
    return ["480p", "720p", "1080p"];
}

export function normalizeAspectRatio(value: string, model = "") {
    if (isSeedanceVideoModel(model)) return normalizeSeedanceAspectRatio(value);
    return value === "9:16" || value === "1:1" ? value : "16:9";
}

export function normalizeSeedanceAspectRatio(value: string) {
    // Unsupported values fall back to the upstream default rather than forcing a crop to 16:9.
    return (SEEDANCE_ASPECT_RATIOS as readonly string[]).includes(value) ? value : "adaptive";
}

export function seedanceAspectRatioOptions() {
    return [...SEEDANCE_ASPECT_RATIOS];
}

export function supportsVideoResolution(model: string) {
    return isKling3TurboVideoModel(model) || isSeedanceVideoModel(model);
}

export function supportsVideoAudioGeneration(model: string) {
    return isSeedanceVideoModel(model);
}

function countError(zh: string, en: string, limits: MediaLimits, language: LanguageName) {
    const exact = limits.min === limits.max;
    const quantity = exact ? `${limits.min}` : `${limits.min}-${limits.max}`;
    return mediaText(`当前视频模型需要 ${quantity} 个${zh}参考素材`, `The selected video model requires ${quantity} ${en} reference${exact && limits.min === 1 ? "" : "s"}.`, language);
}

function mediaText(zh: string, en: string, language: LanguageName) {
    return language === "en" ? en : zh;
}
