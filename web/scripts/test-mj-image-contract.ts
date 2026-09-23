import assert from "node:assert/strict";
import axios from "axios";

import { MJ_BLEND_MODEL, MJ_IMAGINE_MODEL, buildMjBlendPayload, buildMjImaginePayload, buildMjPrompt, imageReferenceLimit, isMjBlendModel, isMjImageModel, isMjImagineModel, mediaRequestError } from "@/lib/anyaigc-media-models";
import { findMjCustomZoomButton, findMjInpaintButton, findMjUpscaleButtons, findMjVariationButtons, requestMjImage, submitMjCustomZoom, submitMjInpaint, submitMjZoom, type MjButton } from "@/services/api/mj";
import { ANYAIGC_MEDIA_CHANNEL_ID, defaultConfig, type AiConfig } from "@/stores/use-config-store";

const originalAxiosPost = axios.post;
const originalAxiosGet = axios.get;

// 模型注册与能力
assert.equal(isMjImageModel(MJ_IMAGINE_MODEL), true);
assert.equal(isMjImagineModel(MJ_IMAGINE_MODEL), true);
assert.equal(isMjBlendModel(MJ_BLEND_MODEL), true);
assert.equal(isMjImagineModel(MJ_BLEND_MODEL), false);
assert.equal(isMjImageModel("gpt-image-2"), false);
assert.equal(imageReferenceLimit(MJ_IMAGINE_MODEL), 5);
assert.equal(imageReferenceLimit(MJ_BLEND_MODEL), 5);
assert.equal(mediaRequestError(MJ_BLEND_MODEL, { imageCount: 1 }, "zh"), "当前图片模型需要至少 2 张参考图");
assert.equal(mediaRequestError(MJ_BLEND_MODEL, { imageCount: 1 }, "en"), "The selected image model requires at least 2 reference images.");
assert.equal(mediaRequestError(MJ_BLEND_MODEL, { imageCount: 2 }, "zh"), "");
assert.equal(mediaRequestError(MJ_IMAGINE_MODEL, { imageCount: 6 }, "zh"), "当前图片模型最多支持 5 张参考图");
assert.equal(mediaRequestError(MJ_IMAGINE_MODEL, { hasMask: true }, "en"), "The selected image model does not support masked editing.");

// MJ 用原生 --ar 表达比例，auto 不加，已有 --ar 不重复追加
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "1024x1536" }).prompt, "a cat --ar 2:3");
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "16:9" }).prompt, "a cat --ar 16:9");
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "auto" }).prompt, "a cat");
assert.equal(buildMjImaginePayload({ prompt: "a cat --ar 3:2", size: "1024x1024" }).prompt, "a cat --ar 3:2");

// 版本以设置项为准：auto 不追加，提示词里已有的 --v 必须被替换而不是并存
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "auto", version: "8" }).prompt, "a cat --v 8");
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "auto", version: "7" }).prompt, "a cat --v 7");
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "auto", version: "auto" }).prompt, "a cat");
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "auto" }).prompt, "a cat");
assert.equal(buildMjImaginePayload({ prompt: "日系城市全景图 --ar 9:16 --v 7", size: "auto", version: "8" }).prompt, "日系城市全景图 --ar 9:16 --v 8");
assert.equal(buildMjImaginePayload({ prompt: "a cat --version 6.1", size: "auto", version: "8" }).prompt, "a cat --v 8");
assert.equal(buildMjImaginePayload({ prompt: "a cat --v 7", size: "auto", version: "auto" }).prompt, "a cat", "auto 应剥掉提示词里的版本，跟随账号默认");
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "1024x1536", version: "8" }).prompt, "a cat --ar 2:3 --v 8");
assert.equal(buildMjPrompt("a cat --v 7", "auto", "8"), "a cat --v 8");
assert.equal(buildMjImaginePayload({ prompt: "a cat", size: "1024x1024" }).botType, "MID_JOURNEY");
assert.equal("base64Array" in buildMjImaginePayload({ prompt: "a cat", size: "auto" }), false);
assert.deepEqual(buildMjImaginePayload({ prompt: "a cat", size: "auto", base64Array: ["data:image/png;base64,aQ=="] }).base64Array, ["data:image/png;base64,aQ=="]);
assert.equal(buildMjBlendPayload({ base64Array: ["a", "b"], size: "1824x1024" }).dimensions, "LANDSCAPE");
assert.equal(buildMjBlendPayload({ base64Array: ["a", "b"], size: "1024x1824" }).dimensions, "PORTRAIT");
assert.equal(buildMjBlendPayload({ base64Array: ["a", "b"], size: "auto" }).dimensions, "SQUARE");

