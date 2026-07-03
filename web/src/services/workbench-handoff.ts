"use client";

import { nanoid } from "nanoid";

import type { ReferenceImage } from "@/types/image";

const IMAGE_TO_VIDEO_REFERENCES_KEY = "relaybases-canvas:image-to-video-references";

type ImageToVideoReferenceHandoff = {
    createdAt: number;
    prompt?: string;
    references: ReferenceImage[];
};

export function queueImageToVideoReferences(references: ReferenceImage[], prompt?: string) {
    if (typeof window === "undefined" || !references.length) return;
    const payload: ImageToVideoReferenceHandoff = {
        createdAt: Date.now(),
        prompt,
        references: references.map(normalizeReferenceImage).filter((item) => item.storageKey || item.dataUrl || item.url),
    };
    window.sessionStorage.setItem(IMAGE_TO_VIDEO_REFERENCES_KEY, JSON.stringify(payload));
}

export function consumeImageToVideoReferences(): ImageToVideoReferenceHandoff | null {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(IMAGE_TO_VIDEO_REFERENCES_KEY);
    window.sessionStorage.removeItem(IMAGE_TO_VIDEO_REFERENCES_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<ImageToVideoReferenceHandoff>;
        const references = Array.isArray(parsed.references) ? parsed.references.map(normalizeReferenceImage).filter((item) => item.storageKey || item.dataUrl || item.url) : [];
        if (!references.length) return null;
        return {
            createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
            prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
            references,
        };
    } catch {
        return null;
    }
}

function normalizeReferenceImage(image: Partial<ReferenceImage>): ReferenceImage {
    return {
        id: image.id || nanoid(),
        name: image.name || "reference.png",
        type: image.type || "image/png",
        dataUrl: image.dataUrl || "",
        url: image.url,
        storageKey: image.storageKey,
    };
}
