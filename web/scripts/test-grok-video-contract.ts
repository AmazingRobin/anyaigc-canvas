import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import axios from "axios";

import {
    GROK_IMAGINE_VIDEO_15_MODEL,
    GROK_IMAGINE_VIDEO_MODEL,
    KLING_3_TURBO_MODEL,
    KLING_MOTION_CONTROL_MODEL,
    KLING_OMNI_VIDEO_MODEL,
    MINIMAX_HAILUO_02_MODEL,
    MINIMAX_HAILUO_23_MODEL,
    buildGrokVideoPayload,
    buildKling3TurboVideoPayload,
    buildKlingMotionControlPayload,
    buildKlingOmniVideoPayload,
    buildMiniMaxHailuoVideoPayload,
    mediaRequestError,
    normalizeVideoOperation,
    videoDurationOptions,
    videoReferenceImageLimit,
} from "@/lib/anyaigc-media-models";
import { createVideoGenerationTask, pollVideoGenerationTask } from "@/services/api/video";
import { buildCanvasGenerationConfig } from "@/app/(user)/canvas/utils/canvas-generation-config";
import { CanvasNodeType, type CanvasNodeData } from "@/app/(user)/canvas/types";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";

assert.equal(normalizeVideoOperation(GROK_IMAGINE_VIDEO_MODEL, "text-to-video"), "text-to-video");
assert.equal(normalizeVideoOperation(GROK_IMAGINE_VIDEO_15_MODEL, "text-to-video"), "image-to-video");
assert.equal(normalizeVideoOperation(KLING_MOTION_CONTROL_MODEL, "image-to-video"), "motion-control");
assert.equal(normalizeVideoOperation(KLING_OMNI_VIDEO_MODEL, "text-to-video"), "omni-video");
assert.equal(normalizeVideoOperation(KLING_3_TURBO_MODEL, "image-to-video"), "image-to-video");
assert.equal(normalizeVideoOperation(MINIMAX_HAILUO_23_MODEL, "first-last-frame"), "first-last-frame");
assert.equal(videoReferenceImageLimit(MINIMAX_HAILUO_23_MODEL, "text-to-video"), 0);
assert.equal(videoReferenceImageLimit(MINIMAX_HAILUO_23_MODEL, "image-to-video"), 1);
assert.equal(videoReferenceImageLimit(MINIMAX_HAILUO_23_MODEL, "first-last-frame"), 2);
assert.deepEqual(videoDurationOptions(MINIMAX_HAILUO_02_MODEL), [6, 10]);
assert.equal(mediaRequestError(GROK_IMAGINE_VIDEO_15_MODEL, { imageCount: 1, videoCount: 0, operation: "image-to-video" }, "en"), "");
assert.match(mediaRequestError(GROK_IMAGINE_VIDEO_15_MODEL, { imageCount: 0, videoCount: 0 }, "en"), /requires 1 image/i);
assert.match(mediaRequestError(GROK_IMAGINE_VIDEO_MODEL, { imageCount: 0, videoCount: 1 }, "en"), /requires 0 video references/i);
assert.match(mediaRequestError(KLING_MOTION_CONTROL_MODEL, { imageCount: 1, videoCount: 0 }, "en"), /requires 1 video/i);
assert.equal(mediaRequestError(KLING_OMNI_VIDEO_MODEL, { imageCount: 0, videoCount: 0 }, "en"), "");
assert.equal(mediaRequestError(KLING_3_TURBO_MODEL, { imageCount: 0, videoCount: 0, operation: "text-to-video" }, "en"), "");
assert.equal(mediaRequestError(KLING_3_TURBO_MODEL, { imageCount: 1, videoCount: 0, operation: "image-to-video" }, "en"), "");
assert.match(mediaRequestError(KLING_3_TURBO_MODEL, { imageCount: 0, videoCount: 0, operation: "image-to-video" }, "en"), /requires 1 image/i);
assert.equal(mediaRequestError(MINIMAX_HAILUO_02_MODEL, { imageCount: 0, videoCount: 0, operation: "text-to-video" }, "en"), "");
assert.equal(mediaRequestError(MINIMAX_HAILUO_02_MODEL, { imageCount: 1, videoCount: 0, operation: "image-to-video" }, "en"), "");
assert.equal(mediaRequestError(MINIMAX_HAILUO_23_MODEL, { imageCount: 2, videoCount: 0, operation: "first-last-frame" }, "en"), "");
assert.match(mediaRequestError(MINIMAX_HAILUO_23_MODEL, { imageCount: 1, videoCount: 0, operation: "first-last-frame" }, "en"), /requires 2 image/i);

