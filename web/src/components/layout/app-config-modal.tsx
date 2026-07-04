"use client";

import { App, Button, Form, Input, Modal, Progress, Segmented, Select, Switch, Tabs } from "antd";
import { Cloud, RefreshCw, Wifi } from "lucide-react";
import { useCallback, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { fetchChannelModels } from "@/services/api/image";
import { getCloudSyncApiKey, hasCloudSyncKey } from "@/services/cloud-sync";
import { syncAppDataToCloud, syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { useI18n } from "@/lib/i18n";
import { requestAndTestWorkbenchNotification } from "@/lib/workbench-preferences";
import {
    encodeChannelModel,
    filterModelsByCapability,
    modelOptionName,
    preferredTextModelOption,
    RELAYBASES_ASYNC_IMAGE_MODELS,
    RELAYBASES_RECOMMENDED_IMAGE_KEY_GROUP,
    RELAYBASES_RECOMMENDED_TEXT_KEY_GROUP,
    RELAYBASES_SYNC_IMAGE_MODELS,
    RELAYBASES_TEXT_BASE_URL,
    RELAYBASES_TEXT_CHANNEL_ID,
    RELAYBASES_VIDEO_MODELS,
    useConfigStore,
    type AiConfig,
    type ModelCapability,
    type ModelChannel,
} from "@/stores/use-config-store";

type ModelGroup = {
    capability: ModelCapability;
    modelKey: "imageModel" | "videoModel" | "textModel" | "audioModel";
    defaultLabel: string;
};

type WebdavDomainProgress = {
    label: string;
    stage: string;
    current?: number;
    total?: number;
    status?: "active" | "success" | "exception";
};

const modelGroups: ModelGroup[] = [
    { capability: "image", modelKey: "imageModel", defaultLabel: "默认生图模型" },
    { capability: "video", modelKey: "videoModel", defaultLabel: "默认视频模型" },
    { capability: "text", modelKey: "textModel", defaultLabel: "默认文本模型" },
];

const webdavDomainKeys: AppSyncDomainKey[] = ["canvas", "assets", "image-workbench", "video-workbench"];
const webdavDomainLabels: Record<AppSyncDomainKey, string> = {
    canvas: "画布",
    assets: "我的素材",
    "image-workbench": "生图工作台",
    "video-workbench": "视频创作台",
};
const CLOUD_SYNC_MANUAL_STARTED_AT_KEY = "infinite-canvas:cloud_sync_manual_started_at";

function createWebdavDomainProgress(): Record<AppSyncDomainKey, WebdavDomainProgress> {
    return webdavDomainKeys.reduce(
        (progress, key) => ({
            ...progress,
            [key]: { label: webdavDomainLabels[key], stage: "等待同步" },
        }),
        {} as Record<AppSyncDomainKey, WebdavDomainProgress>,
    );
}

export function AppConfigModal() {
    const { message } = App.useApp();
    const { language, t } = useI18n();
    const [syncingCloud, setSyncingCloud] = useState(false);
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [loadingTextModels, setLoadingTextModels] = useState(false);
    const [cloudSyncStatus, setCloudSyncStatus] = useState("");
    const [cloudDomainProgress, setCloudDomainProgress] = useState(createWebdavDomainProgress);
    const [webdavSyncStatus, setWebdavSyncStatus] = useState("");
    const [webdavDomainProgress, setWebdavDomainProgress] = useState(createWebdavDomainProgress);
    const config = useConfigStore((state) => state.config);
    const cloudSync = useConfigStore((state) => state.cloudSync);
    const webdav = useConfigStore((state) => state.webdav);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateConfigValues = useConfigStore((state) => state.updateConfigValues);
    const updateCloudSyncConfig = useConfigStore((state) => state.updateCloudSyncConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const setCloudSyncActivity = useConfigStore((state) => state.setCloudSyncActivity);
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configActiveTab = useConfigStore((state) => state.configActiveTab);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const setConfigActiveTab = useConfigStore((state) => state.setConfigActiveTab);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const cloudSyncReady = hasCloudSyncKey(config.mediaApiKey, config.textApiKey);
    const webdavReady = Boolean(webdav.url.trim());

    const closeConfig = () => {
        setConfigDialogOpen(false);
        clearPromptContinue();
    };

    const finishConfig = () => {
        const ready = Boolean(config.mediaApiKey.trim() || (config.textApiKey.trim() && config.textModel.trim()));
        setConfigDialogOpen(false);
        if (!ready) {
            clearPromptContinue();
            return;
        }
        message.success(shouldPromptContinue ? "配置已保存，请继续刚才的请求" : "配置已保存");
        clearPromptContinue();
    };

    const refreshTextModels = async () => {
        const apiKey = config.textApiKey.trim();
        if (!apiKey) {
            message.error("请先填写文本 API Key");
            return;
        }
        setLoadingTextModels(true);
        try {
            const channel: ModelChannel = {
                id: RELAYBASES_TEXT_CHANNEL_ID,
                name: "RelayBases Text",
                baseUrl: RELAYBASES_TEXT_BASE_URL,
                apiKey,
                apiFormat: "openai",
                models: [],
            };
            const models = filterModelsByCapability(await fetchChannelModels(channel), "text");
            if (!models.length) {
                updateConfigValues({ textModels: [], textModel: "" });
                message.warning("未获取到可用的文本模型");
                return;
            }
            const textModels = models.map((model) => encodeChannelModel(RELAYBASES_TEXT_CHANNEL_ID, model));
            const recommendedTextModel = preferredTextModelOption(textModels);
            const textModel = textModels.includes(config.textModel) ? config.textModel : recommendedTextModel;
            updateConfigValues({ textModels, textModel });
            message.success(`已获取 ${models.length} 个文本模型，默认使用 ${modelOptionName(textModel)}。建议文本 Key 使用 ${RELAYBASES_RECOMMENDED_TEXT_KEY_GROUP} 分组。`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取文本模型失败");
        } finally {
            setLoadingTextModels(false);
        }
    };

    const testWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setTestingWebdav(true);
        try {
            await testWebdavConnection(webdav);
            message.success("WebDAV 连接可用");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "WebDAV 连接测试失败");
        } finally {
            setTestingWebdav(false);
        }
    };

    const updateWebdavProgress = (event: AppSyncProgressEvent) => {
        setWebdavSyncStatus(event.stage);
        if (!event.domain) return;
        setWebdavDomainProgress((current) => ({
            ...current,
            [event.domain as AppSyncDomainKey]: {
                label: event.label || webdavDomainLabels[event.domain as AppSyncDomainKey],
                stage: event.stage,
                current: event.current,
                total: event.total,
                status: event.status,
            },
        }));
    };

    const updateCloudProgress = (event: AppSyncProgressEvent) => {
        setCloudSyncStatus(event.stage);
        if (!event.domain) return;
        setCloudDomainProgress((current) => ({
            ...current,
            [event.domain as AppSyncDomainKey]: {
                label: event.label || webdavDomainLabels[event.domain as AppSyncDomainKey],
                stage: event.stage,
                current: event.current,
                total: event.total,
                status: event.status,
            },
        }));
    };

    const syncCloud = useCallback(async () => {
        const apiKey = getCloudSyncApiKey(config.mediaApiKey, config.textApiKey);
        if (!apiKey) {
            message.error("请先填写媒体 API Key 或文本 API Key");
            return;
        }
        if (syncingCloud) return;
        window.localStorage.setItem(CLOUD_SYNC_MANUAL_STARTED_AT_KEY, String(Date.now()));
        setSyncingCloud(true);
        setCloudDomainProgress(createWebdavDomainProgress());
        setCloudSyncStatus("准备云同步");
        updateCloudSyncConfig("enabled", true);
        updateCloudSyncConfig("lastError", "");
        setCloudSyncActivity("manual");
        try {
            const result = await syncAppDataToCloud(apiKey, updateCloudProgress);
            updateCloudSyncConfig("lastSyncedAt", result.syncedAt);
            updateCloudSyncConfig("lastError", "");
            message.success(`云同步完成：${result.projects} 个画布，${result.assets} 个素材，${result.imageLogs + result.videoLogs} 条记录，本次上传 ${result.uploadedFiles} 个文件 ${formatBytes(result.uploadedBytes)}`);
        } catch (error) {
            const messageText = error instanceof Error ? error.message : "RelayBases 云同步失败";
            setCloudSyncStatus(messageText);
            updateCloudSyncConfig("lastError", messageText);
            message.error(messageText);
        } finally {
            setSyncingCloud(false);
            if (useConfigStore.getState().cloudSyncActivity === "manual") setCloudSyncActivity("idle");
        }
    }, [config.mediaApiKey, config.textApiKey, message, setCloudSyncActivity, syncingCloud, updateCloudSyncConfig]);

    const syncWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setSyncingWebdav(true);
        setWebdavDomainProgress(createWebdavDomainProgress());
        setWebdavSyncStatus("准备同步");
        try {
            const result = await syncAppDataToWebdav(webdav, updateWebdavProgress);
            updateWebdavConfig("lastSyncedAt", result.syncedAt);
            message.success(`同步完成：${result.projects} 个画布，${result.assets} 个素材，${result.imageLogs + result.videoLogs} 条记录，本次上传 ${result.uploadedFiles} 个文件 ${formatBytes(result.uploadedBytes)}`);
        } catch (error) {
            setWebdavSyncStatus(error instanceof Error ? error.message : "WebDAV 同步失败");
            message.error(error instanceof Error ? error.message : "WebDAV 同步失败");
        } finally {
            setSyncingWebdav(false);
        }
    };

    return (
        <Modal
            title={
                <div>
                    <div className="text-lg font-semibold">配置与用户偏好</div>
                    <div className="mt-1 text-xs font-normal text-stone-500">媒体 API Key、文本 API Key、推荐分组和默认模型</div>
                </div>
            }
            open={isConfigOpen}
            width={980}
            centered
            onCancel={closeConfig}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={
                <Button type="primary" onClick={finishConfig}>
                    完成
                </Button>
            }
        >
            <Tabs
                activeKey={configActiveTab}
                onChange={setConfigActiveTab}
                items={[
                    {
                        key: "channels",
                        label: "RelayBases",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid content-start gap-3">
                                        <div className="rounded-lg border border-stone-200 p-3 text-sm dark:border-stone-800">
                                            <Form.Item label="媒体 API Key" extra={`用于图片和视频生成。请在主站选择 ${RELAYBASES_RECOMMENDED_IMAGE_KEY_GROUP} 分组创建媒体 Key；异步图片和异步视频任务按 4 倍扣费。`} className="mb-3">
                                                <Input.Password value={config.mediaApiKey} allowClear autoComplete="new-password" onChange={(event) => updateConfig("mediaApiKey", event.target.value)} placeholder="sk-..." />
                                            </Form.Item>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-100">生图使用 media 分组</span>
                                                <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">同步图默认 gpt-image-2</span>
                                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">异步任务·4倍扣费</span>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-stone-200 p-3 text-sm dark:border-stone-800">
                                            <div className="font-semibold">同步图片模型</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {RELAYBASES_SYNC_IMAGE_MODELS.map((model) => (
                                                    <span key={model} className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs dark:bg-stone-900">
                                                        {model}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-200">异步图片任务</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {RELAYBASES_ASYNC_IMAGE_MODELS.map((model) => (
                                                    <span key={model} className="rounded-md bg-amber-50 px-2 py-1 font-mono text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                                                        {model}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-stone-200 p-3 text-sm dark:border-stone-800">
                                            <div className="font-semibold">视频模型</div>
                                            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">默认同步调用；用户也可以切换为异步任务，异步按 4 倍扣费。</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {RELAYBASES_VIDEO_MODELS.map((model) => (
                                                    <span key={model} className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs dark:bg-stone-900">
                                                        {model}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid content-start gap-3">
                                        <div className="rounded-lg border border-stone-200 p-3 text-sm dark:border-stone-800">
                                            <Form.Item label="文本 API Key" extra={`用于 Agent、图片反推提示词和文本生成。建议用 ${RELAYBASES_RECOMMENDED_TEXT_KEY_GROUP} 分组创建文本 Key，其它文本分组也可用。`} className="mb-3">
                                                <div className="flex gap-2">
                                                    <Input.Password className="min-w-0 flex-1" value={config.textApiKey} allowClear autoComplete="new-password" onChange={(event) => updateConfigValues({ textApiKey: event.target.value, textModels: [], textModel: "" })} placeholder="sk-..." />
                                                    <Button icon={<RefreshCw className="size-4" />} disabled={!config.textApiKey.trim()} loading={loadingTextModels} onClick={() => void refreshTextModels()}>
                                                        获取模型
                                                    </Button>
                                                </div>
                                            </Form.Item>
                                            <div className="mb-3 flex flex-wrap gap-2 text-xs">
                                                <span className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-blue-800 dark:border-blue-700/60 dark:bg-blue-950/30 dark:text-blue-100">推荐 codex-pro 分组</span>
                                                <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">其它文本分组可用</span>
                                            </div>
                                            <div className="text-xs text-stone-500">
                                                {config.textModels.length
                                                    ? `已获取 ${config.textModels.length} 个文本模型，默认 ${modelOptionName(config.textModel)}`
                                                    : "填写文本 API Key 后获取模型；若返回列表包含 gpt-5.5，会优先使用 gpt-5.5，否则使用返回列表第一个。"}
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-stone-200 p-3 text-sm dark:border-stone-800">
                                            <Form.Item label="默认文本模型" className="mb-3">
                                                <ModelPicker config={config} value={config.textModel} onChange={(model) => updateConfig("textModel", model)} capability="text" fullWidth />
                                            </Form.Item>
                                            <div className="font-semibold">文本模型</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {config.textModels.length ? (
                                                    config.textModels.map((model) => (
                                                        <span key={model} className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs dark:bg-stone-900">
                                                            {modelOptionName(model)}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-stone-500">暂无文本模型</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "models",
                        label: "模型",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="text-sm font-semibold">默认模型</div>
                                    <div className="mt-1 text-xs leading-5 text-stone-500">生图默认使用同步接口；视频默认同步调用，按需可切换异步·4倍扣费；文本模型用于 Agent 和文本节点。</div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    {modelGroups.map((group) => (
                                        <Form.Item key={group.modelKey} label={group.defaultLabel} className="mb-0">
                                            <ModelPicker config={config} value={config[group.modelKey]} onChange={(model) => updateConfig(group.modelKey, model)} capability={group.capability} fullWidth />
                                        </Form.Item>
                                    ))}
                                </div>
                                <Form.Item label="默认视频调用方式" className="mt-4 mb-0">
                                    <Segmented
                                        value={config.videoCallMode}
                                        onChange={(value) => updateConfig("videoCallMode", value as AiConfig["videoCallMode"])}
                                        options={[
                                            { label: "同步", value: "sync" },
                                            { label: "异步·4倍扣费", value: "async" },
                                        ]}
                                    />
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: "preferences",
                        label: "生成偏好",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Form.Item label="任务提交方式" extra="选择 Ctrl + Enter 时，Enter 换行；选择 Enter 时，Shift + Enter 换行。" className="mb-4">
                                        <Select
                                            value={config.submitTaskShortcut}
                                            options={[
                                                { label: "Ctrl + Enter", value: "ctrlEnter" },
                                                { label: "Enter", value: "enter" },
                                            ]}
                                            onChange={(value) => updateConfig("submitTaskShortcut", value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="画布默认生图张数" extra="新建画布生图和配置节点默认使用，单个节点仍可单独覆盖。" className="mb-4">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={15}
                                            value={config.canvasImageCount}
                                            onChange={(event) => updateConfig("canvasImageCount", event.target.value)}
                                            onBlur={(event) => updateConfig("canvasImageCount", normalizeImageCount(event.target.value))}
                                        />
                                    </Form.Item>
                                    <Form.Item label="默认音频声音" className="mb-4">
                                        <Select value={config.audioVoice} options={audioVoiceOptions} onChange={(value) => updateConfig("audioVoice", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频格式" className="mb-4">
                                        <Select value={config.audioFormat} options={audioFormatOptions} onChange={(value) => updateConfig("audioFormat", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频语速" className="mb-4">
                                        <Input
                                            type="number"
                                            min={0.25}
                                            max={4}
                                            step={0.05}
                                            value={config.audioSpeed}
                                            onChange={(event) => updateConfig("audioSpeed", event.target.value)}
                                            onBlur={(event) => updateConfig("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                                        />
                                    </Form.Item>
                                    <Form.Item label="生图提交后清空输入" extra="开启后，生图任务成功创建时清空提示词和参考图；配置缺失或提交失败时不会清空。" className="mb-4">
                                        <Switch checked={config.clearImageInputsAfterSubmit === "true"} checkedChildren="开启" unCheckedChildren="关闭" onChange={(checked) => updateConfig("clearImageInputsAfterSubmit", checked ? "true" : "false")} />
                                    </Form.Item>
                                    <Form.Item label="视频提交后清空输入" extra="开启后，视频任务成功创建时清空提示词和参考素材；配置缺失或提交失败时不会清空。" className="mb-4">
                                        <Switch checked={config.clearVideoInputsAfterSubmit === "true"} checkedChildren="开启" unCheckedChildren="关闭" onChange={(checked) => updateConfig("clearVideoInputsAfterSubmit", checked ? "true" : "false")} />
                                    </Form.Item>
                                    <Form.Item label="任务完成后系统通知" extra="开启后，生图或视频任务完成、失败时发送浏览器系统通知。" className="mb-4">
                                        <Switch
                                            checked={config.notifyOnGenerationComplete === "true"}
                                            checkedChildren="开启"
                                            unCheckedChildren="关闭"
                                            onChange={(checked) => {
                                                updateConfig("notifyOnGenerationComplete", checked ? "true" : "false");
                                                if (!checked) return;
                                                void requestAndTestWorkbenchNotification().then(({ permission, status }) => {
                                                    if (permission === "granted" && status === "sent") message.success("通知已开启，并已发送测试通知");
                                                    if (status === "failed") message.warning("通知权限已开启，但浏览器发送测试通知失败");
                                                    if (permission === "denied") message.warning("浏览器通知权限已被拒绝，可在浏览器站点权限中重新开启");
                                                    if (permission === "unsupported") message.warning("当前浏览器不支持系统通知");
                                                });
                                            }}
                                        />
                                    </Form.Item>
                                    <Form.Item label="启动时恢复输入" extra="开启后，重新打开生图或视频工作台时恢复上次提示词和参考素材。" className="mb-4">
                                        <Switch checked={config.restoreWorkbenchDraftOnStart === "true"} checkedChildren="开启" unCheckedChildren="关闭" onChange={(checked) => updateConfig("restoreWorkbenchDraftOnStart", checked ? "true" : "false")} />
                                    </Form.Item>
                                    <Form.Item label="结果编辑方式" extra="控制生成结果加入参考素材时，是追加、替换，还是每次询问。" className="mb-4">
                                        <Select
                                            value={config.referenceEditMode}
                                            options={[
                                                { label: "追加素材", value: "append" },
                                                { label: "替换素材", value: "replace" },
                                                { label: "每次询问", value: "ask" },
                                            ]}
                                            onChange={(value) => updateConfig("referenceEditMode", value)}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item label="默认音频指令" className="mb-4">
                                    <Input.TextArea rows={2} value={config.audioInstructions} placeholder="例如：自然、温暖、适合旁白。" onChange={(event) => updateConfig("audioInstructions", event.target.value)} />
                                </Form.Item>
                                <Form.Item label="系统提示词" className="mb-0">
                                    <Input.TextArea rows={4} value={config.systemPrompt} placeholder="例如：你是一位擅长电影感写实摄影的视觉导演。" onChange={(event) => updateConfig("systemPrompt", event.target.value)} />
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: "sync",
                        label: "同步",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Cloud className="size-4" />
                                                RelayBases 云同步
                                            </div>
                                            <div className="mt-1 text-xs leading-5 text-stone-500">同步画布、我的素材、生成记录和本地媒体文件，不同步 API Key。开启后会在页面打开后自动同步，并每 5 分钟同步一次；顶部按钮可随时手动同步。</div>
                                        </div>
                                        <Switch
                                            checked={cloudSync.enabled}
                                            checkedChildren="已开启"
                                            unCheckedChildren="未开启"
                                            onChange={(checked) => {
                                                if (checked && !cloudSyncReady) {
                                                    message.error("请先填写媒体 API Key 或文本 API Key");
                                                    return;
                                                }
                                                updateCloudSyncConfig("enabled", checked);
                                                updateCloudSyncConfig("lastError", "");
                                            }}
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                                        <span>{cloudSync.lastSyncedAt ? `${t("上次同步")} ${formatWebdavTime(cloudSync.lastSyncedAt, language)}` : t("尚未同步")}</span>
                                        {cloudSync.lastError ? <span className="text-red-600 dark:text-red-300">{language === "en" ? `Last failure: ${cloudSync.lastError}` : `最近失败：${cloudSync.lastError}`}</span> : null}
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!cloudSyncReady} loading={syncingCloud} onClick={() => void syncCloud()}>
                                            {syncingCloud ? "云同步中" : "立即云同步"}
                                        </Button>
                                        {cloudSyncStatus ? <span className="text-xs text-stone-500">{cloudSyncStatus}</span> : null}
                                    </div>
                                    {syncingCloud || cloudSyncStatus ? <WebdavProgressGrid progress={cloudDomainProgress} /> : null}
                                </section>
                                <details className="mt-4 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <summary className="cursor-pointer text-sm font-semibold text-stone-700 dark:text-stone-200">高级同步：WebDAV</summary>
                                    <section className="mt-4">
                                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 text-sm font-semibold">
                                                    <Cloud className="size-4" />
                                                    WebDAV 同步
                                                </div>
                                                <div className="mt-1 text-xs text-stone-500">适合已有 NAS 或自定义存储的用户。同步内容不包含 AI API Key；服务不支持 CORS 时可使用 Next.js 转发。</div>
                                            </div>
                                            <div className="text-xs text-stone-500">{webdav.lastSyncedAt ? `${t("上次同步")} ${formatWebdavTime(webdav.lastSyncedAt, language)}` : t("尚未同步")}</div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <Form.Item label="连接方式" className="mb-4 md:col-span-2">
                                                <Segmented
                                                    block
                                                    value={webdav.proxyMode}
                                                    onChange={(value) => updateWebdavConfig("proxyMode", value as typeof webdav.proxyMode)}
                                                    options={[
                                                        { label: "前端直连", value: "direct" },
                                                        { label: "Next.js 转发", value: "nextjs" },
                                                    ]}
                                                />
                                            </Form.Item>
                                            <Form.Item label="WebDAV 地址" className="mb-4">
                                                <Input value={webdav.url} placeholder="https://nas.example.com/webdav" onChange={(event) => updateWebdavConfig("url", event.target.value)} />
                                            </Form.Item>
                                            <Form.Item label="远程目录" extra={`会在该目录下分业务目录保存，每个目录包含 ${WEBDAV_MANIFEST_FILE_NAME} 和 files/`} className="mb-4">
                                                <Input value={webdav.directory} placeholder="infinite-canvas" onChange={(event) => updateWebdavConfig("directory", event.target.value)} />
                                            </Form.Item>
                                            <Form.Item label="用户名" className="mb-0">
                                                <Input value={webdav.username} autoComplete="username" onChange={(event) => updateWebdavConfig("username", event.target.value)} />
                                            </Form.Item>
                                            <Form.Item label="密码 / 应用密码" className="mb-0">
                                                <Input.Password value={webdav.password} autoComplete="current-password" onChange={(event) => updateWebdavConfig("password", event.target.value)} />
                                            </Form.Item>
                                        </div>
                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <Button icon={<Wifi className="size-4" />} disabled={!webdavReady || syncingWebdav} loading={testingWebdav} onClick={() => void testWebdav()}>
                                                测试连接
                                            </Button>
                                            <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!webdavReady || testingWebdav} loading={syncingWebdav} onClick={() => void syncWebdav()}>
                                                {syncingWebdav ? "同步中" : "立即同步"}
                                            </Button>
                                            {webdavSyncStatus ? <span className="text-xs text-stone-500">{webdavSyncStatus}</span> : null}
                                        </div>
                                        {syncingWebdav || webdavSyncStatus ? <WebdavProgressGrid progress={webdavDomainProgress} /> : null}
                                    </section>
                                </details>
                            </Form>
                        ),
                    },
                ]}
            />
        </Modal>
    );
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || 3))));
}

function formatWebdavTime(value: string, language: "zh" | "en" = "zh") {
    return new Date(value).toLocaleString(language === "en" ? "en-US" : "zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WebdavProgressGrid({ progress }: { progress: Record<AppSyncDomainKey, WebdavDomainProgress> }) {
    const { t } = useI18n();
    return (
        <div className="mt-3 grid gap-2">
            {webdavDomainKeys.map((key) => {
                const item = progress[key];
                const count = item.total ? `${item.current || 0}/${item.total}` : "";
                return (
                    <div key={key} className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                        <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-xs">
                            <span className="shrink-0 font-medium text-stone-700 dark:text-stone-200">{item.label}</span>
                            <span className="min-w-0 truncate text-right text-stone-500">
                                {translateProgressStage(item.stage, t)}
                                {count ? ` · ${count}` : ""}
                            </span>
                        </div>
                        <Progress percent={getWebdavProgressPercent(item)} size="small" status={getWebdavProgressStatus(item)} showInfo={false} />
                    </div>
                );
            })}
        </div>
    );
}

function translateProgressStage(stage: string, t: (value: string) => string) {
    if (stage.startsWith("上传清单")) return stage.replace("上传清单", t("上传清单"));
    if (stage.startsWith("上传媒体")) return stage.replace("上传媒体", t("上传媒体"));
    return t(stage);
}

function getWebdavProgressPercent(item: WebdavDomainProgress) {
    if (item.status === "success") return 100;
    if (item.total) return Math.min(100, Math.round(((item.current || 0) / item.total) * 100));
    if (item.status === "exception") return 100;
    if (item.stage === "等待同步") return 0;
    if (item.stage === "读取远端清单") return 12;
    if (item.stage === "读取本地数据") return 24;
    if (item.stage === "下载缺失媒体") return 36;
    if (item.stage === "写入本地合并结果") return 58;
    if (item.stage === "上传新增媒体") return 66;
    if (item.stage === "媒体已齐全" || item.stage === "媒体无需上传") return 74;
    if (item.stage.startsWith("上传清单")) return 90;
    return item.status === "active" ? 30 : 0;
}

function getWebdavProgressStatus(item: WebdavDomainProgress): "normal" | "active" | "success" | "exception" {
    if (item.status === "success" || item.status === "exception") return item.status;
    return item.status === "active" ? "active" : "normal";
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
