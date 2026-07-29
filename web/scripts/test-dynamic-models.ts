import assert from "node:assert/strict";

import { filterMediaModels } from "@/lib/anyaigc-media-models";
import { normalizeDiscoveredModels, responseCapableModelIds } from "@/services/api/image";
import {
    ANYAIGC_BASE_URL,
    ANYAIGC_MEDIA_CHANNEL_ID,
    ANYAIGC_TEXT_CHANNEL_ID,
    applyAnyAIGCConfigPatch,
    defaultConfig,
    encodeChannelModel,
    mergePersistedAnyAIGCConfig,
    normalizeAnyAIGCConfig,
    replaceChannelModels,
    type AiConfig,
    type ModelChannel,
} from "@/stores/use-config-store";

function channel(id: string, apiKey: string, models: string[]): ModelChannel {
    return { id, name: id === ANYAIGC_MEDIA_CHANNEL_ID ? "AnyAIGC Media" : "AnyAIGC Text", baseUrl: ANYAIGC_BASE_URL, apiKey, apiFormat: "openai", models };
}

function configWithModels(options: { mediaKey?: string; textKey?: string; mediaModels?: string[]; textModels?: string[] } = {}): AiConfig {
    const mediaKey = options.mediaKey || "media-key-a";
    const textKey = options.textKey || "text-key-a";
    return {
        ...defaultConfig,
        apiKey: mediaKey,
        mediaApiKey: mediaKey,
        textApiKey: textKey,
        channels: [channel(ANYAIGC_MEDIA_CHANNEL_ID, mediaKey, options.mediaModels || []), channel(ANYAIGC_TEXT_CHANNEL_ID, textKey, options.textModels || [])],
    };
}

function getChannel(config: Pick<AiConfig, "channels">, id: string) {
    const result = config.channels.find((item) => item.id === id);
    assert.ok(result, `missing channel ${id}`);
    return result;
}

const media = (model: string) => encodeChannelModel(ANYAIGC_MEDIA_CHANNEL_ID, model);
const text = (model: string) => encodeChannelModel(ANYAIGC_TEXT_CHANNEL_ID, model);

assert.deepEqual(
    normalizeDiscoveredModels([
        null,
        "gpt-5.5",
        { id: " gpt-5.5 ", supported_endpoint_types: ["OPENAI-RESPONSE", "openai-response"] },
        { id: "gpt-5.5", supported_endpoint_types: "openai-chat" },
        { id: "anyaigc-media::injected", supported_endpoint_types: ["openai-response"] },
        { id: "gpt-image-2", supported_endpoint_types: ["openai-image"] },
    ]),
    [
        { id: "gpt-5.5", supportedEndpointTypes: ["openai-response"] },
        { id: "gpt-image-2", supportedEndpointTypes: ["openai-image"] },
    ],
);
assert.deepEqual(responseCapableModelIds([{ id: "gpt-5.5", supportedEndpointTypes: ["openai-response"] }, { id: "chat-only", supportedEndpointTypes: ["openai-chat"] }]), ["gpt-5.5"]);

assert.deepEqual(
    filterMediaModels(["gpt-image-2", "gemini-3.1-flash-image-preview", "grok-imagine-image", "grok-imagine-image-pro", "nana-banana-2_sync", "veo-3-1"], "image"),
    ["gpt-image-2", "gemini-3.1-flash-image-preview", "grok-imagine-image", "grok-imagine-image-pro"],
);
assert.deepEqual(
    filterMediaModels(["grok-imagine-video", "grok-imagine-video-1.5", "kling-motion-control", "kling-omni-video", "kling-3.0-turbo", "MiniMax-Hailuo-02", "MiniMax-Hailuo-2.3", "veo-3-1", "video-pro-720p"], "video"),
    ["grok-imagine-video", "grok-imagine-video-1.5", "kling-motion-control", "kling-omni-video", "kling-3.0-turbo", "MiniMax-Hailuo-02", "MiniMax-Hailuo-2.3"],
);

const normalized = normalizeAnyAIGCConfig(
    configWithModels({
        mediaModels: ["gpt-image-2", "grok-imagine-video", "veo-3-1", "gpt-image-2"],
        textModels: ["gpt-5.4", "gpt-5.5", "gpt-5.5", "tts-1"],
    }),
);
assert.deepEqual(getChannel(normalized, ANYAIGC_MEDIA_CHANNEL_ID).models, ["gpt-image-2", "grok-imagine-video", "veo-3-1"]);
assert.deepEqual(normalized.imageModels, [media("gpt-image-2")]);
assert.deepEqual(normalized.videoModels, [media("grok-imagine-video")]);
assert.deepEqual(normalized.textModels, [text("gpt-5.4"), text("gpt-5.5")]);
assert.deepEqual(normalized.audioModels, [text("tts-1")]);
assert.equal(normalized.imageModel, media("gpt-image-2"));
assert.equal(normalized.videoModel, media("grok-imagine-video"));
assert.equal(normalized.textModel, text("gpt-5.5"));

const mediaPatch = applyAnyAIGCConfigPatch(normalized, { mediaApiKey: "media-key-b" });
assert.deepEqual(getChannel(mediaPatch, ANYAIGC_MEDIA_CHANNEL_ID).models, []);
assert.deepEqual(getChannel(mediaPatch, ANYAIGC_TEXT_CHANNEL_ID), getChannel(normalized, ANYAIGC_TEXT_CHANNEL_ID));
assert.deepEqual(normalizeAnyAIGCConfig(mediaPatch).imageModels, []);
assert.deepEqual(normalizeAnyAIGCConfig(mediaPatch).videoModels, []);

const textPatch = applyAnyAIGCConfigPatch(normalized, { textApiKey: "text-key-b" });
assert.deepEqual(getChannel(textPatch, ANYAIGC_TEXT_CHANNEL_ID).models, []);
assert.deepEqual(getChannel(textPatch, ANYAIGC_MEDIA_CHANNEL_ID), getChannel(normalized, ANYAIGC_MEDIA_CHANNEL_ID));
assert.deepEqual(normalizeAnyAIGCConfig(textPatch).textModels, []);

const replaced = replaceChannelModels(normalized.channels, ANYAIGC_MEDIA_CHANNEL_ID, ["kling-omni-video", "kling-omni-video"]);
const afterReplacement = normalizeAnyAIGCConfig({ ...normalized, channels: replaced });
assert.deepEqual(afterReplacement.imageModels, []);
assert.deepEqual(afterReplacement.videoModels, [media("kling-omni-video")]);
assert.equal(afterReplacement.models.includes(media("gpt-image-2")), false);

const rehydrated = mergePersistedAnyAIGCConfig(normalized);
assert.deepEqual(getChannel(rehydrated, ANYAIGC_MEDIA_CHANNEL_ID).models, ["gpt-image-2", "grok-imagine-video", "veo-3-1"]);
assert.deepEqual(getChannel(rehydrated, ANYAIGC_TEXT_CHANNEL_ID).models, ["gpt-5.4", "gpt-5.5", "tts-1"]);
assert.deepEqual(rehydrated.imageModels, [media("gpt-image-2")]);
assert.deepEqual(rehydrated.videoModels, [media("grok-imagine-video")]);

console.log("AnyAIGC dynamic model store contract checks passed");