const originalAxiosGet = axios.get;
try {
    axios.get = (async () => ({
        data: {
            code: 0,
            data: {
                task_id: "1473612295531601920",
                task_status: "succeed",
                task_result: { videos: [{ url: "https://example.com/kling-result.mp4" }] },
            },
        },
    })) as typeof axios.get;
    const state = await pollVideoGenerationTask(defaultConfig, { id: "1473612295531601920", provider: "kling-omni-video", model: KLING_OMNI_VIDEO_MODEL });
    assert.deepEqual(state, { status: "completed", result: { url: "https://example.com/kling-result.mp4", mimeType: "video/mp4" } });
} finally {
    axios.get = originalAxiosGet;
}

assert.deepEqual(
    buildGrokVideoPayload({ model: GROK_IMAGINE_VIDEO_MODEL, prompt: "A quiet lake", size: "9:16", imageUrls: ["https://example.com/frame.png"] }),
    { model: GROK_IMAGINE_VIDEO_MODEL, prompt: "A quiet lake", aspect_ratio: "9:16", size: "720P", images: ["https://example.com/frame.png"] },
);

assert.deepEqual(
    buildKlingMotionControlPayload({ prompt: "dance", imageUrl: "https://example.com/person.png", videoUrl: "https://storage.to/FQxyz1234" }),
    { model_name: "kling-motion-control", prompt: "dance", image_url: "https://example.com/person.png", video_url: "https://storage.to/FQxyz1234", keep_original_sound: "no", character_orientation: "image", mode: "std" },
);
const omniPayload = buildKlingOmniVideoPayload({ prompt: "sunset", duration: 5, imageUrls: ["https://example.com/frame.png"], videoUrls: ["https://storage.to/FQxyz1234"] });
assert.equal(omniPayload.model_name, "kling-v3-omni");
assert.equal(omniPayload.duration, "5");
assert.equal(omniPayload.multi_shot, false);
assert.deepEqual(omniPayload.image_list, [{ image_url: "https://example.com/frame.png", type: "first_frame" }]);
assert.deepEqual(omniPayload.video_list, [{ video_url: "https://storage.to/FQxyz1234", refer_type: "feature", keep_original_sound: "no" }]);

