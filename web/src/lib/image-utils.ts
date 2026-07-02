import type { ReferenceImage } from "@/types/image";

export const AZURE_IMAGE_EDIT_MAX_BYTES = 50 * 1024 * 1024;
export const AZURE_IMAGE_EDIT_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";

const AZURE_IMAGE_EDIT_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

export function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "";
    }
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number) {
    const value = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return minutes ? `${minutes}分${String(seconds).padStart(2, "0")}秒` : `${seconds}秒`;
}

export function getDataUrlByteSize(dataUrl: string) {
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) {
        return 0;
    }
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function validateAzureImageEditFile(file: Blob & { name?: string }, options: { index?: number; label?: string; pngOnly?: boolean } = {}) {
    const label = options.label || (options.index ? `第 ${options.index} 张参考图` : "参考图");
    const mimeType = (file.type || "").toLowerCase();
    const name = file.name || "";
    const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
    const hasMimeType = Boolean(mimeType);
    const allowedByMime = options.pngOnly ? mimeType === "image/png" : AZURE_IMAGE_EDIT_MIME_TYPES.has(mimeType);
    const allowedByExt = options.pngOnly ? extension === "png" : ["png", "jpg", "jpeg"].includes(extension);

    if (hasMimeType ? !allowedByMime : !allowedByExt) {
        throw new Error(options.pngOnly ? `${label} 必须是 PNG 文件` : `${label} 只支持 PNG/JPG，请重新导出后上传`);
    }
    if (!file.size) throw new Error(`${label} 文件为空，请重新选择`);
    if (file.size >= AZURE_IMAGE_EDIT_MAX_BYTES) throw new Error(`${label} 不能超过 50MB`);
    await readImageBitmap(file, label);
}

export async function normalizeAzureImageEditFile(file: File, options: { index?: number; label?: string; pngOnly?: boolean } = {}) {
    await validateAzureImageEditFile(file, options);
    const label = options.label || (options.index ? `第 ${options.index} 张参考图` : "参考图");
    const bitmap = await readImageBitmap(file, label);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(`${label} 无法转换为可用图片，请重新导出后上传`);
    context.drawImage(bitmap.source, 0, 0);
    bitmap.close?.();
    const blob = await canvasToBlob(canvas, "image/png");
    if (blob.size >= AZURE_IMAGE_EDIT_MAX_BYTES) throw new Error(`${label} 转换后超过 50MB，请压缩后再上传`);
    return new File([blob], replaceFileExtension(file.name || "reference.png", "png"), { type: "image/png" });
}

export function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
    });
}

export function readImageMeta(dataUrl: string) {
    return new Promise<{ width: number; height: number; mimeType: string }>((resolve) => {
        const image = new Image();
        const done = () => resolve({ width: image.naturalWidth || 1024, height: image.naturalHeight || 1024, mimeType: dataUrl.match(/^data:([^;]+)/)?.[1] || "image/png" });
        image.onload = done;
        image.onerror = done;
        setTimeout(done, 3000);
        image.src = dataUrl;
    });
}

export function dataUrlToFile(image: ReferenceImage) {
    const [header, content] = image.dataUrl.split(",", 2);
    const mimeType = header.match(/data:(.*?);base64/)?.[1] || image.type || "image/png";
    const binary = atob(content || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], image.name || "reference.png", { type: mimeType });
}

function readImageBitmap(file: Blob, label: string): Promise<{ width: number; height: number; source: CanvasImageSource; close?: () => void }> {
    if (typeof createImageBitmap === "function") {
        return createImageBitmap(file)
            .then((bitmap) => {
                if (!bitmap.width || !bitmap.height) {
                    bitmap.close();
                    throw new Error(`${label} 无法读取，请重新导出为 PNG/JPG`);
                }
                return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
            })
            .catch(() => readImageElement(file, label));
    }
    return readImageElement(file, label);
}

function readImageElement(file: Blob, label: string): Promise<{ width: number; height: number; source: CanvasImageSource; close?: () => void }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        const cleanup = () => URL.revokeObjectURL(url);
        image.onload = () => {
            cleanup();
            if (!image.naturalWidth || !image.naturalHeight) {
                reject(new Error(`${label} 无法读取，请重新导出为 PNG/JPG`));
                return;
            }
            resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image });
        };
        image.onerror = () => {
            cleanup();
            reject(new Error(`${label} 无法读取，请重新导出为 PNG/JPG`));
        };
        image.src = url;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("图片转换失败，请重新导出后上传"))), mimeType);
    });
}

function replaceFileExtension(name: string, extension: string) {
    return name.replace(/\.[^.]+$/, "") + `.${extension}`;
}
