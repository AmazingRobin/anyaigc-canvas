"use client";

import { type ReactNode } from "react";

import { ImageSettingsTheme, mutedBorderColor, mutedOptionStyle } from "@/components/image-settings-panel";
import { canvasText } from "@/lib/i18n-canvas";
import { isKling3TurboVideoModel, isMiniMaxHailuoVideoModel, mediaModelCapability, normalizeAspectRatio, normalizeKling3TurboResolution, normalizeVideoDurationForModel, normalizeVideoOperation, videoDurationOptions } from "@/lib/anyaigc-media-models";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { useLanguageStore } from "@/stores/use-language-store";
import { modelOptionName, type AiConfig } from "@/stores/use-config-store";

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoCallMode" | "videoOperation", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

const ratios = ["16:9", "9:16", "1:1"];

export function VideoSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5" }: VideoSettingsPanelProps) {
    const language = useLanguageStore((state) => state.language);
    const model = modelOptionName(config.videoModel || config.model);
    const capability = mediaModelCapability(model);
    const operation = normalizeVideoOperation(model, config.videoOperation);
    const ratio = normalizeAspectRatio(config.size);
    const turbo = isKling3TurboVideoModel(model);
    const seconds = normalizeVideoDurationForModel(model, config.videoSeconds);
    const durations = videoDurationOptions(model);
    const motionControl = operation === "motion-control";
    const hailuo = isMiniMaxHailuoVideoModel(model);

    return <ImageSettingsTheme theme={theme}><div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
        {showTitle ? <div className="text-lg font-semibold">{canvasText("视频设置", "Video settings", language)}</div> : null}
        {capability?.kind === "video" ? <SettingGroup title={canvasText("生成方式", "Generation mode", language)} color={theme.node.muted}>{hailuo ? <div className="grid grid-cols-3 gap-2">{capability.operations.map((value) => <Option key={value} selected={operation === value} theme={theme} onClick={() => onConfigChange("videoOperation", value)}>{operationLabel(value, language)}</Option>)}</div> : <div className="rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: mutedBorderColor(theme) }}>{operationLabel(operation, language)}</div>}</SettingGroup> : null}
        {motionControl ? <div className="rounded-xl border px-3 py-2.5 text-sm leading-6" style={{ borderColor: mutedBorderColor(theme), color: theme.node.muted }}>{canvasText("需要 1 张人物参考图和 1 个动作参考视频。", "Requires one person image and one motion-reference video.", language)}</div> : <>
            {turbo ? <SettingGroup title={canvasText("分辨率", "Resolution", language)} color={theme.node.muted}><div className="grid grid-cols-2 gap-2">{["720p", "1080p"].map((value) => <Option key={value} selected={normalizeKling3TurboResolution(config.vquality) === value} theme={theme} onClick={() => onConfigChange("vquality", value)}>{value}</Option>)}</div></SettingGroup> : null}
            <SettingGroup title={canvasText("画面比例", "Aspect ratio", language)} color={theme.node.muted}><div className="grid grid-cols-3 gap-2">{ratios.map((value) => <Option key={value} selected={ratio === value} theme={theme} onClick={() => onConfigChange("size", value)}>{value}</Option>)}</div></SettingGroup>
            <SettingGroup title={canvasText("视频时长", "Duration", language)} color={theme.node.muted}><div className="grid grid-cols-4 gap-2">{durations.map((value) => <Option key={value} selected={seconds === value} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>{value}s</Option>)}</div></SettingGroup>
        </>}
        <p className="text-xs leading-5" style={{ color: theme.node.muted }}>{canvasText("视频任务以异步方式创建；不会自动切换到其他模型。", "Video tasks are created asynchronously; Canvas never switches to another model automatically.", language)}</p>
    </div></ImageSettingsTheme>;
}

export function videoResolutionLabel(value: string, model: string, language = useLanguageStore.getState().language) { return isKling3TurboVideoModel(model) ? normalizeKling3TurboResolution(value) : canvasText("模型默认", "Model default", language); }
export function videoSecondsLabel(value: string, model = "", _language = useLanguageStore.getState().language) { return `${normalizeVideoDurationForModel(model, value)}s`; }
export function videoSizeLabel(value: string, _model: string, _language = useLanguageStore.getState().language) { return normalizeAspectRatio(value); }

function operationLabel(value: string, language: "zh" | "en") {
    const labels: Record<string, [string, string]> = { "text-to-video": ["文生视频", "Text to video"], "image-to-video": ["图生视频", "Image to video"], "first-last-frame": ["首尾帧视频", "First & last frame"], "motion-control": ["动作控制", "Motion control"], "omni-video": ["全能视频", "Omni video"] };
    return (labels[value] || labels["text-to-video"])[language === "en" ? 1 : 0];
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) { return <section className="space-y-2"><div className="text-sm font-medium" style={{ color }}>{title}</div>{children}</section>; }
function Option({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) { return <button type="button" className="rounded-xl border px-2 py-2 text-sm transition" style={mutedOptionStyle(theme, selected)} onClick={onClick}>{children}</button>; }