assert.deepEqual(
    buildKling3TurboVideoPayload({ prompt: "A cat running", duration: 15, aspectRatio: "9:16" }),
    { prompt: "A cat running", settings: { resolution: "720p", aspect_ratio: "9:16", duration: 15 } },
);
assert.deepEqual(
    buildKling3TurboVideoPayload({ prompt: "Move naturally", imageUrl: "https://example.com/frame.png", duration: 5, aspectRatio: "16:9", resolution: "1080p" }),
    { contents: [{ type: "first_frame", url: "https://example.com/frame.png" }, { type: "prompt", text: "Move naturally" }], settings: { resolution: "1080p", aspect_ratio: "16:9", duration: 5 } },
);
assert.deepEqual(
    buildMiniMaxHailuoVideoPayload({ model: MINIMAX_HAILUO_02_MODEL, prompt: "A lake at dawn", duration: 6, operation: "text-to-video" }),
    { model: "MiniMax-Hailuo-02", prompt: "A lake at dawn", duration: 6, resolution: "768P", prompt_optimizer: true },
);
assert.deepEqual(
    buildMiniMaxHailuoVideoPayload({ model: MINIMAX_HAILUO_23_MODEL, prompt: "Move naturally", duration: 10, operation: "image-to-video", imageUrls: ["https://example.com/first.png"] }),
    { model: "MiniMax-Hailuo-2.3", prompt: "Move naturally", duration: 10, resolution: "768P", prompt_optimizer: true, first_frame_image: "https://example.com/first.png" },
);
assert.deepEqual(
    buildMiniMaxHailuoVideoPayload({ model: MINIMAX_HAILUO_23_MODEL, prompt: "Day becomes night", duration: 6, operation: "first-last-frame", imageUrls: ["https://example.com/first.png", "https://example.com/last.png"] }),
    { model: "MiniMax-Hailuo-2.3", prompt: "Day becomes night", duration: 6, resolution: "768P", prompt_optimizer: true, first_frame_image: "https://example.com/first.png", last_frame_image: "https://example.com/last.png" },
);

const turboConfig: AiConfig = {
    ...defaultConfig,
    model: `anyaigc-media::${KLING_3_TURBO_MODEL}`,
    videoModel: `anyaigc-media::${KLING_3_TURBO_MODEL}`,
    videoSeconds: "15",
    channels: defaultConfig.channels.map((channel) => (channel.id === "anyaigc-media" ? { ...channel, apiKey: "test-key", models: [KLING_3_TURBO_MODEL] } : channel)),
};
const originalAxiosPost = axios.post;
try {
    const posted: Array<{ url: string; body: unknown }> = [];
    axios.post = (async (url: string, body: unknown) => {
        posted.push({ url, body });
        return { data: { code: 0, data: { id: `task-${posted.length}`, task_id: `fallback-${posted.length}` } } };
    }) as typeof axios.post;
    const textTask = await createVideoGenerationTask(turboConfig, "A cat running");
    const imageTask = await createVideoGenerationTask(turboConfig, "Move naturally", [{ id: "frame", url: "https://example.com/frame.png", name: "frame.png", type: "image/png" }]);
    assert.equal(textTask.provider, "kling-3-turbo-text");
    assert.equal(imageTask.provider, "kling-3-turbo-image");
    assert.equal(textTask.id, "task-1");
    assert.equal(imageTask.id, "task-2");
    assert.deepEqual(posted, [
        { url: "https://anyaigc.com/kling/text-to-video/kling-3.0-turbo", body: { prompt: "A cat running", settings: { resolution: "720p", aspect_ratio: "16:9", duration: 15 } } },
        { url: "https://anyaigc.com/kling/image-to-video/kling-3.0-turbo", body: { contents: [{ type: "first_frame", url: "https://example.com/frame.png" }, { type: "prompt", text: "Move naturally" }], settings: { resolution: "720p", aspect_ratio: "16:9", duration: 15 } } },
    ]);
} finally {
    axios.post = originalAxiosPost;
}

