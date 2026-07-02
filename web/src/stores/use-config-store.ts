"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

export type ApiCallFormat = "openai" | "gemini";

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: string[];
};

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    mediaApiKey: string;
    textApiKey: string;
    apiFormat: ApiCallFormat;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    videoCallMode: "sync" | "async";
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    models: string[];
    imageModels: string[];
    videoModels: string[];
    textModels: string[];
    audioModels: string[];
    quality: string;
    size: string;
    count: string;
    canvasImageCount: string;
};

export type WebdavSyncConfig = {
    proxyMode: "direct" | "nextjs";
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};

export type CloudSyncConfig = {
    enabled: boolean;
    lastSyncedAt: string;
    lastError: string;
};

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
export type ModelCapability = "image" | "video" | "text" | "audio";
const CHANNEL_MODEL_SEPARATOR = "::";
export const RELAYBASES_MEDIA_BASE_URL = "https://image-2.relaybases.com";
export const RELAYBASES_TEXT_BASE_URL = "https://api.relaybases.com";
export const RELAYBASES_BASE_URL = RELAYBASES_MEDIA_BASE_URL;
export const RELAYBASES_CHANNEL_ID = "relaybases";
export const RELAYBASES_TEXT_CHANNEL_ID = "relaybases-text";
export const RELAYBASES_RECOMMENDED_IMAGE_KEY_GROUP = "gpt-image-2";
export const RELAYBASES_RECOMMENDED_TEXT_KEY_GROUP = "codex-pro";
export const RELAYBASES_SYNC_IMAGE_MODELS = ["gpt-image-2", "nana-banana-2_sync", "nana-banana-pro_sync"] as const;
export const RELAYBASES_ASYNC_IMAGE_MODELS = ["nana-banana-2", "nana-banana-pro"] as const;
export const RELAYBASES_VIDEO_MODELS = ["veo-3-1", "veo-omni-flash", "veo-omni-flash-video-edit", "video-fast-480p", "video-fast-720p", "video-pro-480p", "video-pro-720p", "video-pro-1080p", "video-standard-720p"] as const;
export const RELAYBASES_IMAGE_MODELS = [...RELAYBASES_SYNC_IMAGE_MODELS, ...RELAYBASES_ASYNC_IMAGE_MODELS] as const;
export const RELAYBASES_MEDIA_MODELS = [...RELAYBASES_IMAGE_MODELS, ...RELAYBASES_VIDEO_MODELS] as const;
export const RELAYBASES_MODELS = RELAYBASES_MEDIA_MODELS;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const RELAYBASES_DEFAULT_IMAGE_MODEL = `${RELAYBASES_CHANNEL_ID}${CHANNEL_MODEL_SEPARATOR}gpt-image-2`;
const RELAYBASES_DEFAULT_VIDEO_MODEL = `${RELAYBASES_CHANNEL_ID}${CHANNEL_MODEL_SEPARATOR}veo-3-1`;
const RELAYBASES_MODEL_OPTIONS = RELAYBASES_MODELS.map((model) => `${RELAYBASES_CHANNEL_ID}${CHANNEL_MODEL_SEPARATOR}${model}`);
const RELAYBASES_IMAGE_MODEL_OPTIONS = RELAYBASES_IMAGE_MODELS.map((model) => `${RELAYBASES_CHANNEL_ID}${CHANNEL_MODEL_SEPARATOR}${model}`);
const RELAYBASES_VIDEO_MODEL_OPTIONS = RELAYBASES_VIDEO_MODELS.map((model) => `${RELAYBASES_CHANNEL_ID}${CHANNEL_MODEL_SEPARATOR}${model}`);

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: RELAYBASES_BASE_URL,
    apiKey: "",
    mediaApiKey: "",
    textApiKey: "",
    apiFormat: "openai",
    channels: [
        {
            id: RELAYBASES_CHANNEL_ID,
            name: "RelayBases Media",
            baseUrl: RELAYBASES_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: [...RELAYBASES_MODELS],
        },
        {
            id: RELAYBASES_TEXT_CHANNEL_ID,
            name: "RelayBases Text",
            baseUrl: RELAYBASES_TEXT_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: [],
        },
    ],
    model: RELAYBASES_DEFAULT_IMAGE_MODEL,
    imageModel: RELAYBASES_DEFAULT_IMAGE_MODEL,
    videoModel: RELAYBASES_DEFAULT_VIDEO_MODEL,
    videoCallMode: "sync",
    textModel: "",
    audioModel: "",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    models: RELAYBASES_MODEL_OPTIONS,
    imageModels: RELAYBASES_IMAGE_MODEL_OPTIONS,
    videoModels: RELAYBASES_VIDEO_MODEL_OPTIONS,
    textModels: [],
    audioModels: [],
    quality: "auto",
    size: "1:1",
    count: "3",
    canvasImageCount: "3",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    proxyMode: "direct",
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

