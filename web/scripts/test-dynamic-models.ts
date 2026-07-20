import assert from "node:assert/strict";

import { normalizeDiscoveredModels, responseCapableModelIds } from "@/services/api/image";
import {
    RELAYBASES_CHANNEL_ID,
    RELAYBASES_MEDIA_BASE_URL,
    RELAYBASES_TEXT_BASE_URL,
    RELAYBASES_TEXT_CHANNEL_ID,
    applyRelayBasesConfigPatch,
    defaultConfig,
    encodeChannelModel,
    migrateRelayBasesConfig,
    normalizeRelayBasesConfig,
    replaceChannelModels,
    type AiConfig,
    type ModelChannel,
} from "@/stores/use-config-store";

function channel(id: string, apiKey: string, models: string[]): ModelChannel {
    const media = id === RELAYBASES_CHANNEL_ID;
    return {
        id,
        name: media ? "RelayBases Media" : "RelayBases Text",
        baseUrl: media ? RELAYBASES_MEDIA_BASE_URL : RELAYBASES_TEXT_BASE_URL,
        apiKey,
        apiFormat: "openai",
        models,
    };
}

function configWithModels(options: { mediaKey?: string; textKey?: string; mediaModels?: string[]; textModels?: string[] } = {}): AiConfig {
    const mediaKey = options.mediaKey || "media-key-a";
    const textKey = options.textKey || "text-key-a";
    return {
        ...defaultConfig,
        apiKey: mediaKey,
        mediaApiKey: mediaKey,
        textApiKey: textKey,
        channels: [channel(RELAYBASES_CHANNEL_ID, mediaKey, options.mediaModels || []), channel(RELAYBASES_TEXT_CHANNEL_ID, textKey, options.textModels || [])],
        model: "ghost::model",
        imageModel: "ghost::image",
        videoModel: "ghost::video",
        textModel: "ghost::text",
        models: ["ghost::model"],
        imageModels: ["ghost::image"],
        videoModels: ["ghost::video"],
        textModels: ["ghost::text"],
    };
}

function getChannel(config: Pick<AiConfig, "channels">, id: string) {
    const result = config.channels.find((item) => item.id === id);
    assert.ok(result, `missing channel ${id}`);
    return result;
}

const media = (model: string) => encodeChannelModel(RELAYBASES_CHANNEL_ID, model);
const text = (model: string) => encodeChannelModel(RELAYBASES_TEXT_CHANNEL_ID, model);

// Model endpoint payloads are untrusted: normalize endpoint names, merge
// duplicates, and drop malformed or channel-separator IDs.
assert.deepEqual(
    normalizeDiscoveredModels([
        null,
        "gpt-5.5",
        { id: " gpt-5.5 ", supported_endpoint_types: ["OPENAI-RESPONSE", "openai-response"] },
        { id: "gpt-5.5", supported_endpoint_types: "openai-chat" },
        { id: "relaybases::injected", supported_endpoint_types: ["openai-response"] },
        { id: "gpt-image-2", supported_endpoint_types: ["openai-image"] },
    ]),
    [
        { id: "gpt-5.5", supportedEndpointTypes: ["openai-response"] },
        { id: "gpt-image-2", supportedEndpointTypes: ["openai-image"] },
    ],
);
assert.deepEqual(
    responseCapableModelIds([
        { id: "gpt-5.5", supportedEndpointTypes: ["openai-response"] },
        { id: "chat-only", supportedEndpointTypes: ["openai-chat"] },
        { id: "unspecified", supportedEndpointTypes: [] },
    ]),
    ["gpt-5.5"],
);

// v2 persisted both channels' model lists. v3 must invalidate both so a model
// discovered with Key A can never be presented after the user switches to Key B.
const migratedV2 = migrateRelayBasesConfig(
    configWithModels({
        mediaModels: ["gpt-image-2"],
        textModels: ["gpt-5.5"],
    }),
    2,
);
assert.deepEqual(getChannel(migratedV2, RELAYBASES_CHANNEL_ID).models, []);
assert.deepEqual(getChannel(migratedV2, RELAYBASES_TEXT_CHANNEL_ID).models, []);
assert.deepEqual(migratedV2.models, []);
assert.deepEqual(migratedV2.imageModels, []);
assert.deepEqual(migratedV2.videoModels, []);
assert.deepEqual(migratedV2.textModels, []);
assert.equal(migratedV2.imageModel, "");
assert.equal(migratedV2.videoModel, "");
assert.equal(migratedV2.textModel, "");

// channel.models is the only source of selectable and aggregate model lists.
const sourceConfig = normalizeRelayBasesConfig(
    configWithModels({
        mediaModels: ["veo-3-1", "gpt-image-2", "gpt-image-2"],
        textModels: ["gpt-5.4", "gpt-5.5", "gpt-5.5"],
    }),
);
assert.deepEqual(getChannel(sourceConfig, RELAYBASES_CHANNEL_ID).models, ["veo-3-1", "gpt-image-2"]);
assert.deepEqual(getChannel(sourceConfig, RELAYBASES_TEXT_CHANNEL_ID).models, ["gpt-5.4", "gpt-5.5"]);
assert.deepEqual(sourceConfig.models, [media("veo-3-1"), media("gpt-image-2"), text("gpt-5.4"), text("gpt-5.5")]);
assert.deepEqual(sourceConfig.imageModels, [media("gpt-image-2")]);
assert.deepEqual(sourceConfig.videoModels, [media("veo-3-1")]);
assert.deepEqual(sourceConfig.textModels, [text("gpt-5.4"), text("gpt-5.5")]);
assert.equal(sourceConfig.models.some((model) => model.includes("ghost")), false, "stale top-level lists must not feed model availability");

