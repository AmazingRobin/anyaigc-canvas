import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    GROK_IMAGINE_VIDEO_BASE_MODEL,
    GROK_IMAGINE_VIDEO_MODEL,
    GROK_VIDEO_ASPECT_RATIOS,
    buildGrokVideoRequestPayload,
    grokVideoBillingSeconds,
    grokVideoRequestError,
    grokVideoResolutionOptions,
    isGrokImagineVideoBaseModel,
    isGrokImagineVideoFamilyModel,
    isGrokImagineVideoModel,
    normalizeGrokVideoAspectRatio,
    normalizeGrokVideoMode,
    normalizeGrokVideoResolution,
} from "@/lib/relaybases-media-models";
import { buildCanvasGenerationConfig } from "@/app/(user)/canvas/utils/canvas-generation-config";
import { CanvasNodeType, type CanvasNodeData } from "@/app/(user)/canvas/types";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";

assert.equal(isGrokImagineVideoBaseModel(GROK_IMAGINE_VIDEO_BASE_MODEL), true);
assert.equal(isGrokImagineVideoModel(GROK_IMAGINE_VIDEO_MODEL), true);
assert.equal(isGrokImagineVideoModel(GROK_IMAGINE_VIDEO_BASE_MODEL), false, "1.5-only behavior must not broaden to the base model");
assert.equal(isGrokImagineVideoFamilyModel(`relaybases::${GROK_IMAGINE_VIDEO_BASE_MODEL}`), true);

assert.deepEqual(GROK_VIDEO_ASPECT_RATIOS, ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], "the gateway contract retains all seven official ratios");
assert.equal(normalizeGrokVideoAspectRatio("4:3"), "16:9", "Canvas normalizes landscape legacy ratios to its 16:9 option");
assert.equal(normalizeGrokVideoAspectRatio("2:3"), "9:16", "Canvas normalizes portrait legacy ratios to its 9:16 option");
assert.equal(normalizeGrokVideoAspectRatio("1:1"), "1:1");

assert.equal(normalizeGrokVideoMode(GROK_IMAGINE_VIDEO_BASE_MODEL, "text-to-video"), "text-to-video");
assert.equal(normalizeGrokVideoMode(GROK_IMAGINE_VIDEO_BASE_MODEL, "image-to-video"), "image-to-video");
assert.equal(normalizeGrokVideoMode(GROK_IMAGINE_VIDEO_BASE_MODEL, "reference-to-video"), "reference-to-video");
assert.equal(normalizeGrokVideoMode(GROK_IMAGINE_VIDEO_BASE_MODEL, "edit-video"), "edit-video");
assert.equal(normalizeGrokVideoMode(GROK_IMAGINE_VIDEO_BASE_MODEL, "extend-video"), "extend-video");
assert.equal(normalizeGrokVideoMode(GROK_IMAGINE_VIDEO_MODEL, "text-to-video"), "image-to-video", "1.5 remains strict single-image I2V");

