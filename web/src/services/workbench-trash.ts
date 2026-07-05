"use client";

import localforage from "localforage";
import { nanoid } from "nanoid";

import type { AppSyncDomainKey } from "@/services/app-sync";
import { deleteStoredMedia } from "@/services/file-storage";
import { deleteStoredImages } from "@/services/image-storage";

export type WorkbenchTrashEntry<T extends { id?: string } = Record<string, unknown>> = {
    id: string;
    logId: string;
    domain: AppSyncDomainKey;
    deletedAt: number;
    expiresAt: number;
    log: T;
    purgeStorageKeys: string[];
};

export const WORKBENCH_TRASH_RETENTION_DAYS = 30;

const WORKBENCH_TRASH_RETENTION_MS = WORKBENCH_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const trashStore = localforage.createInstance({ name: "infinite-canvas", storeName: "workbench_trash" });
const storageKeyPattern = /^(image|video|audio|file|video-reference|audio-reference):/;

export async function moveLogToWorkbenchTrash<T extends { id?: string }>(domain: AppSyncDomainKey, log: T, options: { purgeStorageKeys?: string[] } = {}) {
    const logId = String(log.id || "").trim();
    if (!logId) return null;
    await purgeExpiredWorkbenchTrash(domain);
    const deletedAt = Date.now();
    const entry: WorkbenchTrashEntry<T> = {
        id: `${logId}:${deletedAt}:${nanoid(6)}`,
        logId,
        domain,
        deletedAt,
        expiresAt: deletedAt + WORKBENCH_TRASH_RETENTION_MS,
        log: clonePlainObject(log),
        purgeStorageKeys: Array.from(new Set(options.purgeStorageKeys || collectStorageKeys(log))),
    };
    await trashStore.setItem(trashKey(domain, entry.id), entry);
    return entry;
}

export async function moveLogsToWorkbenchTrash<T extends { id?: string }>(domain: AppSyncDomainKey, logs: T[]) {
    for (const log of logs) {
        await moveLogToWorkbenchTrash(domain, log);
    }
}

export async function readWorkbenchTrash<T extends { id?: string }>(domain: AppSyncDomainKey) {
    await purgeExpiredWorkbenchTrash(domain);
    const entries: WorkbenchTrashEntry<T>[] = [];
    await trashStore.iterate<WorkbenchTrashEntry<T>, void>((entry) => {
        if (entry?.domain === domain) entries.push(entry);
    });
    return entries.sort((a, b) => b.deletedAt - a.deletedAt);
}

export async function restoreWorkbenchTrashEntry<T extends { id?: string }>(domain: AppSyncDomainKey, entryId: string) {
    const entry = await trashStore.getItem<WorkbenchTrashEntry<T>>(trashKey(domain, entryId));
    if (!entry || entry.domain !== domain) return null;
    await trashStore.removeItem(trashKey(domain, entryId));
    return entry;
}

export async function removeWorkbenchTrashEntry(domain: AppSyncDomainKey, entryId: string) {
    const entry = await trashStore.getItem<WorkbenchTrashEntry>(trashKey(domain, entryId));
    if (!entry || entry.domain !== domain) return;
    await purgeTrashEntryMedia(entry);
    await trashStore.removeItem(trashKey(domain, entryId));
}

export async function emptyWorkbenchTrash(domain: AppSyncDomainKey) {
    const entries = await readWorkbenchTrash(domain);
    for (const entry of entries) {
        await removeWorkbenchTrashEntry(domain, entry.id);
    }
}

export async function purgeExpiredWorkbenchTrash(domain?: AppSyncDomainKey) {
    const now = Date.now();
    const expired: WorkbenchTrashEntry[] = [];
    await trashStore.iterate<WorkbenchTrashEntry, void>((entry) => {
        if (!entry || (domain && entry.domain !== domain)) return;
        if ((entry.expiresAt || 0) <= now) expired.push(entry);
    });
    for (const entry of expired) {
        await purgeTrashEntryMedia(entry);
        await trashStore.removeItem(trashKey(entry.domain, entry.id));
    }
}

export function formatTrashExpiry(expiresAt: number) {
    const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    return days ? `${days} 天后清理` : "即将清理";
}

function trashKey(domain: AppSyncDomainKey, id: string) {
    return `${domain}:${id}`;
}

async function purgeTrashEntryMedia(entry: WorkbenchTrashEntry) {
    const keys = Array.from(new Set(entry.purgeStorageKeys || []));
    const imageKeys = keys.filter((key) => key.startsWith("image:"));
    const mediaKeys = keys.filter((key) => !key.startsWith("image:"));
    if (imageKeys.length) await deleteStoredImages(imageKeys);
    if (mediaKeys.length) await deleteStoredMedia(mediaKeys);
}

function collectStorageKeys(value: unknown, keys = new Set<string>()) {
    if (typeof value === "string") {
        if (storageKeyPattern.test(value)) keys.add(value);
        return [...keys];
    }
    if (!value || typeof value !== "object") return [...keys];
    if (Array.isArray(value)) {
        value.forEach((item) => collectStorageKeys(item, keys));
        return [...keys];
    }

    const record = value as Record<string, unknown>;
    const storageKey = record.storageKey;
    if (typeof storageKey === "string" && storageKeyPattern.test(storageKey)) keys.add(storageKey);
    Object.values(record).forEach((item) => collectStorageKeys(item, keys));
    return [...keys];
}

function clonePlainObject<T>(value: T): T {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value)) as T;
}