export const defaultCloudSyncConfig: CloudSyncConfig = {
    enabled: false,
    lastSyncedAt: "",
    lastError: "",
};

type ConfigStore = {
    config: AiConfig;
    cloudSync: CloudSyncConfig;
    webdav: WebdavSyncConfig;
    isConfigOpen: boolean;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    updateConfigValues: (values: Partial<AiConfig>) => void;
    updateCloudSyncConfig: <K extends keyof CloudSyncConfig>(key: K, value: CloudSyncConfig[K]) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

function isVideoModelName(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("seedance") || value.includes("video") || value.includes("sora") || value.includes("veo") || value.includes("kling") || value.includes("wan") || value.includes("hailuo");
}

function isImageModelName(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return (
        !isVideoModelName(model) &&
        !isAudioModelName(model) &&
        (value.includes("nana-banana") ||
            value.includes("seedream") ||
            value.includes("gpt-image") ||
            value.includes("image") ||
            value.includes("dall-e") ||
            value.includes("dalle") ||
            value.includes("imagen") ||
            value.includes("flux") ||
            value.includes("sdxl") ||
            value.includes("stable-diffusion") ||
            value.includes("midjourney"))
    );
}

function isAudioModelName(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("audio") || value.includes("tts") || value.includes("speech") || value.includes("voice") || value.includes("music") || value.includes("sound");
}

function isTextModelName(model: string) {
    return !isImageModelName(model) && !isVideoModelName(model) && !isAudioModelName(model);
}

export function modelMatchesCapability(model: string, capability?: ModelCapability) {
    if (!capability) return true;
    if (capability === "image") return isImageModelName(model);
    if (capability === "video") return isVideoModelName(model);
    if (capability === "audio") return isAudioModelName(model);
    return isTextModelName(model);
}

export function filterModelsByCapability(models: string[], capability?: ModelCapability) {
    return capability ? models.filter((model) => modelMatchesCapability(model, capability)) : models;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    return config[modelListKey(capability)];
}

function modelListKey(capability: ModelCapability) {
    return `${capability}Models` as "imageModels" | "videoModels" | "textModels" | "audioModels";
}

function isAiConfigReady(config: AiConfig, model: string) {
    const channel = resolveModelChannel(config, model);
    return Boolean(model.trim() && channel.baseUrl.trim() && channel.apiKey.trim());
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            cloudSync: defaultCloudSyncConfig,
            webdav: defaultWebdavSyncConfig,
            isConfigOpen: false,
            shouldPromptContinue: false,
            updateConfig: (key, value) => set((state) => ({ config: normalizeRelayBasesConfig({ ...state.config, [key]: value }) })),
            updateConfigValues: (values) => set((state) => ({ config: normalizeRelayBasesConfig({ ...state.config, ...values }) })),
            updateCloudSyncConfig: (key, value) =>
                set((state) => ({
                    cloudSync: {
                        ...state.cloudSync,
                        [key]: value,
                    },
                })),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false) => set({ isConfigOpen: true, shouldPromptContinue }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            version: 2,
            migrate: (persisted, version) => {
                const persistedState = (persisted || {}) as {
                    config?: Partial<AiConfig>;
                    cloudSync?: Partial<CloudSyncConfig>;
                    webdav?: Partial<WebdavSyncConfig>;
                };
                const migratedConfig = { ...defaultConfig, ...(persistedState.config || {}) };
                if (version < 2) {
                    if (!migratedConfig.count || String(migratedConfig.count) === "1") migratedConfig.count = "3";
                    if (!migratedConfig.canvasImageCount || String(migratedConfig.canvasImageCount) === "1") migratedConfig.canvasImageCount = "3";
                }
                return {
                    config: migratedConfig,
                    cloudSync: { ...defaultCloudSyncConfig, ...(persistedState.cloudSync || {}) },
                    webdav: { ...defaultWebdavSyncConfig, ...(persistedState.webdav || {}) },
                };
            },
            partialize: (state) => ({ config: state.config, cloudSync: state.cloudSync, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedCloudSync = (persistedState.cloudSync || {}) as Partial<CloudSyncConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const config = normalizeRelayBasesConfig({ ...defaultConfig, ...persistedConfig });
                return {
                    ...current,
                    cloudSync: { ...defaultCloudSyncConfig, ...persistedCloudSync },
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    config,
                };
            },
        },
    ),
);