const canvasConfig: AiConfig = { ...defaultConfig, model: `relaybases::${GROK_IMAGINE_VIDEO_BASE_MODEL}`, videoModel: `relaybases::${GROK_IMAGINE_VIDEO_BASE_MODEL}`, videoOperation: "text-to-video" };
const canvasNode = (type: CanvasNodeType, metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData => ({ id: `node-${type}`, type, title: type, position: { x: 0, y: 0 }, width: 320, height: 240, metadata });
assert.equal(buildCanvasGenerationConfig(canvasConfig, canvasNode(CanvasNodeType.Text, { content: "prompt" }), "video").videoOperation, "text-to-video");
assert.equal(buildCanvasGenerationConfig(canvasConfig, canvasNode(CanvasNodeType.Image, { content: "blob:image" }), "video").videoOperation, "image-to-video");
assert.equal(buildCanvasGenerationConfig(canvasConfig, canvasNode(CanvasNodeType.Video, { content: "blob:video" }), "video").videoOperation, "text-to-video", "a video node must not silently guess edit versus extend");
assert.equal(buildCanvasGenerationConfig(canvasConfig, canvasNode(CanvasNodeType.Video, { content: "blob:video", videoOperation: "extend-video" }), "video").videoOperation, "extend-video");
assert.equal(buildCanvasGenerationConfig({ ...canvasConfig, model: `relaybases::${GROK_IMAGINE_VIDEO_MODEL}`, videoModel: `relaybases::${GROK_IMAGINE_VIDEO_MODEL}`, videoOperation: "edit-video" }, canvasNode(CanvasNodeType.Video, { content: "blob:video" }), "video").videoOperation, "image-to-video");

assert.deepEqual(grokVideoResolutionOptions(GROK_IMAGINE_VIDEO_BASE_MODEL, "text-to-video"), ["480p", "720p"]);
assert.deepEqual(grokVideoResolutionOptions(GROK_IMAGINE_VIDEO_MODEL, "image-to-video"), ["480p", "720p", "1080p"]);
assert.equal(normalizeGrokVideoResolution("1080p", GROK_IMAGINE_VIDEO_BASE_MODEL), "720p");
assert.equal(normalizeGrokVideoResolution("1080p", GROK_IMAGINE_VIDEO_MODEL), "1080p");

const valid = (model: string, mode: string, state: Parameters<typeof grokVideoRequestError>[2]) => grokVideoRequestError(model, mode, state, "en");
assert.equal(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "text-to-video", { imageCount: 0, duration: 15 }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "text-to-video", { imageCount: 1, duration: 15 }), "");
assert.equal(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "image-to-video", { imageCount: 1, duration: 15 }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "image-to-video", { imageCount: 0, duration: 15 }), "");
assert.equal(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "reference-to-video", { imageCount: 7, duration: 10 }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "reference-to-video", { imageCount: 8, duration: 10 }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "reference-to-video", { imageCount: 1, duration: 11 }), "");
assert.equal(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "edit-video", { imageCount: 0, videoCount: 1, duration: 0, sourceVideoDurationMs: 8_700, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4" }), "");
assert.equal(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "edit-video", { imageCount: 0, videoCount: 1, duration: 0, sourceVideoDurationMs: 8_700, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4; codecs=h264" }), "");
assert.equal(grokVideoBillingSeconds("edit-video", 8_001), 9);
assert.equal(grokVideoBillingSeconds("edit-video", 8_000.001), 9, "edit billing must ceil a source duration just above an integer-second boundary");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "edit-video", { imageCount: 0, videoCount: 1, duration: 0, sourceVideoDurationMs: 8_701, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4" }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "edit-video", { imageCount: 0, videoCount: 1, duration: 0, sourceVideoDurationMs: 8_000, sourceVideoName: "source.mov", sourceVideoType: "video/quicktime" }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "edit-video", { imageCount: 0, videoCount: 1, duration: 0, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4" }), "");
assert.equal(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "extend-video", { imageCount: 0, videoCount: 1, duration: 2, sourceVideoDurationMs: 2_000, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4" }), "");
assert.equal(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "extend-video", { imageCount: 0, videoCount: 1, duration: 10, sourceVideoDurationMs: 15_000, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4" }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "extend-video", { imageCount: 0, videoCount: 1, duration: 1, sourceVideoDurationMs: 2_000, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4" }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_BASE_MODEL, "extend-video", { imageCount: 0, videoCount: 1, duration: 10, sourceVideoDurationMs: 15_001, sourceVideoName: "source.mp4", sourceVideoType: "video/mp4" }), "");
assert.equal(valid(GROK_IMAGINE_VIDEO_MODEL, "image-to-video", { imageCount: 1, duration: 15 }), "");
assert.notEqual(valid(GROK_IMAGINE_VIDEO_MODEL, "image-to-video", { imageCount: 0, duration: 15 }), "");

assert.deepEqual(
    buildGrokVideoRequestPayload({ model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "A quiet lake", mode: "text-to-video", duration: 6, aspectRatio: "16:9", resolution: "720p" }),
    { model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "A quiet lake", mode: "text-to-video", duration: 6, aspect_ratio: "16:9", resolution: "720p" },
);
assert.deepEqual(
    buildGrokVideoRequestPayload({ model: GROK_IMAGINE_VIDEO_MODEL, prompt: "Move naturally", mode: "image-to-video", duration: 8, aspectRatio: "9:16", resolution: "1080p", imageUrls: ["https://cdn.example/frame.jpg"] }),
    { model: GROK_IMAGINE_VIDEO_MODEL, prompt: "Move naturally", duration: 8, aspect_ratio: "9:16", resolution: "1080p", images: ["https://cdn.example/frame.jpg"] },
    "1.5 keeps its existing strict single-image request body without requiring the base-model mode field",
);
assert.deepEqual(
    buildGrokVideoRequestPayload({ model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "让图片1靠近 Image 2", mode: "reference-to-video", duration: 10, aspectRatio: "1:1", resolution: "480p", imageUrls: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"] }),
    { model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "让<IMAGE_1>靠近 <IMAGE_2>", mode: "reference-to-video", duration: 10, aspect_ratio: "1:1", resolution: "480p", images: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"] },
);
assert.deepEqual(
    buildGrokVideoRequestPayload({ model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "Add rain", mode: "edit-video", duration: 0, aspectRatio: "1:1", resolution: "720p", videoUrls: ["https://cdn.example/source.mp4"], sourceVideoDurationMs: 8_001 }),
    { model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "Add rain", mode: "edit-video", video_url: "https://cdn.example/source.mp4", seconds: "9" },
    "edit payload must omit duration, aspect ratio, resolution, and response_id",
);
assert.deepEqual(
    buildGrokVideoRequestPayload({ model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "Continue the motion", mode: "extend-video", duration: 6, aspectRatio: "16:9", resolution: "720p", videoUrls: ["https://cdn.example/source.mp4"] }),
    { model: GROK_IMAGINE_VIDEO_BASE_MODEL, prompt: "Continue the motion", mode: "extend-video", video_url: "https://cdn.example/source.mp4", duration: 6 },
    "extend payload must omit aspect ratio, resolution, seconds, and response_id",
);

const canvasClientSource = readFileSync(new URL("../src/app/(user)/canvas/[id]/canvas-client-page.tsx", import.meta.url), "utf8");
assert.match(canvasClientSource, /bytes:\s*payload\.bytes/, "video assets inserted into Canvas must retain their byte size");
assert.match(canvasClientSource, /durationMs:\s*payload\.durationMs/, "video assets inserted into Canvas must retain duration metadata for edit/extend validation");
assert.match(canvasClientSource, /mimeType:\s*payload\.mimeType\s*\|\|\s*["']video\/mp4["']/, "video assets inserted into Canvas must retain their MP4 MIME type");
const assetPickerSource = readFileSync(new URL("../src/app/(user)/canvas/components/asset-picker-modal.tsx", import.meta.url), "utf8");
assert.match(assetPickerSource, /bytes:\s*asset\.data\.bytes/, "My Assets must forward the stored video byte size to Canvas");
assert.match(assetPickerSource, /mimeType:\s*asset\.data\.mimeType/, "My Assets must forward the stored video MIME type to Canvas");
assert.match(assetPickerSource, /durationMs:\s*asset\.data\.durationMs/, "My Assets must forward the stored video duration to Canvas");
const fileStorageSource = readFileSync(new URL("../src/services/file-storage.ts", import.meta.url), "utf8");
assert.match(fileStorageSource, /durationMs:\s*Number\.isFinite\(video\.duration\)\s*\?\s*video\.duration\s*\*\s*1000/, "video duration metadata must preserve precision before ceil-per-second edit billing");

console.log("Grok video contract checks passed");
