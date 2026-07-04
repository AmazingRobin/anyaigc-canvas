"use client";

export type SubmitTaskShortcut = "ctrlEnter" | "enter";
export type ReferenceEditMode = "append" | "replace" | "ask";

type SubmitKeyEvent = {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    preventDefault: () => void;
    nativeEvent?: Event & { isComposing?: boolean };
};

export function normalizeSubmitTaskShortcut(value: unknown): SubmitTaskShortcut {
    return value === "enter" ? "enter" : "ctrlEnter";
}

export function normalizeReferenceEditMode(value: unknown): ReferenceEditMode {
    return value === "replace" || value === "ask" ? value : "append";
}

export function shouldSubmitPrompt(event: SubmitKeyEvent, shortcut: SubmitTaskShortcut) {
    if (event.nativeEvent?.isComposing) return false;
    if (event.key !== "Enter") return false;
    if (shortcut === "enter") return !event.shiftKey;
    return event.ctrlKey || event.metaKey;
}

export async function requestWorkbenchNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    if (Notification.permission !== "default") return Notification.permission;
    return Notification.requestPermission();
}

export function notifyWorkbenchTask(enabled: boolean, title: string, body: string) {
    if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body });
}

export function fileExtensionFromMime(mimeType?: string, fallback = "bin") {
    if (!mimeType) return fallback;
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("quicktime")) return "mov";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("mpeg")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    return fallback;
}

export function safeArchiveName(value: string) {
    return value
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "relaybases";
}

export function timestampForFileName() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
