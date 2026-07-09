"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { App } from "antd";

import { useConfigStore } from "@/stores/use-config-store";
import { normalizeLanguage, useLanguageStore } from "@/stores/use-language-store";
import { useThemeStore } from "@/stores/use-theme-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const handledConfigParams = useRef(false);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const setLanguage = useLanguageStore((state) => state.setLanguage);
    const setTheme = useThemeStore((state) => state.setTheme);

    useEffect(() => {
        if (handledConfigParams.current) return;
        const searchParams = new URLSearchParams(window.location.search);
        const theme = searchParams.get("theme");
        if (theme === "light" || theme === "dark") setTheme(theme);
        const language = normalizeLanguage(searchParams.get("lang") || searchParams.get("language") || searchParams.get("locale"));
        if (language) setLanguage(language);
        const hasBaseUrlParam = searchParams.has("baseUrl") || searchParams.has("baseurl");
        const mediaApiKey = searchParams.get("mediaApiKey") || searchParams.get("mediaapikey") || searchParams.get("apiKey") || searchParams.get("apikey");
        const textApiKey = searchParams.get("textApiKey") || searchParams.get("textapikey");
        if (!hasBaseUrlParam && !mediaApiKey && !textApiKey) return;
        handledConfigParams.current = true;
        searchParams.delete("baseUrl");
        searchParams.delete("baseurl");
        searchParams.delete("apiKey");
        searchParams.delete("apikey");
        searchParams.delete("mediaApiKey");
        searchParams.delete("mediaapikey");
        searchParams.delete("textApiKey");
        searchParams.delete("textapikey");
        window.history.replaceState(null, "", `${window.location.pathname}${searchParams.size ? `?${searchParams}` : ""}${window.location.hash}`);
        if (mediaApiKey) updateConfig("mediaApiKey", mediaApiKey);
        if (textApiKey) updateConfig("textApiKey", textApiKey);
        openConfigDialog(false);
        message.success(mediaApiKey || textApiKey ? "已导入 RelayBases API Key" : "已忽略不支持的链接参数");
    }, [message, openConfigDialog, setLanguage, setTheme, updateConfig]);

    return <>{children}</>;
}