// buttons 解析：customId 约定 MJ::JOB::<动作>::<序号>::<uuid>
const buttons: MjButton[] = [
    { customId: "MJ::JOB::upsample::1::abc", label: "U1", emoji: "" },
    { customId: "MJ::JOB::upsample::2::abc", label: "U2", emoji: "" },
    { customId: "MJ::JOB::variation::1::abc", label: "V1", emoji: "" },
    { customId: "MJ::Inpaint::1::abc::SOLO", label: "Vary (Region)", emoji: "" },
    { customId: "MJ::CustomZoom::abc", label: "Custom Zoom", emoji: "" },
];
assert.equal(findMjUpscaleButtons(buttons).length, 2);
assert.equal(findMjVariationButtons(buttons).length, 1);
assert.equal(findMjInpaintButton(buttons)?.label, "Vary (Region)");
assert.equal(findMjCustomZoomButton(buttons)?.label, "Custom Zoom");
assert.equal(findMjInpaintButton([]), undefined);

// MJ 的 API Key 来自媒体渠道（resolveModelRequestConfig 从 channel 取 key/baseUrl），不是顶层 apiKey
const config = (model: string, size = "auto"): AiConfig => ({
    ...defaultConfig,
    apiKey: "test-key",
    mediaApiKey: "test-key",
    channels: defaultConfig.channels.map((channel) => (channel.id === ANYAIGC_MEDIA_CHANNEL_ID ? { ...channel, apiKey: "test-key", models: [MJ_IMAGINE_MODEL, MJ_BLEND_MODEL] } : channel)),
    model,
    imageModel: model,
    size,
    quality: "high",
    count: "1",
});

