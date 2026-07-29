"use client";

import { App, Button, Form, Input, Modal, Select, Tabs } from "antd";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { fetchChannelModels, ModelDiscoveryError } from "@/services/api/image";
import { syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import { sharedErrorText, sharedText } from "@/lib/i18n-shared";
import {
    ANYAIGC_BASE_URL,
    ANYAIGC_MEDIA_CHANNEL_ID,
    ANYAIGC_TEXT_CHANNEL_ID,
    replaceChannelModels,
    useConfigStore,
    type ModelChannel,
} from "@/stores/use-config-store";
import { filterMediaModels } from "@/lib/anyaigc-media-models";
import { useLanguageStore, type LanguageName } from "@/stores/use-language-store";

const webdavDomainKeys: AppSyncDomainKey[] = ["canvas", "assets", "image-workbench", "video-workbench"];
const webdavDomainLabels: Record<AppSyncDomainKey, string> = { canvas: "画布", assets: "我的素材", "image-workbench": "生图工作台", "video-workbench": "视频创作台" };

export function AppConfigModal() {
    const { message } = App.useApp();
    const language = useLanguageStore((state) => state.language);
    const t = useCallback((zh: string, en: string) => sharedText(zh, en, language), [language]);
    const config = useConfigStore((state) => state.config);
    const webdav = useConfigStore((state) => state.webdav);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configActiveTab = useConfigStore((state) => state.configActiveTab);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const setConfigActiveTab = useConfigStore((state) => state.setConfigActiveTab);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [loadingText, setLoadingText] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [webdavStatus, setWebdavStatus] = useState("");
    const mediaRequest = useRef<AbortController | null>(null);
    const textRequest = useRef<AbortController | null>(null);

    useEffect(() => () => {
        mediaRequest.current?.abort();
        textRequest.current?.abort();
    }, []);

    const close = () => {
        setConfigDialogOpen(false);
        clearPromptContinue();
    };

    const replaceModels = (channelId: string, models: string[]) => updateConfig("channels", replaceChannelModels(useConfigStore.getState().config.channels, channelId, models));

    const refreshModels = async (kind: "media" | "text") => {
        const apiKey = (kind === "media" ? config.mediaApiKey : config.textApiKey).trim();
        if (!apiKey) {
            message.error(t(kind === "media" ? "请先填写媒体 API Key" : "请先填写文本 API Key", kind === "media" ? "Enter a media API key first" : "Enter a text API key first"));
            return;
        }
        const requestRef = kind === "media" ? mediaRequest : textRequest;
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        kind === "media" ? setLoadingMedia(true) : setLoadingText(true);
        const channelId = kind === "media" ? ANYAIGC_MEDIA_CHANNEL_ID : ANYAIGC_TEXT_CHANNEL_ID;
        try {
            const channel: ModelChannel = { id: channelId, name: kind === "media" ? "AnyAIGC Media" : "AnyAIGC Text", baseUrl: ANYAIGC_BASE_URL, apiKey, apiFormat: "openai", models: [] };
            const discovered = await fetchChannelModels(channel, { signal: controller.signal });
            if (controller.signal.aborted) return;
            const models = kind === "media" ? filterMediaModels(discovered.map((model) => model.id)) : discovered.map((model) => model.id);
            replaceModels(channelId, models);
            if (!models.length) message.warning(t(kind === "media" ? "此 Key 没有返回 Canvas 支持的媒体模型" : "此 Key 没有返回可用的文本或音频模型", kind === "media" ? "This key returned no media models supported by Canvas" : "This key returned no usable text or audio models"));
            else message.success(modelLoadedText(models.length, language));
        } catch (error) {
            if (controller.signal.aborted) return;
            if (error instanceof ModelDiscoveryError && error.clearModels) replaceModels(channelId, []);
            message.error(error instanceof Error ? sharedErrorText(error.message, language) : t("读取模型失败", "Failed to load models"));
        } finally {
            if (requestRef.current === controller) requestRef.current = null;
            kind === "media" ? setLoadingMedia(false) : setLoadingText(false);
        }
    };

    const syncWebdav = async (testOnly = false) => {
        if (!webdav.url.trim()) {
            message.error(t("请先填写 WebDAV 地址", "Enter a WebDAV URL first"));
            return;
        }
        testOnly ? setTestingWebdav(true) : setSyncingWebdav(true);
        try {
            if (testOnly) {
                await testWebdavConnection(webdav);
                message.success(t("WebDAV 连接成功", "WebDAV connection succeeded"));
                return;
            }
            const result = await syncAppDataToWebdav(webdav, (event: AppSyncProgressEvent) => setWebdavStatus(event.stage));
            updateWebdavConfig("lastSyncedAt", result.syncedAt);
            message.success(t("WebDAV 同步完成", "WebDAV sync completed"));
        } catch (error) {
            message.error(error instanceof Error ? sharedErrorText(error.message, language) : t("WebDAV 操作失败", "WebDAV operation failed"));
        } finally {
            testOnly ? setTestingWebdav(false) : setSyncingWebdav(false);
        }
    };

    return (
        <Modal open={isConfigOpen} title={t("设置", "Settings")} onCancel={close} footer={<Button type="primary" onClick={close}>{t("完成", "Done")}</Button>} width={700} destroyOnHidden>
            <Tabs activeKey={configActiveTab} onChange={setConfigActiveTab} items={[
                {
                    key: "channels",
                    label: t("API 配置", "API settings"),
                    children: <div className="space-y-5 pt-2">
                        <p className="text-sm text-stone-500 dark:text-stone-400">{t("API Key 仅保存在当前浏览器，并由前端直接请求 AnyAIGC 接口。两个 Key 都建议在控制台选择“智能自动”分组。", "API keys stay in this browser and are sent directly to AnyAIGC. Choose the Smart Auto group for both keys.")}</p>
                        <KeySection label={t("媒体 API Key", "Media API Key")} value={config.mediaApiKey} onChange={(value) => updateConfig("mediaApiKey", value)} loading={loadingMedia} onRefresh={() => void refreshModels("media")} models={config.imageModels.length + config.videoModels.length} hint={t("推荐分组：智能自动", "Recommended group: Smart Auto")} language={language} />
                        <p className="-mt-3 text-xs text-stone-500 dark:text-stone-400">{t("智能自动分组可能不返回 Gemini 图片模型。使用 Nano Banana 2 / Pro 前，请创建已设置 Gemini 支持的分组 Key（比如：特价banana），再点击“获取模型”。", "The Smart Auto group may not return Gemini image models. Before using Nano Banana 2 / Pro, create a key in a group with Gemini enabled (for example, Special Banana), then click Load models.")}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            <ModelPicker config={config} value={config.imageModel} capability="image" onChange={(value) => updateConfig("imageModel", value)} fullWidth placeholder={t("默认生图模型", "Default image model")} />
                            <ModelPicker config={config} value={config.videoModel} capability="video" onChange={(value) => updateConfig("videoModel", value)} fullWidth placeholder={t("默认视频模型", "Default video model")} />
                        </div>
                        <KeySection label={t("文本 API Key", "Text API Key")} value={config.textApiKey} onChange={(value) => updateConfig("textApiKey", value)} loading={loadingText} onRefresh={() => void refreshModels("text")} models={config.textModels.length + config.audioModels.length} hint={t("推荐分组：智能自动", "Recommended group: Smart Auto")} language={language} />
                        <div className="grid gap-3 md:grid-cols-2">
                            <ModelPicker config={config} value={config.textModel} capability="text" onChange={(value) => updateConfig("textModel", value)} fullWidth placeholder={t("默认文本模型", "Default text model")} />
                            <ModelPicker config={config} value={config.audioModel} capability="audio" onChange={(value) => updateConfig("audioModel", value)} fullWidth placeholder={t("默认音频模型", "Default audio model")} />
                        </div>
                    </div>,
                },
                {
                    key: "webdav",
                    label: "WebDAV",
                    children: <div className="space-y-4 pt-2">
                        <p className="text-sm text-stone-500 dark:text-stone-400">{t("画布、素材和生成记录默认保存在浏览器本地。可使用自己的 WebDAV 服务备份或在设备间同步。", "Canvases, assets, and history are stored locally in your browser. Use your own WebDAV service for backup or device-to-device sync.")}</p>
                        <Form layout="vertical">
                            <Form.Item label="WebDAV URL"><Input value={webdav.url} onChange={(event) => updateWebdavConfig("url", event.target.value)} placeholder="https://dav.example.com/remote.php/dav/files/name" /></Form.Item>
                            <div className="grid gap-3 md:grid-cols-2"><Form.Item label={t("用户名", "Username")}><Input value={webdav.username} onChange={(event) => updateWebdavConfig("username", event.target.value)} /></Form.Item><Form.Item label={t("密码或应用密码", "Password or app password")}><Input.Password value={webdav.password} onChange={(event) => updateWebdavConfig("password", event.target.value)} /></Form.Item></div>
                            <Form.Item label={t("远端目录", "Remote directory")} extra={manifestLabel(WEBDAV_MANIFEST_FILE_NAME, language)}><Input value={webdav.directory} onChange={(event) => updateWebdavConfig("directory", event.target.value)} /></Form.Item>
                        </Form>
                        <div className="flex flex-wrap gap-2"><Button loading={testingWebdav} onClick={() => void syncWebdav(true)}>{t("测试连接", "Test connection")}</Button><Button type="primary" icon={<RefreshCw className="size-4" />} loading={syncingWebdav} onClick={() => void syncWebdav()}>{t("立即同步", "Sync now")}</Button></div>
                        {webdavStatus ? <p className="text-xs text-stone-500">{sharedErrorText(webdavStatus, language)}</p> : null}
                    </div>,
                },
            ]} />
        </Modal>
    );
}

function KeySection({ label, value, onChange, loading, onRefresh, models, hint, language }: { label: string; value: string; onChange: (value: string) => void; loading: boolean; onRefresh: () => void; models: number; hint: string; language: LanguageName }) {
    return <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700"><div className="mb-2 flex items-center justify-between gap-3"><span className="font-medium">{label}</span><span className="text-xs text-stone-500">{hint}</span></div><div className="flex gap-2"><Input.Password value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" placeholder="sk-..." /><Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={onRefresh}>{sharedText("获取模型", "Load models", language)}</Button></div><p className="mt-2 text-xs text-stone-500">{models ? `${models} models` : ""}</p></div>;
}

function modelLoadedText(count: number, language: LanguageName) {
    return language === "en" ? `Loaded ${count} models` : `已加载 ${count} 个模型`;
}

function manifestLabel(fileName: string, language: LanguageName) {
    return language === "en" ? `Manifest file: ${fileName}` : `清单文件：${fileName}`;
}
