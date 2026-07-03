"use client";

const VIDEO_THUMBNAIL_SIZE = 512;
const VIDEO_THUMBNAIL_MAX_DATA_URL_LENGTH = 700_000;
const VIDEO_THUMBNAIL_QUALITY = 0.82;

export function normalizeVideoThumbnail(thumbnail?: string) {
    if (!thumbnail) return "";
    if (thumbnail.startsWith("data:") && thumbnail.length > VIDEO_THUMBNAIL_MAX_DATA_URL_LENGTH) return "";
    return thumbnail;
}

export async function createVideoThumbnail(url?: string) {
    if (!url || typeof document === "undefined") return "";
    return new Promise<string>((resolve) => {
        const video = document.createElement("video");
        const timer = window.setTimeout(() => done(""), 4200);
        let settled = false;
        const done = (value: string) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            video.removeAttribute("src");
            video.load();
            resolve(normalizeVideoThumbnail(value));
        };
        const capture = () => {
            try {
                const width = video.videoWidth || 1280;
                const height = video.videoHeight || 720;
                const scale = Math.min(1, VIDEO_THUMBNAIL_SIZE / Math.max(width, height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                const context = canvas.getContext("2d");
                if (!context) {
                    done("");
                    return;
                }
                window.requestAnimationFrame(() => {
                    try {
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
                        done(canvas.toDataURL("image/webp", VIDEO_THUMBNAIL_QUALITY));
                    } catch {
                        done("");
                    }
                });
            } catch {
                done("");
            }
        };
        const seekOrCapture = () => {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const targetTime = duration > 0.4 ? Math.min(0.25, duration / 3) : 0;
            if (!targetTime) {
                capture();
                return;
            }
            video.onseeked = capture;
            try {
                video.currentTime = targetTime;
            } catch {
                capture();
            }
        };
        if (/^https?:/i.test(url)) video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.onloadedmetadata = seekOrCapture;
        video.onloadeddata = () => {
            if (!Number.isFinite(video.duration) || video.duration <= 0.4) capture();
        };
        video.onerror = () => done("");
        video.src = url;
        video.load();
    });
}
