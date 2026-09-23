import assert from "node:assert/strict";
import axios from "axios";

import { DOUBAO_SEEDREAM_5_MODEL, DOUBAO_SEEDREAM_5_PRO_MODEL, imageReferenceLimit, mediaRequestError, seedreamImageSize } from "@/lib/anyaigc-media-models";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";

const originalAxiosPost = axios.post;
const originalFetch = globalThis.fetch;

assert.equal(imageReferenceLimit(DOUBAO_SEEDREAM_5_MODEL), 14);
assert.equal(imageReferenceLimit(DOUBAO_SEEDREAM_5_PRO_MODEL), 10);
assert.equal(mediaRequestError(DOUBAO_SEEDREAM_5_PRO_MODEL, { imageCount: 11 }, "zh"), "当前图片模型最多支持 10 张参考图");
assert.equal(mediaRequestError(DOUBAO_SEEDREAM_5_MODEL, { hasMask: true }, "en"), "The selected image model does not support masked editing.");
assert.equal(seedreamImageSize(DOUBAO_SEEDREAM_5_MODEL, "medium", "auto"), "2K");
assert.equal(seedreamImageSize(DOUBAO_SEEDREAM_5_MODEL, "high", "auto"), "4K");
assert.equal(seedreamImageSize(DOUBAO_SEEDREAM_5_PRO_MODEL, "high", "auto"), "2K");
assert.equal(seedreamImageSize(DOUBAO_SEEDREAM_5_PRO_MODEL, "low", "auto"), "1K");
assert.equal(seedreamImageSize(DOUBAO_SEEDREAM_5_MODEL, "medium", "768x1344"), "1584x2816");
assert.equal(seedreamImageSize(DOUBAO_SEEDREAM_5_PRO_MODEL, "medium", "768x1344"), "800x1424");
assert.equal(seedreamImageSize(DOUBAO_SEEDREAM_5_PRO_MODEL, "medium", "4K"), "2K");

try {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    axios.post = (async (url: string, body: Record<string, unknown>) => {
        requests.push({ url, body });
        return { data: { data: [{ b64_json: "data:image/jpeg;base64,/9j/seedream" }] } };
    }) as typeof axios.post;
    globalThis.fetch = (async (input) => {
        if (String(input) === "https://imageproxy.zhongzhuan.chat/api/upload") {
            return new Response(JSON.stringify({ url: "https://imageproxy.zhongzhuan.chat/seedream.png" }), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as typeof fetch;

    const config = (model: string, size = "auto"): AiConfig => ({ ...defaultConfig, apiKey: "test-key", model, imageModel: model, size, quality: "high", count: "1" });
    const generated = await requestGeneration(config(DOUBAO_SEEDREAM_5_MODEL), "A courtyard in four seasons");
    assert.equal(generated[0].dataUrl, "data:image/jpeg;base64,/9j/seedream");
    await requestGeneration(config(DOUBAO_SEEDREAM_5_PRO_MODEL, "768x1344"), "一只猫");
    await requestEdit(config(DOUBAO_SEEDREAM_5_MODEL, "2K"), "Keep the same courtyard, add snow", [{ id: "ref", name: "ref.png", type: "image/png", dataUrl: "data:image/png;base64,aQ==" }]);

    assert.equal(requests[0].url, "https://anyaigc.com/v1/images/generations");
    assert.deepEqual(requests[0].body, {
        model: DOUBAO_SEEDREAM_5_MODEL,
        prompt: "A courtyard in four seasons",
        size: "4K",
        response_format: "b64_json",
        output_format: "png",
        watermark: false,
    });
    assert.equal(requests[1].url, "https://anyaigc.com/api/v3/images/generations");
    assert.deepEqual(requests[1].body, {
        model: DOUBAO_SEEDREAM_5_PRO_MODEL,
        prompt: "一只猫",
        size: "800x1424",
        response_format: "b64_json",
        output_format: "png",
        watermark: false,
    });
    assert.equal(requests[2].url, "https://anyaigc.com/v1/images/generations");
    assert.equal(requests[2].body.image, "https://imageproxy.zhongzhuan.chat/seedream.png");
    assert.equal(requests[2].body.size, "2K");
    assert.equal("n" in requests[2].body, false);
    assert.equal("sequential_image_generation" in requests[1].body, false);
} finally {
    axios.post = originalAxiosPost;
    globalThis.fetch = originalFetch;
}

console.log("Seedream image request contract checks passed");
