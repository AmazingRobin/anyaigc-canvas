"use client";

import { App } from "antd";
import { AlertCircle, Cloud, RefreshCw } from "lucide-react";
import type { CSSProperties } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { cn } from "@/lib/utils";
import { getCloudSyncApiKey } from "@/services/cloud-sync";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

type CloudSyncActionButtonProps = {
    variant?: "default" | "canvas";
};

export function CloudSyncActionButton({ variant = "default" }: CloudSyncActionButtonProps) {
    const { message } = App.useApp();
    const themeName = useThemeStore((state) => state.theme);
    const canvasTheme = canvasThemes[themeName];
    const config = useConfigStore((state) => state.config);
    const cloudSync = useConfigStore((state) => state.cloudSync);
    const cloudSyncActivity = useConfigStore((state) => state.cloudSyncActivity);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const apiKey = getCloudSyncApiKey(config.mediaApiKey, config.textApiKey);
    const ready = Boolean(apiKey);
    const hasError = Boolean(cloudSync.lastError);
    const enabled = cloudSync.enabled;
    const syncing = cloudSyncActivity !== "idle";

    const buttonStyle: CSSProperties | undefined =
        variant === "canvas"
            ? {
                  background: enabled ? "rgba(16,185,129,.14)" : canvasTheme.toolbar.panel,
                  borderColor: hasError ? "rgba(225,29,72,.45)" : enabled ? "rgba(16,185,129,.35)" : canvasTheme.toolbar.border,
                  color: hasError ? "#e11d48" : enabled ? "#047857" : canvasTheme.node.text,
                  boxShadow: "0 10px 30px rgba(28,25,23,.10)",
              }
            : undefined;

    const title = syncing
        ? cloudSyncActivity === "auto"
            ? "自动云同步正在后台运行"
            : "云同步正在运行"
        : !ready
        ? "填写媒体 API Key 或文本 API Key 后可使用云同步"
        : hasError
          ? `最近失败：${cloudSync.lastError}`
          : enabled
            ? `已开启自动同步。${cloudSync.lastSyncedAt ? `上次同步 ${formatCloudSyncTime(cloudSync.lastSyncedAt)}。` : ""}点击打开同步进度。`
            : "点击开启云同步并查看进度";

    const openSyncPanel = () => {
        if (!ready) {
            message.error("请先填写媒体 API Key 或文本 API Key");
            openConfigDialog(false, "channels");
            return;
        }
        openConfigDialog(false, "sync");
    };

    const Icon = syncing ? RefreshCw : hasError ? AlertCircle : Cloud;

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
            )}
            style={buttonStyle}
            onClick={openSyncPanel}
            aria-label={syncing ? "云同步正在运行" : enabled ? "打开云同步进度" : "开启云同步"}
            title={title}
        >
            <Icon className={cn("size-4", syncing && "animate-spin")} />
            <span className="hidden sm:inline">{syncing ? (cloudSyncActivity === "auto" ? "自动同步中" : "同步中") : enabled ? "云同步" : "开启同步"}</span>
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
