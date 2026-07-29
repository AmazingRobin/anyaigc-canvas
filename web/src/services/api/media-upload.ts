const IMAGE_PROXY_URL = "https://imageproxy.zhongzhuan.chat/api/upload";
const STORAGE_API_URL = "https://storage.to/api";

type UploadInitResponse = {
    success?: boolean;
    type?: string;
    upload_url?: string;
    headers?: Record<string, string | string[]>;
    r2_key?: string;
    upload_id?: string;
    part_size?: number;
    total_parts?: number;
    initial_urls?: Record<string, string>;
};

type UploadPartsResponse = { success?: boolean; part_urls?: Array<{ partNumber?: number; url?: string }> };

type UploadConfirmResponse = {
    success?: boolean;
    file?: { url?: string };
};

export async function uploadImageReference(file: File, signal?: AbortSignal) {
    const form = new FormData();
    form.append("file", file, file.name || "reference.png");
    try {
        const response = await fetch(IMAGE_PROXY_URL, { method: "POST", body: form, signal });
        const payload = (await response.json().catch(() => null)) as { url?: unknown } | null;
        if (!response.ok || typeof payload?.url !== "string" || !payload.url.trim()) throw new Error("invalid image proxy response");
        return payload.url;
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new Error("图片参考素材上传失败 / Failed to upload image reference");
    }
}

export async function uploadVideoReference(file: File, signal?: AbortSignal) {
    const metadata = { filename: file.name || "reference.mp4", size: file.size, content_type: file.type || "video/mp4" };
    try {
        const initResponse = await fetch(`${STORAGE_API_URL}/upload/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metadata),
            signal,
        });
        const init = unwrapData((await initResponse.json().catch(() => null)) as UploadInitResponse | { data?: UploadInitResponse } | null);
        if (!initResponse.ok || !init?.success || !init.r2_key) throw new Error("invalid upload init response");
        if (init.type === "single") {
            if (!init.upload_url) throw new Error("missing upload url");
            const uploadResponse = await fetch(init.upload_url, { method: "PUT", headers: uploadHeaders(init.headers), body: file, signal });
            if (!uploadResponse.ok) throw new Error("presigned upload failed");
        } else if (init.type === "multipart") {
            await uploadMultipart(file, init, signal);
        } else {
            throw new Error("unsupported upload type");
        }

        const confirmResponse = await fetch(`${STORAGE_API_URL}/upload/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...metadata, r2_key: init.r2_key }),
            signal,
        });
        const confirm = unwrapData((await confirmResponse.json().catch(() => null)) as UploadConfirmResponse | { data?: UploadConfirmResponse } | null);
        if (!confirmResponse.ok || !confirm?.success || !confirm.file?.url) throw new Error("invalid upload confirm response");
        return confirm.file.url;
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new Error("视频参考素材上传失败 / Failed to upload video reference");
    }
}

async function uploadMultipart(file: File, init: UploadInitResponse, signal?: AbortSignal) {
    const uploadId = init.upload_id;
    const partSize = Number(init.part_size);
    const totalParts = Number(init.total_parts);
    if (!uploadId || !Number.isSafeInteger(partSize) || partSize < 1 || !Number.isSafeInteger(totalParts) || totalParts < 1) throw new Error("invalid multipart init response");
    const urls = new Map<number, string>();
    for (const [number, url] of Object.entries(init.initial_urls || {})) {
        const partNumber = Number(number);
        if (Number.isSafeInteger(partNumber) && url) urls.set(partNumber, url);
    }
    const parts: Array<{ partNumber: number; etag: string }> = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        let url = urls.get(partNumber);
        if (!url) {
            const response = await fetch(`${STORAGE_API_URL}/upload/parts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ upload_id: uploadId, part_numbers: [partNumber] }),
                signal,
            });
            const payload = unwrapData((await response.json().catch(() => null)) as UploadPartsResponse | { data?: UploadPartsResponse } | null);
            url = payload?.part_urls?.find((item) => item.partNumber === partNumber)?.url;
            if (!response.ok || !payload?.success || !url) throw new Error("missing multipart upload url");
        }
        const body = file.slice((partNumber - 1) * partSize, Math.min(partNumber * partSize, file.size));
        const response = await fetch(url, { method: "PUT", body, signal });
        const etag = response.headers.get("etag");
        if (!response.ok || !etag) throw new Error("multipart upload failed");
        parts.push({ partNumber, etag });
    }
    const completeResponse = await fetch(`${STORAGE_API_URL}/upload/complete-multipart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: uploadId, parts }),
        signal,
    });
    const complete = unwrapData((await completeResponse.json().catch(() => null)) as { success?: boolean; data?: { success?: boolean } } | null);
    if (!completeResponse.ok || !complete?.success) throw new Error("multipart completion failed");
}

function uploadHeaders(headers: UploadInitResponse["headers"]) {
    return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : value]));
}

function unwrapData<T>(payload: T | { data?: T } | null) {
    if (!payload || typeof payload !== "object") return null;
    return "data" in payload && payload.data ? payload.data : payload as T;
}
