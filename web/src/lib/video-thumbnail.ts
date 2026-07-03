"use client";

const VIDEO_THUMBNAIL_SIZE = 960;
const VIDEO_THUMBNAIL_MAX_DATA_URL_LENGTH = 1_200_000;
const VIDEO_THUMBNAIL_QUALITY = 0.86;
export const VIDEO_THUMBNAIL_VERSION = "frame-jpeg-v3";

export function normalizeVideoThumbnail(thumbnail?: string) {
    if (!thumbnail) return "";
    if (thumbnail.startsWith("data:") && thumbnail.length > VIDEO_THUMBNAIL_MAX_DATA_URL_LENGTH) return "";
    return thumbnail;
}

export async function createVideoThumbnail(url?: string) {
    if (!url || typeof document === "undefined") return "";
    const video = document.createElement("video");
    try {
        if (/^https?:/i.test(url)) video.crossOrigin = "anonymous";
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        Object.assign(video.style, {
            position: "fixed",
            left: "-9999px",
            top: "0",
            width: "1px",
            height: "1px",
            opacity: "0",
            pointerEvents: "none",
        });
        document.body.appendChild(video);
        video.src = url;
        video.load();
        await waitForVideoEvent(video, ["loadedmetadata", "loadeddata", "canplay"], 5000, true);

        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        let bestFrame = "";
        for (const time of thumbnailCandidateTimes(duration)) {
            const frame = await captureVideoFrame(video, time);
            if (!frame.dataUrl) continue;
            if (!bestFrame) bestFrame = frame.dataUrl;
            if (!frame.tooDark) return frame.dataUrl;
        }
        return bestFrame;
    } catch {
        return "";
    } finally {
        video.removeAttribute("src");
        video.load();
        video.remove();
    }
}

async function captureVideoFrame(video: HTMLVideoElement, time: number) {
    if (time > 0) {
        try {
            video.currentTime = Math.min(time, Math.max(0, Number.isFinite(video.duration) ? video.duration - 0.05 : time));
            await waitForVideoEvent(video, ["seeked", "loadeddata", "canplay"], 2200, false);
        } catch {}
    }
    await waitForVideoFrame(video);
    return drawVideoFrame(video);
}

function drawVideoFrame(video: HTMLVideoElement) {
    try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const scale = Math.min(1, VIDEO_THUMBNAIL_SIZE / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) return { dataUrl: "", tooDark: true };
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const tooDark = isCanvasMostlyDark(context, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/jpeg", VIDEO_THUMBNAIL_QUALITY);
        return { dataUrl: normalizeVideoThumbnail(thumbnail) || canvas.toDataURL("image/jpeg", 0.62), tooDark };
    } catch {
        return { dataUrl: "", tooDark: true };
    }
}

function thumbnailCandidateTimes(duration: number) {
    if (!duration) return [0, 0.18, 0.45, 0.9];
    return Array.from(new Set([Math.min(0.2, duration * 0.08), Math.min(0.65, duration * 0.18), Math.min(1.2, duration * 0.32), Math.max(0, duration * 0.5), Math.max(0, duration * 0.72)])).filter((time) => time >= 0 && time < Math.max(duration - 0.05, 0.01));
}

function waitForVideoFrame(video: HTMLVideoElement) {
    return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            window.clearTimeout(timer);
            resolve();
        };
        const timer = window.setTimeout(finish, 900);
        if ("requestVideoFrameCallback" in video) {
            (video as HTMLVideoElement & { requestVideoFrameCallback: (callback: () => void) => void }).requestVideoFrameCallback(finish);
            return;
        }
        window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
    });
}

function waitForVideoEvent(video: HTMLVideoElement, events: string[], timeoutMs: number, allowReadyState: boolean) {
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            window.clearTimeout(timer);
            events.forEach((event) => video.removeEventListener(event, done));
            video.removeEventListener("error", fail);
        };
        const done = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };
        const fail = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("video load failed"));
        };
        const timer = window.setTimeout(done, timeoutMs);
        events.forEach((event) => video.addEventListener(event, done, { once: true }));
        video.addEventListener("error", fail, { once: true });
        if (allowReadyState && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) done();
    });
}

function isCanvasMostlyDark(context: CanvasRenderingContext2D, width: number, height: number) {
    try {
        const sampleWidth = Math.min(width, 36);
        const sampleHeight = Math.min(height, 36);
        const data = context.getImageData(Math.floor((width - sampleWidth) / 2), Math.floor((height - sampleHeight) / 2), sampleWidth, sampleHeight).data;
        let total = 0;
        for (let index = 0; index < data.length; index += 4) total += data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
        return total / (data.length / 4) < 12;
    } catch {
        return false;
    }
}
