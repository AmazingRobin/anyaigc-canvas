import assert from "node:assert/strict";

import { uploadImageReference, uploadVideoReference } from "@/services/api/media-upload";

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; init?: RequestInit }> = [];

globalThis.fetch = (async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/api/upload/init")) {
        return new Response(JSON.stringify({ data: { success: true, type: "single", upload_url: "https://r2.example/upload", headers: { "x-amz-acl": ["private"] }, r2_key: "r2-key" } }), { status: 200 });
    }
    if (url === "https://r2.example/upload") return new Response(null, { status: 200 });
    if (url.endsWith("/api/upload/confirm")) {
        return new Response(JSON.stringify({ data: { success: true, file: { url: "https://storage.to/FQxyz1234" } } }), { status: 200 });
    }
    if (url === "https://imageproxy.zhongzhuan.chat/api/upload") return new Response(JSON.stringify({ url: "https://imageproxy.zhongzhuan.chat/image.png" }), { status: 200 });
    throw new Error(`Unexpected request: ${url}`);
}) as typeof fetch;

try {
    const image = new File(["image"], "reference.png", { type: "image/png" });
    assert.equal(await uploadImageReference(image), "https://imageproxy.zhongzhuan.chat/image.png");
    assert.equal(calls[0].url, "https://imageproxy.zhongzhuan.chat/api/upload");
    assert.equal(calls[0].init?.method, "POST");
    const uploadedImage = (calls[0].init?.body as FormData).get("file") as File;
    assert.equal(uploadedImage.name, "reference.png");
    assert.equal(uploadedImage.type, "image/png");

    calls.length = 0;
    const video = new File(["video"], "reference.mp4", { type: "video/mp4" });
    assert.equal(await uploadVideoReference(video), "https://storage.to/FQxyz1234");
    assert.deepEqual(calls.map((call) => call.url), ["https://storage.to/api/upload/init", "https://r2.example/upload", "https://storage.to/api/upload/confirm"]);
    assert.equal(calls[1].init?.method, "PUT");
    assert.equal(calls[1].init?.body, video);
    assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { filename: "reference.mp4", size: 5, content_type: "video/mp4", r2_key: "r2-key" });

    calls.length = 0;
    globalThis.fetch = (async (input, init) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.endsWith("/api/upload/init")) return new Response(JSON.stringify({ success: true, type: "multipart", upload_id: "upload-1", r2_key: "r2-key", part_size: 3, total_parts: 2, initial_urls: { "1": "https://r2.example/part-1" } }), { status: 200 });
        if (url.endsWith("/api/upload/parts")) return new Response(JSON.stringify({ success: true, part_urls: [{ partNumber: 2, url: "https://r2.example/part-2" }] }), { status: 200 });
        if (url.startsWith("https://r2.example/part-")) return new Response(null, { status: 200, headers: { etag: `etag-${url.at(-1)}` } });
        if (url.endsWith("/api/upload/complete-multipart")) return new Response(JSON.stringify({ success: true }), { status: 200 });
        if (url.endsWith("/api/upload/confirm")) return new Response(JSON.stringify({ success: true, file: { url: "https://storage.to/FQmultipart" } }), { status: 200 });
        throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
    const multipartVideo = new File(["abcdef"], "large.mp4", { type: "video/mp4" });
    assert.equal(await uploadVideoReference(multipartVideo), "https://storage.to/FQmultipart");
    assert.deepEqual(calls.map((call) => call.url), ["https://storage.to/api/upload/init", "https://r2.example/part-1", "https://storage.to/api/upload/parts", "https://r2.example/part-2", "https://storage.to/api/upload/complete-multipart", "https://storage.to/api/upload/confirm"]);
    assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { upload_id: "upload-1", parts: [{ partNumber: 1, etag: "etag-1" }, { partNumber: 2, etag: "etag-2" }] });
} finally {
    globalThis.fetch = originalFetch;
}

console.log("Reference media upload contract checks passed");