const hailuoConfig: AiConfig = {
    ...turboConfig,
    model: `anyaigc-media::${MINIMAX_HAILUO_23_MODEL}`,
    videoModel: `anyaigc-media::${MINIMAX_HAILUO_23_MODEL}`,
    videoSeconds: "10",
    channels: defaultConfig.channels.map((channel) => (channel.id === "anyaigc-media" ? { ...channel, apiKey: "test-key", models: [MINIMAX_HAILUO_02_MODEL, MINIMAX_HAILUO_23_MODEL] } : channel)),
};
const originalHailuoAxiosPost = axios.post;
try {
    const posted: Array<{ url: string; body: unknown }> = [];
    axios.post = (async (url: string, body: unknown) => {
        posted.push({ url, body });
        return { data: { code: 0, data: { task_id: `hailuo-${posted.length}` } } };
    }) as typeof axios.post;
    const textTask = await createVideoGenerationTask(hailuoConfig, "A lake at dawn");
    const imageTask = await createVideoGenerationTask({ ...hailuoConfig, videoOperation: "image-to-video" }, "Move naturally", [{ id: "first", url: "https://example.com/first.png", name: "first.png", type: "image/png" }]);
    const firstLastTask = await createVideoGenerationTask({ ...hailuoConfig, videoOperation: "first-last-frame", videoSeconds: "6" }, "Day becomes night", [{ id: "first", url: "https://example.com/first.png", name: "first.png", type: "image/png" }, { id: "last", url: "https://example.com/last.png", name: "last.png", type: "image/png" }]);
    assert.equal(textTask.provider, "minimax-hailuo");
    assert.equal(imageTask.provider, "minimax-hailuo");
    assert.equal(firstLastTask.provider, "minimax-hailuo");
    assert.deepEqual(posted, [
        { url: "https://anyaigc.com/minimax/v1/video_generation", body: { model: "MiniMax-Hailuo-2.3", prompt: "A lake at dawn", duration: 10, resolution: "768P", prompt_optimizer: true } },
        { url: "https://anyaigc.com/minimax/v1/video_generation", body: { model: "MiniMax-Hailuo-2.3", prompt: "Move naturally", duration: 10, resolution: "768P", prompt_optimizer: true, first_frame_image: "https://example.com/first.png" } },
        { url: "https://anyaigc.com/minimax/v1/video_generation", body: { model: "MiniMax-Hailuo-2.3", prompt: "Day becomes night", duration: 6, resolution: "768P", prompt_optimizer: true, first_frame_image: "https://example.com/first.png", last_frame_image: "https://example.com/last.png" } },
    ]);
} finally {
    axios.post = originalHailuoAxiosPost;
}

const originalTurboAxiosGet = axios.get;
try {
    const polledPaths: string[] = [];
    axios.get = (async (url: string) => {
        polledPaths.push(url);
        return { data: { code: 0, data: { task_status: "succeed", task_result: { videos: [{ url: "https://example.com/turbo-result.mp4" }] } } } };
    }) as typeof axios.get;
    await pollVideoGenerationTask(turboConfig, { id: "text-task", provider: "kling-3-turbo-text", model: `anyaigc-media::${KLING_3_TURBO_MODEL}` });
    await pollVideoGenerationTask(turboConfig, { id: "image-task", provider: "kling-3-turbo-image", model: `anyaigc-media::${KLING_3_TURBO_MODEL}` });
    assert.deepEqual(polledPaths, ["https://anyaigc.com/kling/text-to-video/kling-3.0-turbo/text-task", "https://anyaigc.com/kling/image-to-video/kling-3.0-turbo/image-task"]);
} finally {
    axios.get = originalTurboAxiosGet;
}

const originalHailuoAxiosGet = axios.get;
try {
    const paths: string[] = [];
    axios.get = (async (url: string) => {
        paths.push(url);
        return { data: { code: "success", data: { task_id: "hailuo-task", status: "SUCCESS", data: { file: { download_url: "https://example.com/hailuo-result.mp4" } } } } };
    }) as typeof axios.get;
    const state = await pollVideoGenerationTask(hailuoConfig, { id: "hailuo-task", provider: "minimax-hailuo", model: `anyaigc-media::${MINIMAX_HAILUO_23_MODEL}` });
    assert.deepEqual(paths, ["https://anyaigc.com/minimax/v1/query/video_generation?task_id=hailuo-task"]);
    assert.deepEqual(state, { status: "completed", result: { url: "https://example.com/hailuo-result.mp4", mimeType: "video/mp4" } });
} finally {
    axios.get = originalHailuoAxiosGet;
}

