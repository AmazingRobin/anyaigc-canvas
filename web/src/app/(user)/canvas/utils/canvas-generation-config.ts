import { isGrokImagineVideoModel, normalizeGrokVideoAspectRatio, normalizeGrokVideoResolution } from "@/lib/relaybases-media-models";
import { normalizeRelayBasesVideoDuration } from "@/lib/relaybases-video";
import { defaultConfig, normalizeModelOptionValue, normalizeVideoCallMode, selectableModelsByCapability, type AiConfig } from "@/stores/use-config-store";
import type { CanvasGenerationMode, CanvasNodeData } from "../types";

export function buildCanvasGenerationConfig(config: AiConfig, node: CanvasNodeData | undefined, mode: CanvasGenerationMode): AiConfig {
    const selectedModel = resolveModeModel(config, node?.metadata?.model, mode);
    const grokVideo = mode === "video" && isGrokImagineVideoModel(selectedModel);
    const storedSize = node?.metadata?.size || config.size || defaultConfig.size;
    const storedSeconds = node?.metadata?.seconds || config.videoSeconds || defaultConfig.videoSeconds;
    const storedResolution = node?.metadata?.vquality || config.vquality || defaultConfig.vquality;
    return {
        ...config,
        model: selectedModel,
        imageModel: mode === "image" ? selectedModel : config.imageModel,
        videoModel: mode === "video" ? selectedModel : config.videoModel,
        textModel: mode === "text" ? selectedModel : config.textModel,
        audioModel: mode === "audio" ? selectedModel : config.audioModel,
        quality: node?.metadata?.quality || config.quality || defaultConfig.quality,
        size: grokVideo ? normalizeGrokVideoAspectRatio(storedSize) : storedSize,
        videoSeconds: grokVideo ? String(normalizeRelayBasesVideoDuration(storedSeconds, selectedModel)) : storedSeconds,
        videoCallMode: grokVideo ? "async" : normalizeVideoCallMode(node?.metadata?.videoCallMode || config.videoCallMode),
        vquality: grokVideo ? normalizeGrokVideoResolution(storedResolution) : storedResolution,
        videoGenerateAudio: node?.metadata?.generateAudio || config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node?.metadata?.watermark || config.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node?.metadata?.audioVoice || config.audioVoice || defaultConfig.audioVoice,
        audioFormat: node?.metadata?.audioFormat || config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node?.metadata?.audioSpeed || config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node?.metadata?.audioInstructions || config.audioInstructions || defaultConfig.audioInstructions,
        count: String(node?.metadata?.count || (mode === "image" ? config.canvasImageCount || config.count : config.count) || defaultConfig.count),
    };
}

function resolveModeModel(config: AiConfig, storedModel: string | undefined, mode: CanvasGenerationMode) {
    const defaultModel = mode === "image" ? config.imageModel : mode === "video" ? config.videoModel : mode === "audio" ? config.audioModel : config.textModel;
    const fallbackModel = mode === "audio" ? defaultConfig.audioModel : mode === "text" ? defaultConfig.textModel : config.model || defaultConfig.model;
    return validModeModel(config, storedModel, mode) || validModeModel(config, defaultModel, mode) || validModeModel(config, fallbackModel, mode) || defaultModel || fallbackModel || "";
}

function validModeModel(config: AiConfig, value: string | undefined, mode: CanvasGenerationMode) {
    const model = value?.trim();
    if (!model) return "";
    const normalized = normalizeModelOptionValue(model, config.channels);
    return normalized && selectableModelsByCapability(config, mode).includes(normalized) ? normalized : "";
}
