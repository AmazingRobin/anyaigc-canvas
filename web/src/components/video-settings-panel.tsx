"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Switch } from "antd";

import { ImageSettingsTheme } from "@/components/image-settings-panel";
import {
    boolConfig,
    isSeedanceFastModel,
    isSeedanceVideoConfig,
    normalizeSeedanceDuration,
    normalizeSeedanceRatio,
    normalizeSeedanceResolution,
    seedanceDurationOptions,
    seedancePixelLabel,
    seedanceRatioOptions,
    seedanceResolutionOptions,
} from "@/lib/seedance-video";
import { normalizeRelayBasesVideoDuration, relayBasesVideoTiming } from "@/lib/relaybases-video";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { isRelayBasesVideoModel, modelOptionName, normalizeVideoCallMode, type AiConfig } from "@/stores/use-config-store";

const relayBasesAspectRatioOptions = [
    { value: "16:9", label: "横屏", width: 16, height: 9 },
    { value: "9:16", label: "竖屏", width: 9, height: 16 },
    { value: "1:1", label: "方形", width: 1, height: 1 },
];

const relayBasesVideoResolutionLabels: Record<string, string> = {
    "video-fast-480p": "480p",
    "video-fast-720p": "720p",
    "video-pro-480p": "480p",
    "video-pro-720p": "720p",
    "video-pro-1080p": "1080p",
    "video-standard-720p": "720p",
};

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoCallMode", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5" }: VideoSettingsPanelProps) {
    const [editingSeconds, setEditingSeconds] = useState(false);

    if (isSeedanceVideoConfig({ ...config, model: config.videoModel || config.model })) {
        return <SeedanceVideoSettingsPanel config={config} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }

    const selectedModel = modelOptionName(config.videoModel || config.model);
    const timing = relayBasesVideoTiming(selectedModel);
    const seconds = String(normalizeRelayBasesVideoDuration(config.videoSeconds, selectedModel));
    const aspectRatio = normalizeRelayBasesVideoAspectRatio(config.size);
    const resolutionLabel = relayBasesVideoResolutionLabel(selectedModel);
    const videoCallMode = normalizeVideoCallMode(config.videoCallMode);
    const showCallMode = isRelayBasesVideoModel(config.videoModel || config.model);
    const isPresetSecond = timing.options.some((value) => seconds === String(value));

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">视频设置</div> : null}
                {showCallMode ? (
                    <SettingGroup title="调用方式" color={theme.node.muted}>
                        <div className="grid grid-cols-2 gap-2.5">
                            <OptionPill selected={videoCallMode === "sync"} theme={theme} onClick={() => onConfigChange("videoCallMode", "sync")}>
                                同步
                            </OptionPill>
                            <OptionPill selected={videoCallMode === "async"} theme={theme} onClick={() => onConfigChange("videoCallMode", "async")}>
                                异步·4倍扣费
                            </OptionPill>
                        </div>
                    </SettingGroup>
                ) : null}
                <SettingGroup title="输出规格" color={theme.node.muted}>
                    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: theme.node.stroke }}>
                        <span className="opacity-65">清晰度由模型固定</span>
                        <span className="rounded-full px-2 py-1 font-semibold" style={{ background: theme.node.fill }}>
                            {resolutionLabel}
                        </span>
                    </div>
                </SettingGroup>
                <SettingGroup title="画面比例" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2.5">
                        {relayBasesAspectRatioOptions.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className="flex h-[78px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border text-sm transition hover:opacity-85"
                                style={{ background: aspectRatio === item.value ? theme.node.fill : "transparent", borderColor: theme.node.stroke, boxShadow: aspectRatio === item.value ? `inset 0 0 0 1px ${theme.node.stroke}` : undefined, color: theme.node.text }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", item.value)}
                            >
                                <SizePreview width={item.width} height={item.height} color={theme.node.muted} />
                                <span>{item.label}</span>
                                <span className="text-[11px] leading-none opacity-55">{item.value}</span>
                            </button>
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title="秒数" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2.5">
                        {timing.options.map((value) => (
                            <OptionPill key={value} selected={!editingSeconds && seconds === String(value)} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>
                                {value}s
                            </OptionPill>
                        ))}
                        <NumberInput value={timing.fixed ? seconds : config.videoSeconds || seconds} min={timing.min} max={timing.max} disabled={timing.fixed} selected={editingSeconds || !isPresetSecond} theme={theme} onChange={(value) => onConfigChange("videoSeconds", value)} onEditingChange={setEditingSeconds} />
                    </div>
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

function SeedanceVideoSettingsPanel({ config, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps) {
    const [editingSeconds, setEditingSeconds] = useState(false);
    const model = modelOptionName(config.videoModel || config.model);
    const resolution = normalizeSeedanceResolution(config.vquality, model);
    const ratio = normalizeSeedanceRatio(config.size);
    const duration = normalizeSeedanceDuration(config.videoSeconds);
    const generateAudio = boolConfig(config.videoGenerateAudio, true);
    const watermark = boolConfig(config.videoWatermark, false);
    const isPresetDuration = seedanceDurationOptions.some((value) => duration === value);

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">视频设置</div> : null}
                <SettingGroup title="分辨率" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2.5">
                        {seedanceResolutionOptions.map((item) => {
                            const disabled = item.value === "1080p" && isSeedanceFastModel(model);
                            return (
                                <OptionPill key={item.value} selected={resolution === item.value} disabled={disabled} theme={theme} onClick={() => onConfigChange("vquality", item.value)}>
                                    {item.label}
                                </OptionPill>
                            );
                        })}
                    </div>
                    {isSeedanceFastModel(model) ? <div className="text-[11px] leading-4 opacity-55">fast 模型不支持 1080p，会自动使用 720p。</div> : null}
                </SettingGroup>
                <SettingGroup title="比例" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2.5">
                        {seedanceRatioOptions.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className="flex h-[68px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 text-sm transition hover:opacity-85"
                                style={{ background: ratio === item.value ? theme.node.fill : "transparent", borderColor: theme.node.stroke, boxShadow: ratio === item.value ? `inset 0 0 0 1px ${theme.node.stroke}` : undefined, color: theme.node.text }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", item.value)}
                            >
                                <SizePreview width={ratioPreview(item.value).width} height={ratioPreview(item.value).height} color={theme.node.muted} />
                                <span>{item.label}</span>
                                <span className="text-[10px] leading-none opacity-55">{item.value === "adaptive" ? "adaptive" : seedancePixelLabel(resolution, item.value)}</span>
                            </button>
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title="时长" color={theme.node.muted}>
                    <div className="grid grid-cols-4 gap-2.5">
                        {seedanceDurationOptions.map((value) => (
                            <OptionPill key={value} selected={!editingSeconds && duration === value} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>
                                {value === -1 ? "智能" : `${value}s`}
                            </OptionPill>
                        ))}
                    </div>
                    <NumberInput value={config.videoSeconds || String(duration)} min={-1} max={15} selected={editingSeconds || !isPresetDuration} theme={theme} onChange={(value) => onConfigChange("videoSeconds", value)} onEditingChange={setEditingSeconds} />
                </SettingGroup>
                <SettingGroup title="输出" color={theme.node.muted}>
                    <div className="grid gap-2 rounded-xl border p-2.5" style={{ borderColor: theme.node.stroke }}>
                        <SwitchRow label="生成声音" checked={generateAudio} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} />
                        <SwitchRow label="添加水印" checked={watermark} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} />
                    </div>
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

export function videoResolutionLabel(value: string, model?: string) {
    if (model && isRelayBasesVideoModel(model)) return relayBasesVideoResolutionLabel(modelOptionName(model));
    return `${normalizeVideoResolutionValue(value)}p`;
}

export function videoSizeLabel(value: string, model?: string) {
    if (model && isRelayBasesVideoModel(model)) return relayBasesAspectRatioLabel(value);
    const ratio = normalizeSeedanceRatio(value);
    if (value === "adaptive" || value === "auto") return "自适应";
    if (ratio === value) return seedanceRatioOptions.find((item) => item.value === ratio)?.label || ratio;
    return relayBasesAspectRatioLabel(value);
}

export function videoSecondsLabel(value: string) {
    if (String(value).trim() === "-1") return "智能";
    return `${value || "6"}s`;
}

export function normalizeVideoSizeValue(value: string) {
    return normalizeRelayBasesVideoAspectRatio(value);
}

export function normalizeVideoResolutionValue(value: string) {
    if (value === "480p" || value === "low") return "480";
    if (value === "720p" || value === "auto" || value === "high" || value === "medium") return "720";
    return value.replace(/p$/i, "") || "720";
}

export function normalizeRelayBasesVideoAspectRatio(value: string) {
    if (relayBasesAspectRatioOptions.some((item) => item.value === value)) return value;
    const ratio = normalizeSeedanceRatio(value);
    if (ratio === "1:1" || ratio === "9:16" || ratio === "16:9") return ratio;
    const ratioMatch = value?.match(/^(\d+):(\d+)$/);
    if (ratioMatch) return normalizeRelayBasesVideoAspectRatio(`${ratioMatch[1]}x${ratioMatch[2]}`);
    const match = value?.match(/^(\d+)x(\d+)$/);
    if (!match) return "16:9";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "16:9";
    if (width === height) return "1:1";
    return width > height ? "16:9" : "9:16";
}

function relayBasesAspectRatioLabel(value: string) {
    const ratio = normalizeRelayBasesVideoAspectRatio(value);
    return relayBasesAspectRatioOptions.find((item) => item.value === ratio)?.label || ratio;
}

function relayBasesVideoResolutionLabel(model: string) {
    return relayBasesVideoResolutionLabels[modelOptionName(model)] || "模型固定";
}

function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            disabled={disabled}
            className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35"
            style={{ background: selected ? theme.node.fill : "transparent", borderColor: theme.node.stroke, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-2.5">
            <div className="text-xs font-medium" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function NumberInput({
    value,
    min,
    max,
    disabled = false,
    selected = false,
    theme,
    onChange,
    onEditingChange,
}: {
    value: string;
    min: number;
    max: number;
    disabled?: boolean;
    selected?: boolean;
    theme: CanvasTheme;
    onChange: (value: string) => void;
    onEditingChange?: (editing: boolean) => void;
}) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
        onEditingChange?.(false);
    }, [value]);

    const commit = () => {
        if (disabled) {
            onEditingChange?.(false);
            return;
        }
        const raw = String(draft).trim();
        if (min <= -1 && raw === "-1") {
            setDraft("-1");
            onChange("-1");
            onEditingChange?.(false);
            return;
        }
        const numberValue = Math.floor(Number(raw));
        const fallback = Math.max(min, Math.min(max, Number(value) || min));
        const next = Number.isFinite(numberValue) ? numberValue : fallback;
        const clamped = Math.max(min, Math.min(max, next));
        const normalized = String(clamped);
        setDraft(normalized);
        onChange(normalized);
        onEditingChange?.(false);
    };

    return (
        <input
            type="number"
            min={min}
            max={max}
            disabled={disabled}
            className="h-9 rounded-full border bg-transparent px-3 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ borderColor: theme.node.stroke, background: selected ? theme.node.fill : "transparent", color: theme.node.text, WebkitTextFillColor: theme.node.text, opacity: disabled ? 0.55 : 1 }}
            value={draft}
            onFocus={() => onEditingChange?.(true)}
            onChange={(event) => {
                setDraft(event.target.value);
                onEditingChange?.(true);
            }}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.currentTarget.blur();
                    commit();
                }
            }}
            onMouseDown={(event) => event.stopPropagation()}
        />
    );
}

