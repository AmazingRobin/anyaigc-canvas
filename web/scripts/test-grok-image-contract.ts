import assert from "node:assert/strict";
import axios from "axios";

import { GROK_IMAGINE_IMAGE_MODEL, GROK_IMAGINE_IMAGE_PRO_MODEL } from "@/lib/anyaigc-media-models";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";

const originalAxiosPost = axios.post;
const originalCreateImageBitmap = globalThis.createImageBitmap;

try {
    const requests: Array<{ url: string; body: unknown }> = [];
    globalThis.createImageBitmap = (async () => ({ width: 768, height: 1344, close() {} })) as typeof createImageBitmap;
    axios.post = (async (url: string, body: unknown) => {
        requests.push({ url, body });
        return { data: { data: [{ b64_json: "image-data" }] } };
    }) as typeof axios.post;

    const config = (model: string): AiConfig => ({ ...defaultConfig, apiKey: "test-key", model, imageModel: model, size: "768x1344", quality: "high", count: "2" });
    await requestGeneration(config(GROK_IMAGINE_IMAGE_MODEL), "A cat running");
    await requestEdit(
        config(GROK_IMAGINE_IMAGE_PRO_MODEL),
        "Add a duck",
        [{ id: "reference", name: "reference.png", type: "image/png", dataUrl: "data:image/png;base64,aQ==" }],
    );

    assert.deepEqual(requests[0], {
        url: "https://anyaigc.com/v1/images/generations",
        body: {
            model: GROK_IMAGINE_IMAGE_MODEL,
            prompt: "A cat running",
            size: "720x1280",
            aspect_ratio: ["9:16", "9:16"],
            n: 2,
            quality: ["high", "high"],
            resolution: ["2k", "2k"],
            response_format: "b64_json",
        },
    });

    assert.equal(requests[1].url, "https://anyaigc.com/v1/images/edits");
    const form = requests[1].body as FormData;
    assert.equal(form.get("model"), GROK_IMAGINE_IMAGE_PRO_MODEL);
    assert.equal(form.get("prompt"), "参考图片编号：图片1。请按这些编号理解提示词中的图片引用。\n\nAdd a duck");
    assert.equal(form.get("image") instanceof File, true);
    assert.equal(form.get("image[]"), null);
    assert.equal(form.get("aspect_ratio"), "9:16");
    assert.equal(form.get("quality"), "high");
    assert.equal(form.get("resolution"), "2k");
    assert.equal(form.get("n"), "2");
    assert.equal(form.get("response_format"), "b64_json");
} finally {
    axios.post = originalAxiosPost;
    globalThis.createImageBitmap = originalCreateImageBitmap;
}

console.log("Grok image request contract checks passed");