const originalFlatHailuoAxiosGet = axios.get;
try {
    axios.get = (async () => ({
        data: {
            file: { download_url: "https://example.com/hailuo-flat-result.mp4" },
            status: "Success",
            task_id: "424777946427702",
            base_resp: { status_code: 0, status_msg: "success" },
        },
    })) as typeof axios.get;
    const state = await pollVideoGenerationTask(hailuoConfig, { id: "424777946427702", provider: "minimax-hailuo", model: `anyaigc-media::${MINIMAX_HAILUO_23_MODEL}` });
    assert.deepEqual(state, { status: "completed", result: { url: "https://example.com/hailuo-flat-result.mp4", mimeType: "video/mp4" } });
} finally {
    axios.get = originalFlatHailuoAxiosGet;
}

const canvasConfig: AiConfig = { ...defaultConfig, model: `anyaigc-media::${GROK_IMAGINE_VIDEO_MODEL}`, videoModel: `anyaigc-media::${GROK_IMAGINE_VIDEO_MODEL}`, videoOperation: "text-to-video" };
const canvasNode = (type: CanvasNodeType, metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData => ({ id: `node-${type}`, type, title: type, position: { x: 0, y: 0 }, width: 320, height: 240, metadata });
assert.equal(buildCanvasGenerationConfig(canvasConfig, canvasNode(CanvasNodeType.Text, { content: "prompt" }), "video").videoOperation, "text-to-video");
assert.equal(buildCanvasGenerationConfig(canvasConfig, canvasNode(CanvasNodeType.Image, { content: "blob:image" }), "video").videoOperation, "image-to-video");
const turboCanvasConfig: AiConfig = { ...canvasConfig, model: `anyaigc-media::${KLING_3_TURBO_MODEL}`, videoModel: `anyaigc-media::${KLING_3_TURBO_MODEL}`, videoSeconds: "15", vquality: "1080p" };
assert.equal(buildCanvasGenerationConfig(turboCanvasConfig, canvasNode(CanvasNodeType.Text, { content: "prompt" }), "video").videoSeconds, "15");
assert.equal(buildCanvasGenerationConfig(turboCanvasConfig, canvasNode(CanvasNodeType.Text, { content: "prompt" }), "video").vquality, "1080p");

const videoSource = readFileSync(new URL("../src/services/api/video.ts", import.meta.url), "utf8");
const videoStudioSource = readFileSync(new URL("../src/app/(user)/video/page.tsx", import.meta.url), "utf8");
const imageStudioSource = readFileSync(new URL("../src/app/(user)/image/page.tsx", import.meta.url), "utf8");
assert.match(videoSource, /"\/video\/create"/, "Grok video creation must use /v1/video/create");
assert.doesNotMatch(videoSource, /createTask\(config, "\/videos"/, "Grok video creation must not use the OpenAI video endpoint");
assert.match(videoSource, /\/video\/query\?id=/, "Grok polling must use /v1/video/query?id=");
assert.match(videoSource, /\/kling\/v1\/videos\/motion-control/, "Kling motion control endpoint must be used");
assert.match(videoSource, /\/kling\/v1\/videos\/omni-video/, "Kling Omni endpoint must be used");
assert.match(videoSource, /isStorageVideoUrl\(video\.url\)/, "Kling video references must use storage.to URLs");
assert.doesNotMatch(videoSource, /if \(isPublicUrl\(video\.url\)\) return video\.url/, "Arbitrary public video URLs must be uploaded to storage.to first");
assert.doesNotMatch(videoSource, /veo-|Seedance|image-2\.relay/i, "Unsupported provider routes must be removed from video requests");
for (const source of [videoStudioSource, imageStudioSource]) {
    assert.doesNotMatch(source, /height="min\(88dvh, 720px\)"/, "Drawer height must use the supported size property");
    assert.match(source, /size="min\(88dvh, 720px\)"/, "Drawer size must preserve the history panel height");
}

console.log("AnyAIGC video contract checks passed");
