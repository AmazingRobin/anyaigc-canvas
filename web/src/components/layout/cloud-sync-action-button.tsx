"use client";

import { App } from "antd";
import { AlertCircle, Cloud, RefreshCw } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { getCloudSyncApiKey } from "@/services/cloud-sync";
import { syncAppDataToCloud } from "@/services/app-sync";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

const CLOUD_SYNC_MANUAL_STARTED_AT_KEY = "infinite-canvas:cloud_sync_manual_started_at";

type CloudSyncActionButtonProps = {
    variant?: "default" | "canvas";
};

export function CloudSyncActionButton({ variant = "default" }: CloudSyncActionButtonProps) {
    const { message } = App.useApp();
    const [syncing, setSyncing] = useState(false);
    const themeName = useThemeStore((state) => state.theme);
    const canvasTheme = canvasThemes[themeName];
    const config = useConfigStore((state) => state.config);
    const cloudSync = useConfigStore((state) => state.cloudSync);
    const updateCloudSyncConfig = useConfigStore((state) => state.updateCloudSyncConfig);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const apiKey = getCloudSyncApiKey(config.mediaApiKey, config.textApiKey);
    const ready = Boolean(apiKey);
    const hasError = Boolean(cloudSync.lastError);
    const enabled = cloudSync.enabled;

    const buttonStyle: CSSProperties | undefined =
        variant === "canvas"
            ? {
                  background: enabled ? "rgba(16,185,129,.14)" : canvasTheme.toolbar.panel,
                  borderColor: hasError ? "rgba(225,29,72,.45)" : enabled ? "rgba(16,185,129,.35)" : canvasTheme.toolbar.border,
                  color: hasError ? "#e11d48" : enabled ? "#047857" : canvasTheme.node.text,
                  boxShadow: "0 10px 30px rgba(28,25,23,.10)",
              }
            : undefined;

    const title = !ready
        ? "填写媒体 API Key 或文本 API Key 后可使用云同步"
        : hasError
          ? `最近失败：${cloudSync.lastError}`
          : enabled
            ? `已开启自动同步。${cloudSync.lastSyncedAt ? `上次同步 ${formatCloudSyncTime(cloudSync.lastSyncedAt)}。` : ""}点击立即同步。`
            : "点击开启云同步并立即同步";

    const syncCloud = async () => {
        if (!apiKey) {
            message.error("请先填写媒体 API Key 或文本 API Key");
            openConfigDialog(false);
            return;
        }
        if (syncing) return;
        setSyncing(true);
        window.localStorage.setItem(CLOUD_SYNC_MANUAL_STARTED_AT_KEY, String(Date.now()));
        if (!enabled) {
            updateCloudSyncConfig("enabled", true);
            updateCloudSyncConfig("lastError", "");
        }
        try {
            const result = await syncAppDataToCloud(apiKey);
            updateCloudSyncConfig("lastSyncedAt", result.syncedAt);
            updateCloudSyncConfig("lastError", "");
            message.success(`云同步完成：${result.projects} 个画布，${result.assets} 个素材，${result.imageLogs + result.videoLogs} 条记录，本次上传 ${result.uploadedFiles} 个文件 ${formatBytes(result.uploadedBytes)}`);
        } catch (error) {
            const messageText = error instanceof Error ? error.message : "RelayBases 云同步失败";
            updateCloudSyncConfig("lastError", messageText);
            message.error(messageText);
        } finally {
            setSyncing(false);
        }
    };

    const Icon = hasError ? AlertCircle : syncing ? RefreshCw : Cloud;

    return (
        <button
            type="button"
            className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium leading-none transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400",
                variant === "canvas"
                    ? "backdrop-blur hover:scale-[1.02]"
                    : hasError
                      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-200 dark:hover:bg-rose-950/55"
                      : enabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200 dark:hover:bg-emerald-950/55"
                        : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800",
                syncing && "cursor-wait opacity-80",
            )}
            style={buttonStyle}
            disabled={syncing}
            onClick={() => void syncCloud()}
            aria-label={enabled ? "立即云同步" : "开启云同步"}
            title={title}
        >
            <Icon className={cn("size-4", syncing && "animate-spin")} />
            <span className="hidden sm:inline">{syncing ? "同步中" : enabled ? "云同步" : "开启同步"}</span>
        </button>
    );
}

function formatCloudSyncTime(value: string) {
    try {
        return new Date(value).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
        return value;
    }
}