// Models are split by the capability of the channel that owns their key.
const splitConfig = normalizeRelayBasesConfig(
    configWithModels({
        mediaModels: ["gpt-5.4", "gpt-image-2", "video-pro-720p"],
        textModels: ["gpt-image-2", "gpt-5.5"],
    }),
);
assert.deepEqual(splitConfig.imageModels, [media("gpt-image-2")]);
assert.deepEqual(splitConfig.videoModels, [media("video-pro-720p")]);
assert.deepEqual(splitConfig.textModels, [text("gpt-5.5")]);
assert.equal(splitConfig.textModels.includes(media("gpt-5.4")), false, "a text-looking model returned by the media key must not enter the text picker");
assert.equal(splitConfig.imageModels.includes(text("gpt-image-2")), false, "an image-looking model returned by the text key must not enter the image picker");

// Preferred defaults win even when the API returns them after another model.
const preferredDefaults = normalizeRelayBasesConfig(
    configWithModels({
        mediaModels: ["nana-banana-2", "gpt-image-2", "video-pro-720p", "veo-3-1"],
        textModels: ["gpt-5.4", "gpt-5.5"],
    }),
);
assert.equal(preferredDefaults.imageModel, media("gpt-image-2"));
assert.equal(preferredDefaults.model, media("gpt-image-2"));
assert.equal(preferredDefaults.videoModel, media("veo-3-1"));
assert.equal(preferredDefaults.textModel, text("gpt-5.5"));

// If a preferred model is unavailable, normalization chooses the first model of that capability.
const fallbackDefaults = normalizeRelayBasesConfig(
    configWithModels({
        mediaModels: ["nana-banana-2", "video-pro-720p"],
        textModels: ["gpt-5.4"],
    }),
);
assert.equal(fallbackDefaults.imageModel, media("nana-banana-2"));
assert.equal(fallbackDefaults.videoModel, media("video-pro-720p"));
assert.equal(fallbackDefaults.textModel, text("gpt-5.4"));

// Changing one key clears that channel and its derived defaults in the same store update pipeline.
const beforeKeySwitch = preferredDefaults;
const mediaPatch = applyRelayBasesConfigPatch(beforeKeySwitch, { mediaApiKey: "media-key-b" });
assert.deepEqual(getChannel(mediaPatch, RELAYBASES_CHANNEL_ID).models, [], "media Key A models must be cleared before Key B discovery");
assert.deepEqual(getChannel(mediaPatch, RELAYBASES_TEXT_CHANNEL_ID), getChannel(beforeKeySwitch, RELAYBASES_TEXT_CHANNEL_ID), "changing the media key must not touch the text channel");
const afterMediaKeySwitch = normalizeRelayBasesConfig(mediaPatch);
assert.equal(afterMediaKeySwitch.mediaApiKey, "media-key-b");
assert.deepEqual(afterMediaKeySwitch.imageModels, []);
assert.deepEqual(afterMediaKeySwitch.videoModels, []);
assert.equal(afterMediaKeySwitch.imageModel, "");
assert.equal(afterMediaKeySwitch.videoModel, "");
assert.deepEqual(afterMediaKeySwitch.textModels, beforeKeySwitch.textModels);
assert.equal(afterMediaKeySwitch.textModel, beforeKeySwitch.textModel);

const textPatch = applyRelayBasesConfigPatch(beforeKeySwitch, { textApiKey: "text-key-b" });
assert.deepEqual(getChannel(textPatch, RELAYBASES_TEXT_CHANNEL_ID).models, [], "text Key A models must be cleared before Key B discovery");
assert.deepEqual(getChannel(textPatch, RELAYBASES_CHANNEL_ID), getChannel(beforeKeySwitch, RELAYBASES_CHANNEL_ID), "changing the text key must not touch the media channel");
const afterTextKeySwitch = normalizeRelayBasesConfig(textPatch);
assert.equal(afterTextKeySwitch.textApiKey, "text-key-b");
assert.deepEqual(afterTextKeySwitch.textModels, []);
assert.equal(afterTextKeySwitch.textModel, "");
assert.deepEqual(afterTextKeySwitch.imageModels, beforeKeySwitch.imageModels);
assert.deepEqual(afterTextKeySwitch.videoModels, beforeKeySwitch.videoModels);
assert.equal(afterTextKeySwitch.imageModel, beforeKeySwitch.imageModel);
assert.equal(afterTextKeySwitch.videoModel, beforeKeySwitch.videoModel);

// A refresh replaces the target channel exactly; it never unions with the previous result.
const replacedChannels = replaceChannelModels(beforeKeySwitch.channels, RELAYBASES_CHANNEL_ID, ["nana-banana-pro", "nana-banana-pro"]);
assert.deepEqual(getChannel({ channels: replacedChannels }, RELAYBASES_CHANNEL_ID).models, ["nana-banana-pro"]);
assert.deepEqual(getChannel({ channels: replacedChannels }, RELAYBASES_TEXT_CHANNEL_ID), getChannel(beforeKeySwitch, RELAYBASES_TEXT_CHANNEL_ID), "media refresh must leave the text channel untouched");
const afterReplacement = normalizeRelayBasesConfig({ ...beforeKeySwitch, channels: replacedChannels });
assert.deepEqual(afterReplacement.imageModels, [media("nana-banana-pro")]);
assert.deepEqual(afterReplacement.videoModels, []);
assert.equal(afterReplacement.models.includes(media("gpt-image-2")), false, "a model omitted by the latest response must disappear");
assert.equal(afterReplacement.models.includes(media("veo-3-1")), false, "replace must not retain a previous video model");
assert.deepEqual(afterReplacement.textModels, beforeKeySwitch.textModels);

console.log("Dynamic model store contract checks passed");
