"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

import { filterMediaModels, mediaModelCapability, normalizeVideoOperation, type VideoOperation } from "@/lib/anyaigc-media-models";
import { normalizeReferenceEditMode, normalizeSubmitTaskShortcut, type ReferenceEditMode, type SubmitTaskShortcut } from "@/lib/workbench-preferences";

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
    videoOperation: VideoOperation;
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
    clearImageInputsAfterSubmit: string;
    clearVideoInputsAfterSubmit: string;
    submitTaskShortcut: SubmitTaskShortcut;
    notifyOnGenerationComplete: string;
    restoreWorkbenchDraftOnStart: string;
    referenceEditMode: ReferenceEditMode;
};

export type WebdavSyncConfig = {
    proxyMode: "direct" | "nextjs";
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};

export const CONFIG_STORE_KEY = "anyaigc-canvas:ai_config_store";
export type ModelCapability = "image" | "video" | "text" | "audio";
const CHANNEL_MODEL_SEPARATOR = "::";
export const ANYAIGC_BASE_URL = "https://anyaigc.com";
export const ANYAIGC_MEDIA_CHANNEL_ID = "anyaigc-media";
export const ANYAIGC_TEXT_CHANNEL_ID = "anyaigc-text";
export const ANYAIGC_RECOMMENDED_KEY_GROUP = "智能自动";
const ANYAIGC_DEFAULT_IMAGE_MODEL = "gpt-image-2";
const ANYAIGC_DEFAULT_VIDEO_MODEL = "grok-imagine-video";

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: ANYAIGC_BASE_URL,
    apiKey: "",
    mediaApiKey: "",
    textApiKey: "",
    apiFormat: "openai",
    channels: [
        {
            id: ANYAIGC_MEDIA_CHANNEL_ID,
            name: "AnyAIGC Media",
            baseUrl: ANYAIGC_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: [],
        },
        {
            id: ANYAIGC_TEXT_CHANNEL_ID,
            name: "AnyAIGC Text",
            baseUrl: ANYAIGC_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: [],
        },
    ],
    model: "",
    imageModel: "",
    videoModel: "",
    videoCallMode: "sync",
    videoOperation: "text-to-video",
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
    models: [],
    imageModels: [],
    videoModels: [],
    textModels: [],
    audioModels: [],
    quality: "auto",
    size: "auto",
    count: "3",
    canvasImageCount: "3",
    clearImageInputsAfterSubmit: "false",
    clearVideoInputsAfterSubmit: "false",
    submitTaskShortcut: "ctrlEnter",
    notifyOnGenerationComplete: "false",
    restoreWorkbenchDraftOnStart: "true",
    referenceEditMode: "append",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    proxyMode: "direct",
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

type ConfigStore = {
    config: AiConfig;
    webdav: WebdavSyncConfig;
    isConfigOpen: boolean;
    configActiveTab: string;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    updateConfigValues: (values: Partial<AiConfig>) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean, activeTab?: string) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    setConfigActiveTab: (activeTab: string) => void;
    clearPromptContinue: () => void;
};

function isVideoModelName(model: string) {
    return mediaModelCapability(model)?.kind === "video";
}