function normalizeModelList(models: string[], channels: ModelChannel[]) {
    const allModelOptions = channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model)));
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)))
        .map((model) => normalizeModelOptionValue(model, channels))
        .filter((model) => !allModelOptions.length || allModelOptions.includes(model) || !isChannelModelValue(model));
}

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => ({ ...config, channelMode: "local" as const }), [config]);
}

export function createModelChannel(channel?: Partial<ModelChannel>): ModelChannel {
    const apiFormat = normalizeApiFormat(channel?.apiFormat);
    return {
        id: channel?.id?.trim() || nanoid(),
        name: channel?.name?.trim() || "新渠道",
        baseUrl: channel?.baseUrl?.trim() || defaultBaseUrlForApiFormat(apiFormat),
        apiKey: channel?.apiKey || "",
        apiFormat,
        models: uniqueRawModels(channel?.models || []),
    };
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function isRelayBasesSyncImageModel(model: string) {
    return (RELAYBASES_SYNC_IMAGE_MODELS as readonly string[]).includes(modelOptionName(model));
}

export function isRelayBasesAsyncImageModel(model: string) {
    return (RELAYBASES_ASYNC_IMAGE_MODELS as readonly string[]).includes(modelOptionName(model));
}

export function isRelayBasesAsyncTaskModel(model: string) {
    const name = modelOptionName(model);
    return isRelayBasesAsyncImageModel(name);
}

export function relayBasesModelBillingLabel(model: string) {
    if (isRelayBasesAsyncTaskModel(model)) return "异步·4倍扣费";
    if (isRelayBasesSyncImageModel(model)) return "同步";
    return "";
}

export function isRelayBasesVideoModel(model: string) {
    return (RELAYBASES_VIDEO_MODELS as readonly string[]).includes(modelOptionName(model));
}

export function normalizeVideoCallMode(value: unknown): AiConfig["videoCallMode"] {
    return value === "async" ? "async" : "sync";
}

export function modelOptionLabel(_config: AiConfig, value: string) {
    return modelOptionName(value);
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model))));
}

export function preferredTextModelOption(models: string[]) {
    return models.find((model) => modelOptionName(model).toLowerCase() === "gpt-5.5") || models[0] || "";
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        return channel && channel.models.includes(decoded.model) ? model : "";
    }
    const channel = channels.find((item) => item.models.includes(model)) || channels[0];
    return channel && channel.models.includes(model) ? encodeChannelModel(channel.id, model) : model;
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const model = decoded?.model || value;
    const matched = decoded ? config.channels.find((channel) => channel.id === decoded.channelId) : config.channels.find((channel) => channel.models.includes(model));
    return matched || config.channels[0] || createModelChannel({ id: "default", name: "默认渠道", baseUrl: config.baseUrl, apiKey: config.apiKey, apiFormat: config.apiFormat, models: config.models.map(modelOptionName) });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const channel = resolveModelChannel(config, value);
    return {
        ...config,
        model: modelOptionName(value || config.model),
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        apiFormat: channel.apiFormat,
    };
}

function createRelayBasesMediaChannel(apiKey = ""): ModelChannel {
    return createModelChannel({
        id: RELAYBASES_CHANNEL_ID,
        name: "RelayBases Media",
        baseUrl: RELAYBASES_BASE_URL,
        apiKey,
        apiFormat: "openai",
        models: [...RELAYBASES_MODELS],
    });
}

function createRelayBasesTextChannel(apiKey = "", models: string[] = []): ModelChannel {
    return createModelChannel({
        id: RELAYBASES_TEXT_CHANNEL_ID,
        name: "RelayBases Text",
        baseUrl: RELAYBASES_TEXT_BASE_URL,
        apiKey,
        apiFormat: "openai",
        models: filterModelsByCapability(uniqueRawModels(models), "text"),
    });
}

