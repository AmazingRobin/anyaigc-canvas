const imageMimeTypes: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

export type ZipImageFile = {
    path: string;
    blob: Blob;
    mimeType: string;
    title: string;
};

export function collectZipImageFiles(entries: ReadonlyMap<string, Blob>): ZipImageFile[] {
    return Array.from(entries.entries()).flatMap(([path, blob]) => {
        const extension = path.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
        const mimeType = extension ? imageMimeTypes[extension] : undefined;
        if (!mimeType || path.endsWith("/")) return [];
        const filename = path.split(/[\\/]/).pop() || path;
        return [{ path, blob, mimeType, title: filename.replace(/\.[^.]+$/, "") || filename }];
    });
}
