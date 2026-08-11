import { saveAs } from "file-saver";

import { collectZipImageFiles } from "@/lib/asset-archive";
import { createZip, readZip } from "@/lib/zip";
import { getMediaBlob, setMediaBlob } from "@/services/file-storage";
import { getImageBlob, setImageBlob, uploadImage } from "@/services/image-storage";
import type { Asset } from "@/stores/use-asset-store";

type AssetExportFile = {
    app: "infinite-canvas";
    version: 1;
    exportedAt: string;
    assets: Asset[];
    files: AssetExportItem[];
};

type AssetExportItem = {
    storageKey: string;
    path: string;
    mimeType: string;
    bytes: number;
};

export type AssetPackageImportResult = {
    assets: Array<Omit<Asset, "id" | "createdAt" | "updatedAt">>;
    mode: "backup" | "images";
    skippedFiles: number;
};

export async function exportAssets(assets: Asset[]) {
    const files: AssetExportItem[] = [];
    const zipFiles: { name: string; data: BlobPart }[] = [];

    await Promise.all(
        assets.map(async (asset) => {
            if (asset.kind !== "image" && asset.kind !== "video") return;
            const storageKey = asset.data.storageKey;
            if (!storageKey) return;
            const blob = asset.kind === "image" ? await getImageBlob(storageKey) : await getMediaBlob(storageKey);
            if (!blob) return;
            const path = `files/${safeFileName(storageKey)}.${fileExtension(blob.type, asset.kind)}`;
            files.push({ storageKey, path, mimeType: blob.type || asset.data.mimeType, bytes: blob.size });
            zipFiles.push({ name: path, data: blob });
        }),
    );

    const data: AssetExportFile = { app: "infinite-canvas", version: 1, exportedAt: new Date().toISOString(), assets, files };
    const zip = await createZip([{ name: "assets.json", data: JSON.stringify(data, null, 2) }, ...zipFiles]);
    saveAs(zip, "我的素材.zip");
}

export async function readAssetPackage(file: File) {
    const zip = await readZip(file);
    const assetFile = zip.get("assets.json");
    if (assetFile) {
        const data = JSON.parse(await assetFile.text()) as AssetExportFile;
        await Promise.all(
            data.files.map(async (item) => {
                const blob = zip.get(item.path);
                if (!blob) return;
                const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
                await (item.storageKey.startsWith("image:") ? setImageBlob(item.storageKey, typedBlob) : setMediaBlob(item.storageKey, typedBlob));
            }),
        );
        return { assets: data.assets, mode: "backup", skippedFiles: 0 } satisfies AssetPackageImportResult;
    }

    const entries = Array.from(zip.entries()).filter(([path]) => !path.endsWith("/"));
    const imageFiles = collectZipImageFiles(zip);
    if (!imageFiles.length) throw new Error("no supported images");
    const imported = await Promise.all(
        imageFiles.map(async ({ path, blob, mimeType, title }) => {
            try {
                const image = await uploadImage(blob.slice(0, blob.size, mimeType));
                return {
                    kind: "image" as const,
                    title,
                    coverUrl: image.url,
                    tags: [],
                    source: "ZIP 导入",
                    metadata: { source: "zip-import", path },
                    data: { dataUrl: image.url, storageKey: image.storageKey, width: image.width, height: image.height, bytes: image.bytes, mimeType: image.mimeType },
                };
            } catch {
                return null;
            }
        }),
    );
    const assets = imported.filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    if (!assets.length) throw new Error("no supported images");
    return { assets, mode: "images", skippedFiles: entries.length - assets.length } satisfies AssetPackageImportResult;
}

function safeFileName(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_");
}

function fileExtension(mimeType: string, kind: Asset["kind"]) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    return kind === "image" ? "png" : "bin";
}
