import type { ReferenceImage } from "@/types/image";
import { workbenchFormatDuration, workbenchText, type WorkbenchLanguage } from "@/lib/i18n-workbench";

export const AZURE_IMAGE_EDIT_MAX_BYTES = 50 * 1024 * 1024;
export const AZURE_IMAGE_MASK_MAX_BYTES = 4 * 1024 * 1024;
export const AZURE_IMAGE_EDIT_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";

const AZURE_IMAGE_EDIT_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

type ImageDimensions = { width: number; height: number };
type AzureImageEditValidationOptions = {
    index?: number;
    label?: string;
    pngOnly?: boolean;
    maxBytes?: number;
    expectedDimensions?: ImageDimensions;
};

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

export function formatDuration(ms: number, language?: WorkbenchLanguage) {
    return workbenchFormatDuration(ms, language);
}

export function getDataUrlByteSize(dataUrl: string) {
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) {
        return 0;
    }
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function validateAzureImageEditFile(file: Blob & { name?: string }, options: AzureImageEditValidationOptions = {}) {
    const label = options.label || (options.index ? workbenchText(`第 ${options.index} 张参考图`, `Reference image ${options.index}`) : workbenchText("参考图", "Reference image"));
    const mimeType = (file.type || "").toLowerCase();
    const name = file.name || "";
    const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
    const hasMimeType = Boolean(mimeType);
    const allowedByMime = options.pngOnly ? mimeType === "image/png" : AZURE_IMAGE_EDIT_MIME_TYPES.has(mimeType);
    const allowedByExt = options.pngOnly ? extension === "png" : ["png", "jpg", "jpeg"].includes(extension);
    const maxBytes = options.maxBytes || AZURE_IMAGE_EDIT_MAX_BYTES;

    if (hasMimeType ? !allowedByMime : !allowedByExt) {
        throw new Error(options.pngOnly ? workbenchText(`${label} 必须是 PNG 文件`, `${label} must be a PNG file`) : workbenchText(`${label} 只支持 PNG/JPG，请重新导出后上传`, `${label} only supports PNG/JPG. Export it again and upload it.`));
    }
    if (!file.size) throw new Error(workbenchText(`${label} 文件为空，请重新选择`, `${label} is empty. Choose it again.`));
    if (file.size >= maxBytes) throw new Error(workbenchText(`${label} 不能超过 ${formatFileSizeLimit(maxBytes)}`, `${label} cannot exceed ${formatFileSizeLimit(maxBytes)}`));
    const bitmap = await readImageBitmap(file, label);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    if (options.expectedDimensions && (dimensions.width !== options.expectedDimensions.width || dimensions.height !== options.expectedDimensions.height)) {
        throw new Error(workbenchText(`${label} 尺寸必须和参考图一致`, `${label} dimensions must match the reference image`));
    }
    return dimensions;
}

function formatFileSizeLimit(bytes: number) {
    if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)}MB`;
    return formatBytes(bytes);
}

export function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(workbenchText("读取图片失败", "Failed to read the image")));
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
                    throw new Error(workbenchText(`${label} 无法读取，请重新导出为 PNG/JPG`, `${label} could not be read. Export it as PNG/JPG and try again.`));
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
                reject(new Error(workbenchText(`${label} 无法读取，请重新导出为 PNG/JPG`, `${label} could not be read. Export it as PNG/JPG and try again.`)));
                return;
            }
            resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image });
        };
        image.onerror = () => {
            cleanup();
            reject(new Error(workbenchText(`${label} 无法读取，请重新导出为 PNG/JPG`, `${label} could not be read. Export it as PNG/JPG and try again.`)));
        };
        image.src = url;
    });
}