function SizePreview({ width, height, color }: { width: number; height: number; color: string }) {
    if (!width || !height) return null;
    const longSide = Math.max(width, height);
    const previewWidth = Math.max(10, Math.round((width / longSide) * 26));
    const previewHeight = Math.max(10, Math.round((height / longSide) * 26));
    return <span className="rounded-[3px] border" style={{ width: previewWidth, height: previewHeight, borderColor: color }} />;
}

function ratioPreview(ratio: string) {
    if (ratio === "9:16") return { width: 9, height: 16 };
    if (ratio === "1:1") return { width: 1, height: 1 };
    if (ratio === "4:3") return { width: 4, height: 3 };
    if (ratio === "3:4") return { width: 3, height: 4 };
    if (ratio === "21:9") return { width: 21, height: 9 };
    if (ratio === "adaptive") return { width: 0, height: 0 };
    return { width: 16, height: 9 };
}

function SwitchRow({ label, checked, theme, onChange }: { label: string; checked: boolean; theme: CanvasTheme; onChange: (checked: boolean) => void }) {
    return (
        <div className="flex h-8 items-center justify-between gap-3">
            <span className="text-sm" style={{ color: theme.node.text }}>
                {label}
            </span>
            <span onMouseDown={(event) => event.stopPropagation()}>
                <Switch size="small" checked={checked} onChange={onChange} />
            </span>
        </div>
    );
}
