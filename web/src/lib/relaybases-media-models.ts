export const GROK_IMAGINE_EDIT_MODEL = "grok-imagine-edit";
export const GROK_IMAGINE_IMAGE_QUALITY_MODEL = "grok-imagine-image-quality";
export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video-1.5";

export const GROK_VIDEO_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;
export const GROK_VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"] as const;

type GrokImageCapability = {
    kind: "image";
    generation: boolean;
    edit: true;
    maxReferenceImages: 3;
    maxOutputs: 10;
};

type GrokVideoCapability = {
    kind: "video";
    asyncOnly: true;
    minReferenceImages: 1;
    maxReferenceImages: 1;
    minDuration: 1;
    maxDuration: 15;
    aspectRatios: typeof GROK_VIDEO_ASPECT_RATIOS;
    resolutions: typeof GROK_VIDEO_RESOLUTIONS;
};

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
    [GROK_IMAGINE_VIDEO_MODEL]: {
        kind: "video",
        asyncOnly: true,
        minReferenceImages: 1,
        maxReferenceImages: 1,
        minDuration: 1,
        maxDuration: 15,
        aspectRatios: GROK_VIDEO_ASPECT_RATIOS,
        resolutions: GROK_VIDEO_RESOLUTIONS,
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

export function isGrokImagineEditModel(model: string) {
    return mediaModelName(model) === GROK_IMAGINE_EDIT_MODEL;
}

export function isGrokImagineVideoModel(model: string) {
    return mediaModelName(model) === GROK_IMAGINE_VIDEO_MODEL;
}

export function normalizeGrokVideoAspectRatio(value: string) {
    const normalized = value.trim().toLowerCase();
    if ((GROK_VIDEO_ASPECT_RATIOS as readonly string[]).includes(normalized)) return normalized;
    const match = normalized.match(/^(\d+)[x×](\d+)$/);
    if (!match) return "16:9";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "16:9";
    const exactRatio = GROK_VIDEO_ASPECT_RATIOS.find((ratio) => {
        const [ratioWidth, ratioHeight] = ratio.split(":").map(Number);
        return width * ratioHeight === height * ratioWidth;
    });
    return exactRatio || (width === height ? "1:1" : width > height ? "16:9" : "9:16");
}

export function normalizeGrokVideoResolution(value: string) {
    const normalized = value.trim().toLowerCase().endsWith("p") ? value.trim().toLowerCase() : `${value.trim().toLowerCase()}p`;
    return (GROK_VIDEO_RESOLUTIONS as readonly string[]).includes(normalized) ? normalized : "720p";
}

export function grokImageRequestError(model: string, referenceCount: number, outputCount = 1) {
    const capability = grokImageModelCapability(model);
    if (!capability) return "";
    if (!referenceCount && !capability.generation) return "grok-imagine-edit 仅支持图片编辑，请添加 1-3 张参考图";
    if (referenceCount > capability.maxReferenceImages) return `当前 Grok 图片模型最多支持 ${capability.maxReferenceImages} 张参考图`;
    if (outputCount > capability.maxOutputs) return `当前 Grok 图片模型单次最多生成 ${capability.maxOutputs} 张图片`;
    return "";
}

export function grokVideoRequestError(model: string, imageCount: number, videoCount = 0, audioCount = 0) {
    const capability = grokVideoModelCapability(model);
    if (!capability) return "";
    if (videoCount || audioCount) return "grok-imagine-video-1.5 仅支持 1 张参考图，不支持参考视频或参考音频";
    if (imageCount !== capability.minReferenceImages) return "grok-imagine-video-1.5 必须且只能使用 1 张参考图";
    return "";
}
