import { GROK_IMAGINE_VIDEO_BASE_MODEL, GROK_IMAGINE_VIDEO_MODEL, isGrokImagineVideoFamilyModel, mediaModelName, normalizeGrokVideoMode, type GrokVideoMode } from "@/lib/relaybases-media-models";

export type RelayBasesVideoTiming = {
    min: number;
    max: number;
    defaultValue: number;
    options: number[];
    fixed?: boolean;
};

const DEFAULT_TIMING: RelayBasesVideoTiming = { min: 4, max: 15, defaultValue: 6, options: [4, 6, 8, 10, 15] };

const MODEL_TIMINGS: Record<string, RelayBasesVideoTiming> = {
    "veo-3-1": { min: 8, max: 8, defaultValue: 8, options: [8], fixed: true },
    "veo-omni-flash": { min: 10, max: 10, defaultValue: 10, options: [10], fixed: true },
    "veo-omni-flash-video-edit": { min: 4, max: 10, defaultValue: 10, options: [4, 6, 8, 10] },
    "video-fast-480p": DEFAULT_TIMING,
    "video-fast-720p": DEFAULT_TIMING,
    "video-pro-480p": DEFAULT_TIMING,
    "video-pro-720p": DEFAULT_TIMING,
    "video-pro-1080p": DEFAULT_TIMING,
    "video-standard-720p": { min: 15, max: 15, defaultValue: 15, options: [15], fixed: true },
    [GROK_IMAGINE_VIDEO_MODEL]: { min: 1, max: 15, defaultValue: 8, options: [1, 5, 8, 10, 15] },
    [GROK_IMAGINE_VIDEO_BASE_MODEL]: { min: 1, max: 15, defaultValue: 8, options: [1, 5, 8, 10, 15] },
};

const GROK_MODE_TIMINGS: Partial<Record<GrokVideoMode, RelayBasesVideoTiming>> = {
    "reference-to-video": { min: 1, max: 10, defaultValue: 8, options: [1, 5, 8, 10] },
    "edit-video": { min: 0, max: 0, defaultValue: 0, options: [], fixed: true },
    "extend-video": { min: 2, max: 10, defaultValue: 6, options: [2, 4, 6, 8, 10] },
};

export function relayBasesVideoTiming(model: string, mode?: unknown): RelayBasesVideoTiming {
    const modelName = mediaModelName(model);
    if (modelName === GROK_IMAGINE_VIDEO_BASE_MODEL) return GROK_MODE_TIMINGS[normalizeGrokVideoMode(modelName, mode)] || MODEL_TIMINGS[modelName];
    return MODEL_TIMINGS[modelName] || DEFAULT_TIMING;
}

export function normalizeRelayBasesVideoDuration(value: string, model: string, mode?: unknown) {
    const modelName = mediaModelName(model);
    const timing = relayBasesVideoTiming(modelName, mode);
    if (timing.fixed) return timing.defaultValue;
    const numericValue = Number(value);
    const seconds = isGrokImagineVideoFamilyModel(modelName) && (!Number.isFinite(numericValue) || numericValue < timing.min) ? timing.defaultValue : Math.floor(numericValue || timing.defaultValue);
    return Math.max(timing.min, Math.min(timing.max, seconds));
}