try {
    const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
    const gets: string[] = [];
    let fetchCalls = 0;

    axios.post = (async (url: string, body: Record<string, unknown>) => {
        posts.push({ url, body });
        // MJ 提交成功返回 code 1，任务 ID 在 result
        return { data: { code: 1, description: "Submit success", result: `task-${posts.length}` } };
    }) as typeof axios.post;
    axios.get = (async (url: string) => {
        gets.push(url);
        fetchCalls += 1;
        // 首次查询返回进行中，验证轮询会继续
        if (fetchCalls === 1) return { data: { status: "IN_PROGRESS", progress: "30%" } };
        return { data: { id: "task-1", status: "SUCCESS", progress: "100%", imageUrl: "https://cdn.mj/out.png", promptEn: "a cat --ar 2:3", buttons } };
    }) as typeof axios.get;

    const result = await requestMjImage(config(MJ_IMAGINE_MODEL, "1024x1536"), "a cat");
    assert.equal(result.imageUrl, "https://cdn.mj/out.png");
    assert.equal(result.taskId, "task-1");
    assert.equal(result.buttons.length, 5);
    assert.equal(posts[0].url, "https://anyaigc.com/mj/submit/imagine");
    // 默认 mjVersion 为 8，应追加 --v 8
    assert.deepEqual(posts[0].body, { prompt: "a cat --ar 2:3 --v 8", botType: "MID_JOURNEY" });
    assert.equal(gets[0], "https://anyaigc.com/mj/task/task-1/fetch");
    assert.equal(gets.length, 2, "第一次 IN_PROGRESS 后应继续轮询");

    // blend：2 张图走 /mj/submit/blend
    posts.length = 0;
    await requestMjImage(config(MJ_BLEND_MODEL), "", [
        { id: "a", name: "a.png", type: "image/png", dataUrl: "data:image/png;base64,aQ==" },
        { id: "b", name: "b.png", type: "image/png", dataUrl: "data:image/png;base64,bQ==" },
    ]);
    assert.equal(posts[0].url, "https://anyaigc.com/mj/submit/blend");
    assert.deepEqual(posts[0].body, { base64Array: ["data:image/png;base64,aQ==", "data:image/png;base64,bQ=="], botType: "MID_JOURNEY", dimensions: "SQUARE" });

    // zoom 走 /mj/submit/change
    posts.length = 0;
    await submitMjZoom(config(MJ_IMAGINE_MODEL), MJ_IMAGINE_MODEL, "task-1", "ZOOM_OUT_2X");
    assert.equal(posts[0].url, "https://anyaigc.com/mj/submit/change");
    assert.deepEqual(posts[0].body, { taskId: "task-1", action: "ZOOM_OUT_2X" });

    // inpaint 是两步：先 action 进 modal 态，再 modal 带蒙版
    posts.length = 0;
    const source = { imageUrl: "https://cdn.mj/out.png", taskId: "task-1", buttons, promptEn: "a cat --ar 2:3" };
    await submitMjInpaint(config(MJ_IMAGINE_MODEL), MJ_IMAGINE_MODEL, source, { prompt: "add a hat", maskBase64: "data:image/png;base64,mask" });
    assert.equal(posts.length, 2, "inpaint 必须是 action + modal 两步");
    assert.equal(posts[0].url, "https://anyaigc.com/mj/submit/action");
    assert.deepEqual(posts[0].body, { taskId: "task-1", customId: "MJ::Inpaint::1::abc::SOLO" });
    assert.equal(posts[1].url, "https://anyaigc.com/mj/submit/modal");
    assert.deepEqual(posts[1].body, { taskId: "task-1", prompt: "add a hat", maskBase64: "data:image/png;base64,mask" });

    // custom zoom 也是两步，第二步 prompt 带 --zoom，且不重复叠加
    posts.length = 0;
    await submitMjCustomZoom(config(MJ_IMAGINE_MODEL), MJ_IMAGINE_MODEL, source, { prompt: "a cat --zoom 1.2", zoom: 1.8 });
    assert.equal(posts.length, 2);
    assert.equal(posts[1].url, "https://anyaigc.com/mj/submit/modal");
    // 派生操作也带上版本，避免回退到账号默认版本
    assert.deepEqual(posts[1].body, { taskId: "task-1", prompt: "a cat --v 8 --zoom 1.8" });

    // 缺蒙版应拒绝
    await assert.rejects(() => submitMjInpaint(config(MJ_IMAGINE_MODEL), MJ_IMAGINE_MODEL, source, { prompt: "x", maskBase64: "" }));
    // 无对应按钮应拒绝
    await assert.rejects(() => submitMjCustomZoom(config(MJ_IMAGINE_MODEL), MJ_IMAGINE_MODEL, { ...source, buttons: [] }, { prompt: "x", zoom: 2 }));

    // 任务失败应带出 failReason
    axios.get = (async () => ({ data: { status: "FAILURE", failReason: "Banned prompt detected" } })) as typeof axios.get;
    await assert.rejects(() => requestMjImage(config(MJ_IMAGINE_MODEL), "a cat"), /Banned prompt detected/);

    // MJ 端点在域名根路径，baseUrl 带 /v1 时必须剥掉，不能拼成 /v1/mj/...
    const urls: string[] = [];
    axios.post = (async (url: string) => {
        urls.push(url);
        return { data: { code: 1, result: "task-v1" } };
    }) as typeof axios.post;
    const withV1 = config(MJ_IMAGINE_MODEL);
    await submitMjZoom({ ...withV1, channels: withV1.channels.map((channel) => (channel.id === ANYAIGC_MEDIA_CHANNEL_ID ? { ...channel, baseUrl: "https://anyaigc.ai/v1" } : channel)) }, MJ_IMAGINE_MODEL, "task-1", "ZOOM_OUT_2X");
    assert.equal(urls[0], "https://anyaigc.ai/mj/submit/change", "baseUrl 末尾的 /v1 必须剥掉");
    // 自建代理的子路径要保留
    await submitMjZoom({ ...withV1, channels: withV1.channels.map((channel) => (channel.id === ANYAIGC_MEDIA_CHANNEL_ID ? { ...channel, baseUrl: "https://proxy.example.com/relay/v1" } : channel)) }, MJ_IMAGINE_MODEL, "task-1", "ZOOM_OUT_2X");
    assert.equal(urls[1], "https://proxy.example.com/relay/mj/submit/change");

    // 提交无 result 视为失败
    axios.post = (async () => ({ data: { code: 4, description: "quota exhausted" } })) as typeof axios.post;
    await assert.rejects(() => requestMjImage(config(MJ_IMAGINE_MODEL), "a cat"), /quota exhausted/);
} finally {
    axios.post = originalAxiosPost;
    axios.get = originalAxiosGet;
}

console.log("MJ image request contract checks passed");
