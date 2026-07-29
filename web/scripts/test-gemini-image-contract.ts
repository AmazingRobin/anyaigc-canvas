import assert from "node:assert/strict";
import axios from "axios";

import { GEMINI_FLASH_IMAGE_MODEL, GEMINI_PRO_IMAGE_MODEL } from "@/lib/anyaigc-media-models";
import { requestGeneration } from "@/services/api/image";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";

const originalAxiosPost = axios.post;

try {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    axios.post = (async (url: string, body: Record<string, unknown>) => {
        requests.push({ url, body });
        return { data: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "image-data" } }] } }] } };
    }) as typeof axios.post;

    const generate = (model: string, size: string) =>
        requestGeneration(
            { ...defaultConfig, apiKey: "test-key", model, imageModel: model, size, count: "1" } satisfies AiConfig,
            "A cat running",
        );

    await generate(GEMINI_FLASH_IMAGE_MODEL, "768x1344");
    await generate(GEMINI_PRO_IMAGE_MODEL, "3840x2160");

    assert.equal(requests[0].url, `https://anyaigc.com/v1beta/models/${GEMINI_FLASH_IMAGE_MODEL}:generateContent`);
    assert.deepEqual(requests[0].body.generationConfig, {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "9:16", imageSize: "1K" },
    });
    assert.deepEqual(requests[1].body.generationConfig, {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "16:9", imageSize: "4K" },
    });
} finally {
    axios.post = originalAxiosPost;
}

console.log("Gemini image request contract checks passed");
