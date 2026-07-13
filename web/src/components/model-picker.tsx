"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Cpu } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { sharedText } from "@/lib/i18n-shared";
import { cn } from "@/lib/utils";
import { modelOptionLabel, modelOptionName, relayBasesModelBillingLabel, selectableModelsByCapability, type AiConfig, type ModelCapability } from "@/stores/use-config-store";
import { useLanguageStore, type LanguageName } from "@/stores/use-language-store";

type ModelPickerProps = {
    config: AiConfig;
    value?: string;
    onChange: (model: string) => void;
    capability?: ModelCapability;
    className?: string;
    fullWidth?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
};

export function ModelPicker({ config, value, onChange, capability, className, fullWidth = false, placeholder = "选择模型", onMissingConfig }: ModelPickerProps) {
    const language = useLanguageStore((state) => state.language);
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const options = useMemo(
        () => Array.from(new Set([...(config.channelMode === "local" && !capability ? [value] : []), ...selectableModelsByCapability(config, capability)].filter((model): model is string => Boolean(model)))),
        [capability, config, value],
    );
    const current = value || "";
    const localizedPlaceholder = sharedText(placeholder, undefined, language);

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    return (
        <Select
            open={open}
            value={current}
            onOpenChange={(nextOpen) => {
                if (nextOpen && !options.length && config.channelMode === "local") onMissingConfig?.();
                if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
                setOpen(nextOpen);
            }}
            onValueChange={onChange}
        >
            <SelectTrigger
                className={cn(
                    "canvas-composer-model-picker h-8 w-fit max-w-full gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors",
                    fullWidth ? "w-full min-w-0 justify-start" : "min-w-[9rem] justify-start",
                    "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
                    className,
                )}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                title={current ? modelOptionLabel(config, current) : localizedPlaceholder}
            >
                <ModelIcon model={current} />
                <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{current ? modelOptionLabel(config, current) : localizedPlaceholder}</span>
            </SelectTrigger>
            <SelectContent
                data-canvas-no-zoom
                className="z-[1200] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-popover p-1 shadow-xl"
                position="popper"
                align="start"
                side="bottom"
                sideOffset={6}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {options.length ? (
                    options.map((model) => (
                        <SelectItem key={model} value={model} textValue={modelOptionLabel(config, model)}>
                            <ModelLabel config={config} model={model} />
                        </SelectItem>
                    ))
                ) : (
                    <SelectItem value="__empty__" disabled>
                        {emptyModelLabel(config, capability, language)}
                    </SelectItem>
                )}
            </SelectContent>
        </Select>
    );
}

function emptyModelLabel(config: AiConfig, capability: ModelCapability | undefined, language: LanguageName) {
    const label = capability === "image" ? "生图" : capability === "video" ? "视频" : capability === "text" ? "文本" : capability === "audio" ? "音频" : "";
    if (capability === "text" && !config.textModels.length) return sharedText("请先填写文本 API Key 并获取模型", "Enter a text API key and load models first", language);
    if (capability && config.models.length) return sharedText("请先在上方配置可选模型", "Configure the available models above first", language);
    if (!config.models.length) return sharedText("请先填写 API Key 并获取模型", "Enter an API key and load models first", language);
    if (language === "en") return `No matching ${capability === "image" ? "image" : capability === "video" ? "video" : capability === "text" ? "text" : capability === "audio" ? "audio" : ""} models`;
    return `暂无匹配的${label}模型`;
}

function ModelLabel({ config, model }: { config: AiConfig; model: string }) {
    const billing = relayBasesModelBillingLabel(model);
    return (
        <span className="flex min-w-0 items-center gap-2">
            <ModelIcon model={model} />
            <span className="truncate">{modelOptionLabel(config, model)}</span>
            {billing ? (
                <span
                    className={cn(
                        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] leading-none",
                        billing.includes("异步") ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-100" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
                    )}
                >
                    {billing}
                </span>
            ) : null}
        </span>
    );
}

function ModelIcon({ model }: { model: string }) {
    const icon = resolveModelIcon(modelOptionName(model));
    return icon ? <img src={icon} alt="" className="size-4 shrink-0 dark:invert" /> : <Cpu className="size-4 shrink-0 opacity-70" />;
}

function resolveModelIcon(model: string) {
    const name = model.toLowerCase();
    if (name.includes("claude") || name.includes("anthropic")) return "/icons/claude.svg";
    if (name.includes("gemini") || name.includes("google")) return "/icons/gemini.svg";
    if (name.includes("gpt") || name.includes("openai")) return "/icons/openai.svg";
    if (name.includes("grok") || name.includes("grok")) return "/icons/grok.svg";
    if (name.includes("deepseek") || name.includes("deepseek")) return "/icons/deepseek.svg";
    if (name.includes("glm") || name.includes("glm")) return "/icons/glm.svg";
    return "";
}