function normalizeRelayBasesConfig(config: AiConfig): AiConfig {
    const channels = normalizeChannels(config);
    const models = modelOptionsFromChannels(channels);
    const normalizedImageModel = normalizeModelOptionValue(config.imageModel || config.model, channels);
    const normalizedVideoModel = normalizeModelOptionValue(config.videoModel, channels);
    const textModelOptions = channels.filter((channel) => channel.id === RELAYBASES_TEXT_CHANNEL_ID).flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model)));
    const normalizedTextModel = normalizeModelOptionValue(config.textModel, channels);
    const imageModel = RELAYBASES_IMAGE_MODEL_OPTIONS.includes(normalizedImageModel) ? normalizedImageModel : RELAYBASES_DEFAULT_IMAGE_MODEL;
    const videoModel = RELAYBASES_VIDEO_MODEL_OPTIONS.includes(normalizedVideoModel) ? normalizedVideoModel : RELAYBASES_DEFAULT_VIDEO_MODEL;
    const textModel = textModelOptions.includes(normalizedTextModel) ? normalizedTextModel : preferredTextModelOption(textModelOptions);
    const mediaApiKey = channels.find((channel) => channel.id === RELAYBASES_CHANNEL_ID)?.apiKey || "";
    const textApiKey = channels.find((channel) => channel.id === RELAYBASES_TEXT_CHANNEL_ID)?.apiKey || "";
    return {
        ...config,
        channelMode: "local",
        baseUrl: RELAYBASES_BASE_URL,
        apiKey: mediaApiKey,
        mediaApiKey,
        textApiKey,
        apiFormat: "openai",
        channels,
        models,
        model: imageModel,
        imageModel,
        videoModel,
        videoCallMode: normalizeVideoCallMode(config.videoCallMode),
        textModel,
        audioModel: "",
        imageModels: RELAYBASES_IMAGE_MODEL_OPTIONS,
        videoModels: RELAYBASES_VIDEO_MODEL_OPTIONS,
        textModels: textModelOptions,
        audioModels: [],
        audioVoice: config.audioVoice || defaultConfig.audioVoice,
        audioFormat: config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: config.audioInstructions || "",
        videoSeconds: config.videoSeconds || defaultConfig.videoSeconds,
        vquality: config.vquality || defaultConfig.vquality,
        videoGenerateAudio: config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: config.videoWatermark || defaultConfig.videoWatermark,
        canvasImageCount: config.canvasImageCount || defaultConfig.canvasImageCount,
    };
}

function normalizeChannels(config: AiConfig) {
    const persistedChannels = Array.isArray(config.channels) ? config.channels : [];
    const mediaChannel = persistedChannels.find((channel) => channel.id === RELAYBASES_CHANNEL_ID);
    const textChannel = persistedChannels.find((channel) => channel.id === RELAYBASES_TEXT_CHANNEL_ID);
    const firstLegacyKey = persistedChannels.find((channel) => channel.id !== RELAYBASES_TEXT_CHANNEL_ID && channel.apiKey)?.apiKey || "";
    const mediaApiKey = config.mediaApiKey || config.apiKey || mediaChannel?.apiKey || firstLegacyKey || "";
    const textApiKey = config.textApiKey || textChannel?.apiKey || "";
    const textModels = [
        ...(textChannel?.models || []),
        ...(config.textModels || []).map(modelOptionName),
        ...persistedChannels.filter((channel) => channel.id !== RELAYBASES_CHANNEL_ID && channel.id !== RELAYBASES_TEXT_CHANNEL_ID).flatMap((channel) => channel.models || []),
    ];
    return [createRelayBasesMediaChannel(mediaApiKey), createRelayBasesTextChannel(textApiKey, textModels)];
}

export function defaultBaseUrlForApiFormat(apiFormat: ApiCallFormat) {
    return apiFormat === "gemini" ? GEMINI_BASE_URL : RELAYBASES_BASE_URL;
}

function normalizeApiFormat(apiFormat: unknown): ApiCallFormat {
    return apiFormat === "gemini" ? "gemini" : "openai";
}

function uniqueRawModels(models: string[]) {
    return Array.from(new Set((models || []).map((model) => modelOptionName(model).trim()).filter(Boolean)));
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

export function buildApiUrl(baseUrl: string, path: string) {
    let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    normalizedBaseUrl = normalizeArkPlanBaseUrl(normalizedBaseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}

function normalizeArkPlanBaseUrl(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const path = url.pathname.replace(/\/+$/, "");
        const lowerPath = path.toLowerCase();
        const arkPlanIndex = lowerPath.indexOf("/api/plan/v3");
        if (arkPlanIndex < 0) return baseUrl;
        const end = arkPlanIndex + "/api/plan/v3".length;
        if (lowerPath.length !== end && lowerPath[end] !== "/") return baseUrl;
        url.pathname = path.slice(0, end);
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return baseUrl;
    }
}