function isImageModelName(model: string) {
    return mediaModelCapability(model)?.kind === "image";
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

export function applyAnyAIGCConfigPatch(config: AiConfig, values: Partial<AiConfig>): AiConfig {
    const next: AiConfig = { ...config, ...values };
    let channels = next.channels;

    if (Object.prototype.hasOwnProperty.call(values, "mediaApiKey")) {
        const mediaApiKey = typeof values.mediaApiKey === "string" ? values.mediaApiKey : "";
        const changed = mediaApiKey !== config.mediaApiKey;
        next.mediaApiKey = mediaApiKey;
        next.apiKey = mediaApiKey;
        channels = updateChannelApiKey(channels, ANYAIGC_MEDIA_CHANNEL_ID, mediaApiKey, changed);
        if (changed) {
            next.model = "";
            next.imageModel = "";
            next.videoModel = "";
        }
    }

    if (Object.prototype.hasOwnProperty.call(values, "textApiKey")) {
        const textApiKey = typeof values.textApiKey === "string" ? values.textApiKey : "";
        const changed = textApiKey !== config.textApiKey;
        next.textApiKey = textApiKey;
        channels = updateChannelApiKey(channels, ANYAIGC_TEXT_CHANNEL_ID, textApiKey, changed);
        if (changed) next.textModel = "";
    }

    next.channels = channels;
    return next;
}

export function migrateAnyAIGCConfig(config: Partial<AiConfig> | undefined): AiConfig {
    return mergePersistedAnyAIGCConfig(config);
}

export function mergePersistedAnyAIGCConfig(config: Partial<AiConfig> | undefined): AiConfig {
    return normalizeAnyAIGCConfig({ ...defaultConfig, ...(config || {}) });
}

function updateChannelApiKey(channels: ModelChannel[], channelId: string, apiKey: string, clearModels = false) {
    let matched = false;
    const nextChannels = (Array.isArray(channels) ? channels : []).map((channel) => {
        if (channel.id !== channelId) return channel;
        matched = true;
        return { ...channel, apiKey, ...(clearModels ? { models: [] } : {}) };
    });
    if (matched) return nextChannels;
    return [...nextChannels, channelId === ANYAIGC_TEXT_CHANNEL_ID ? createAnyAIGCTextChannel(apiKey) : createAnyAIGCMediaChannel(apiKey)];
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
            webdav: defaultWebdavSyncConfig,
            isConfigOpen: false,
            configActiveTab: "channels",
            shouldPromptContinue: false,
            updateConfig: (key, value) => set((state) => ({ config: normalizeAnyAIGCConfig(applyAnyAIGCConfigPatch(state.config, { [key]: value } as Partial<AiConfig>)) })),
            updateConfigValues: (values) => set((state) => ({ config: normalizeAnyAIGCConfig(applyAnyAIGCConfigPatch(state.config, values)) })),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false, activeTab) => set((state) => ({ isConfigOpen: true, shouldPromptContinue, configActiveTab: activeTab || state.configActiveTab })),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            setConfigActiveTab: (configActiveTab) => set({ configActiveTab }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            version: 1,
            migrate: (persisted) => {
                const persistedState = (persisted || {}) as {
                    config?: Partial<AiConfig>;
                    webdav?: Partial<WebdavSyncConfig>;
                };
                return {
                    config: migrateAnyAIGCConfig(persistedState.config),
                    webdav: { ...defaultWebdavSyncConfig, ...(persistedState.webdav || {}) },
                };
            },
            partialize: (state) => ({ config: state.config, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const config = mergePersistedAnyAIGCConfig(persistedConfig);
                return {
                    ...current,
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

export function normalizeVideoCallMode(value: unknown): AiConfig["videoCallMode"] {
    return value === "async" ? "async" : "sync";
}

export function modelOptionLabel(_config: AiConfig, value: string) {
    return modelOptionName(value);
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model))));
}

export function replaceChannelModels(channels: ModelChannel[], channelId: string, models: string[]) {
    const nextModels = uniqueRawModels(models);
    return channels.map((channel) => (channel.id === channelId ? { ...channel, models: nextModels } : channel));
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

function createAnyAIGCMediaChannel(apiKey = "", models: string[] = []): ModelChannel {
    return createModelChannel({
        id: ANYAIGC_MEDIA_CHANNEL_ID,
        name: "AnyAIGC Media",
        baseUrl: ANYAIGC_BASE_URL,
        apiKey,
        apiFormat: "openai",
        models,
    });
}

function createAnyAIGCTextChannel(apiKey = "", models: string[] = []): ModelChannel {
    return createModelChannel({
        id: ANYAIGC_TEXT_CHANNEL_ID,
        name: "AnyAIGC Text",
        baseUrl: ANYAIGC_BASE_URL,
        apiKey,
        apiFormat: "openai",
        models: uniqueRawModels(models),
    });
}

export function normalizeAnyAIGCConfig(config: AiConfig): AiConfig {
    const channels = normalizeChannels(config);
    const models = modelOptionsFromChannels(channels);
    const mediaChannel = channels.find((channel) => channel.id === ANYAIGC_MEDIA_CHANNEL_ID);
    const textChannel = channels.find((channel) => channel.id === ANYAIGC_TEXT_CHANNEL_ID);
    const imageModelOptions = filterMediaModels(mediaChannel?.models || [], "image").map((model) => encodeChannelModel(ANYAIGC_MEDIA_CHANNEL_ID, model));
    const videoModelOptions = filterMediaModels(mediaChannel?.models || [], "video").map((model) => encodeChannelModel(ANYAIGC_MEDIA_CHANNEL_ID, model));
    const audioModelOptions = filterModelsByCapability(textChannel?.models || [], "audio").map((model) => encodeChannelModel(ANYAIGC_TEXT_CHANNEL_ID, model));
    const textModelOptions = filterModelsByCapability(textChannel?.models || [], "text").map((model) => encodeChannelModel(ANYAIGC_TEXT_CHANNEL_ID, model));
    const normalizedImageModel = normalizeModelOptionValue(config.imageModel || config.model, channels);
    const normalizedVideoModel = normalizeModelOptionValue(config.videoModel, channels);
    const normalizedTextModel = normalizeModelOptionValue(config.textModel, channels);
    const normalizedAudioModel = normalizeModelOptionValue(config.audioModel, channels);
    const imageModel = imageModelOptions.includes(normalizedImageModel) ? normalizedImageModel : preferredModelOption(imageModelOptions, ANYAIGC_DEFAULT_IMAGE_MODEL);
    const videoModel = videoModelOptions.includes(normalizedVideoModel) ? normalizedVideoModel : preferredModelOption(videoModelOptions, ANYAIGC_DEFAULT_VIDEO_MODEL);
    const textModel = textModelOptions.includes(normalizedTextModel) ? normalizedTextModel : preferredTextModelOption(textModelOptions);
    const audioModel = audioModelOptions.includes(normalizedAudioModel) ? normalizedAudioModel : audioModelOptions[0] || "";
    const mediaApiKey = channels.find((channel) => channel.id === ANYAIGC_MEDIA_CHANNEL_ID)?.apiKey || "";
    const textApiKey = channels.find((channel) => channel.id === ANYAIGC_TEXT_CHANNEL_ID)?.apiKey || "";
    return {
        ...config,
        channelMode: "local",
        baseUrl: ANYAIGC_BASE_URL,
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
        videoOperation: normalizeVideoOperation(videoModel, config.videoOperation),
        textModel,
        audioModel,
        imageModels: imageModelOptions,
        videoModels: videoModelOptions,
        textModels: textModelOptions,
        audioModels: audioModelOptions,
        audioVoice: config.audioVoice || defaultConfig.audioVoice,
        audioFormat: config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: config.audioInstructions || "",
        videoSeconds: config.videoSeconds || defaultConfig.videoSeconds,
        vquality: config.vquality || defaultConfig.vquality,
        videoGenerateAudio: config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: config.videoWatermark || defaultConfig.videoWatermark,
        canvasImageCount: config.canvasImageCount || defaultConfig.canvasImageCount,
        clearImageInputsAfterSubmit: config.clearImageInputsAfterSubmit === "true" ? "true" : "false",
        clearVideoInputsAfterSubmit: config.clearVideoInputsAfterSubmit === "true" ? "true" : "false",
        submitTaskShortcut: normalizeSubmitTaskShortcut(config.submitTaskShortcut),
        notifyOnGenerationComplete: config.notifyOnGenerationComplete === "true" ? "true" : "false",
        restoreWorkbenchDraftOnStart: config.restoreWorkbenchDraftOnStart === "false" ? "false" : "true",
        referenceEditMode: normalizeReferenceEditMode(config.referenceEditMode),
    };
}

function normalizeChannels(config: AiConfig) {
    const persistedChannels = Array.isArray(config.channels) ? config.channels : [];
    const mediaChannel = persistedChannels.find((channel) => channel.id === ANYAIGC_MEDIA_CHANNEL_ID);
    const textChannel = persistedChannels.find((channel) => channel.id === ANYAIGC_TEXT_CHANNEL_ID);
    const mediaApiKey = config.mediaApiKey || config.apiKey || mediaChannel?.apiKey || "";
    const textApiKey = config.textApiKey || textChannel?.apiKey || "";
    return [createAnyAIGCMediaChannel(mediaApiKey, mediaChannel?.models || []), createAnyAIGCTextChannel(textApiKey, textChannel?.models || [])];
}

function preferredModelOption(models: string[], preferredModel: string) {
    return models.find((model) => modelOptionName(model).toLowerCase() === preferredModel.toLowerCase()) || models[0] || "";
}

export function defaultBaseUrlForApiFormat(apiFormat: ApiCallFormat) {
    return ANYAIGC_BASE_URL;
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
