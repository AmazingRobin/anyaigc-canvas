"use client";

import { ArrowRight, ExternalLink, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { App, Image, Tag } from "antd";

import { RelayBasesCanvasIcon } from "@/components/brand/relaybases-canvas-icon";
import { navigationTools } from "@/constant/navigation-tools";
import { RELAYBASES_HOME_URL, RELAYBASES_KEYS_URL } from "@/constant/relaybases-links";
import { sharedErrorText, sharedText } from "@/lib/i18n-shared";
import { englishPromptFor, promptTagEnByZh, promptTitleEnById } from "@/local-prompts/relaybases-prompt-translations";
import { fetchPrompts, type Prompt } from "@/services/api/prompts";
import { useConfigStore } from "@/stores/use-config-store";
import { useLanguageStore, type LanguageName } from "@/stores/use-language-store";

const heroPromptIds = ["rb-prompt-001", "rb-prompt-011", "rb-prompt-021", "rb-prompt-031", "rb-prompt-041", "rb-prompt-051", "rb-prompt-061", "rb-prompt-071", "rb-prompt-081", "rb-prompt-091"];

const fallbackPrompts: Prompt[] = [
    createFallbackPrompt("rb-prompt-001", "雨夜玻璃窗人像", "/prompt-covers/relaybases/rb-prompt-001.webp", ["人像", "电影感"]),
    createFallbackPrompt("rb-prompt-011", "透明香水瓶广告", "/prompt-covers/relaybases/rb-prompt-011.webp", ["产品", "广告"]),
    createFallbackPrompt("rb-prompt-021", "峡谷玻璃住宅", "/prompt-covers/relaybases/rb-prompt-021.webp", ["建筑", "现代"]),
    createFallbackPrompt("rb-prompt-031", "冰川蓝湖航拍", "/prompt-covers/relaybases/rb-prompt-031.webp", ["风景", "航拍"]),
    createFallbackPrompt("rb-prompt-041", "月亮邮局绘本", "/prompt-covers/relaybases/rb-prompt-041.webp", ["插画", "绘本"]),
    createFallbackPrompt("rb-prompt-051", "透明机械水母", "/prompt-covers/relaybases/rb-prompt-051.webp", ["3D", "机械"]),
    createFallbackPrompt("rb-prompt-061", "城市能源流可视化", "/prompt-covers/relaybases/rb-prompt-061.webp", ["信息图", "科技"]),
    createFallbackPrompt("rb-prompt-071", "法式早餐桌", "/prompt-covers/relaybases/rb-prompt-071.webp", ["美食", "生活"]),
    createFallbackPrompt("rb-prompt-081", "星际植物温室", "/prompt-covers/relaybases/rb-prompt-081.webp", ["科幻", "植物"]),
    createFallbackPrompt("rb-prompt-091", "无字音乐节主视觉", "/prompt-covers/relaybases/rb-prompt-091.webp", ["海报", "音乐"]),
    createFallbackPrompt("rb-prompt-012", "黑色机械腕表特写", "/prompt-covers/relaybases/rb-prompt-012.webp", ["产品", "机械"]),
    createFallbackPrompt("rb-prompt-032", "竹林晨雾小径", "/prompt-covers/relaybases/rb-prompt-032.webp", ["风景", "东方"]),
];

function localizedFallbackPrompts(language: LanguageName): Prompt[] {
    if (language === "zh") return fallbackPrompts;
    return fallbackPrompts.map((item) => {
        const title = promptTitleEnById[item.id] || item.title;
        const tags = item.tags.map((tag) => promptTagEnByZh[tag] || tag);
        return { ...item, title, tags, prompt: englishPromptFor(title, tags) };
    });
}

const workflowHighlights = ["提示词", "图片", "视频", "Agent"] as const;

const creationModes = ["自由拖拽", "组合扩展", "多版本创作"] as const;

const heroPosterLayouts = [
    { gridColumn: "1 / span 7", gridRow: "1 / span 4" },
    { gridColumn: "8 / span 5", gridRow: "1 / span 3" },
    { gridColumn: "8 / span 5", gridRow: "4 / span 3" },
    { gridColumn: "1 / span 4", gridRow: "5 / span 2" },
    { gridColumn: "5 / span 3", gridRow: "5 / span 2" },
] as const;

function createFallbackPrompt(id: string, title: string, coverUrl: string, tags: string[]): Prompt {
    return {
        id,
        title,
        coverUrl,
        prompt: "RelayBases 精选视觉提示词示例，适合直接加入画布继续改写、延展和生成。",
        tags,
        category: "RelayBases",
        githubUrl: "",
        preview: coverUrl,
        createdAt: "",
        updatedAt: "",
    };
}

function pickHeroPrompts(items: Prompt[]) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const picked = heroPromptIds.map((id) => byId.get(id)).filter(Boolean) as Prompt[];
    if (picked.length >= Math.min(heroPromptIds.length, items.length)) return picked.slice(0, 10);
    const pickedIds = new Set(picked.map((item) => item.id));
    return [...picked, ...items.filter((item) => !pickedIds.has(item.id))].slice(0, 10);
}

export default function IndexPage() {
    const { message } = App.useApp();
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const language = useLanguageStore((state) => state.language);
    const [primaryTool] = navigationTools;
    const fallbackForLanguage = useMemo(() => localizedFallbackPrompts(language), [language]);
    const [promptShowcaseResult, setPromptShowcaseResult] = useState<{ language: LanguageName; items: Prompt[] }>(() => ({ language, items: [] }));
    const [hiddenPromptIds, setHiddenPromptIds] = useState<Set<string>>(() => new Set());
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const promptShowcase = promptShowcaseResult.language === language ? promptShowcaseResult.items : [];
    const visiblePromptShowcase = promptShowcase.filter((item) => !hiddenPromptIds.has(item.id) && item.coverUrl.trim());
    const showcasePrompts = (visiblePromptShowcase.length ? visiblePromptShowcase : fallbackForLanguage).filter((item) => !hiddenPromptIds.has(item.id));
    const heroPrompts = pickHeroPrompts(showcasePrompts);
    const heroPromptIdSet = new Set(heroPrompts.map((item) => item.id));
    const galleryPrompts = showcasePrompts.filter((item) => !heroPromptIdSet.has(item.id)).slice(0, 15);
    const previewPrompts = [...heroPrompts, ...galleryPrompts];

    useEffect(() => {
        void fetchPrompts({ pageSize: 100, language })
            .then((data) => {
                setHiddenPromptIds(new Set());
                setPromptShowcaseResult({ language, items: data.items });
            })
            .catch((error) => message.error(error instanceof Error ? sharedErrorText(error.message, language) : sharedText("获取提示词失败", "Failed to load prompts", language)));
    }, [language, message]);

    const hidePrompt = (id: string) => {
        setHiddenPromptIds((current) => new Set(current).add(id));
    };

    return (
        <main className="min-h-full bg-[#f4f2ed] text-stone-950 dark:bg-[#181715] dark:text-stone-50">
            <section className="relative overflow-hidden border-b border-black/10 bg-[#f4f2ed] dark:border-white/10 dark:bg-[#181715]">
                <div className="pointer-events-none absolute inset-0 opacity-[0.45] [--home-grid:rgba(68,64,60,.12)] [background-image:linear-gradient(var(--home-grid)_1px,transparent_1px),linear-gradient(90deg,var(--home-grid)_1px,transparent_1px)] [background-size:48px_48px] dark:[--home-grid:rgba(245,245,244,.10)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f4f2ed]/90 to-transparent dark:from-[#181715]/90" />
                <div className="relative mx-auto grid max-w-[1440px] gap-10 px-6 py-8 lg:grid-cols-[minmax(560px,0.9fr)_minmax(520px,0.82fr)] lg:items-center lg:py-10 xl:grid-cols-[minmax(640px,0.9fr)_minmax(600px,0.86fr)]">
                    <div className="max-w-3xl">
                        <div className="mb-7 sm:mb-8">
                            <a
                                href={RELAYBASES_HOME_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 py-1.5 pl-1.5 pr-3 text-sm font-medium text-stone-700 shadow-[0_10px_30px_rgba(20,25,40,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white hover:text-stone-950 dark:border-white/10 dark:bg-white/[0.08] dark:text-stone-200 dark:shadow-black/20 dark:hover:border-white/20 dark:hover:bg-white/[0.12] dark:hover:text-white"
                            >
                                <RelayBasesCanvasIcon className="size-8 transition duration-300 group-hover:scale-105" />
                                <span className="font-semibold tracking-tight">RelayBases Canvas</span>
                                <ExternalLink className="size-3.5 opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-90" />
                            </a>
                        </div>
                        <h1 className="flex max-w-4xl flex-col gap-2 text-[2rem] font-semibold leading-[1.08] tracking-normal text-stone-950 min-[380px]:text-[2.1rem] sm:gap-3 sm:text-5xl lg:gap-4 lg:text-[3.05rem] xl:text-[3.35rem] dark:text-white">
                            <span className="block">一张画布</span>
                            <span className="block bg-[linear-gradient(90deg,#0f172a_0%,#059669_44%,#2563eb_100%)] bg-clip-text text-transparent dark:bg-[linear-gradient(90deg,#ffffff_0%,#6ee7b7_48%,#93c5fd_100%)]">承载完整 AI 创作流程</span>
                        </h1>
                        <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8 dark:text-stone-300">将图片、视频、提示词和 Agent 工作流放在同一空间中，自由拖拽、组合、扩展，适合灵感探索、项目规划和多版本创作。</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {creationModes.map((mode) => (
                                <span key={mode} className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-stone-300">
                                    {mode}
                                </span>
                            ))}
                        </div>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <a
                                href={RELAYBASES_KEYS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-stone-950 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200"
                            >
                                获取 API Key
                                <ArrowRight className="size-4" />
                            </a>
                            <a
                                href={`/${primaryTool.slug}?mode=new`}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/70 px-5 text-sm font-medium text-stone-950 shadow-sm transition hover:border-stone-400 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-white/25 dark:hover:bg-white/15"
                            >
                                进入画布
                            </a>
                            <button
                                type="button"
                                onClick={() => openConfigDialog(false)}
                                className="group relative isolate inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full border border-emerald-400/70 bg-white px-5 text-sm font-semibold text-emerald-950 shadow-[0_0_0_4px_rgba(16,185,129,0.10),0_10px_24px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-[0_0_0_5px_rgba(16,185,129,0.14),0_14px_30px_rgba(15,23,42,0.14)] dark:border-emerald-300/40 dark:bg-white/10 dark:text-emerald-50 dark:shadow-[0_0_0_4px_rgba(110,231,183,0.10),0_10px_24px_rgba(0,0,0,0.24)] dark:hover:bg-emerald-300/15"
                            >
                                <span className="absolute inset-y-0 -left-16 -z-10 w-12 skew-x-[-18deg] bg-white/70 opacity-0 transition duration-700 group-hover:translate-x-48 group-hover:opacity-80 dark:bg-white/20" />
                                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm dark:bg-emerald-400 dark:text-stone-950">
                                    <Settings2 className="size-3.5 transition group-hover:rotate-45" />
                                </span>
                                配置 Key
                            </button>
                        </div>
                        <div className="mt-5 max-w-2xl rounded-2xl border border-stone-300/70 bg-white/55 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm font-semibold text-stone-950 dark:text-white">Key 准备</div>
                                <div className="text-xs text-stone-500 dark:text-stone-400">在配置面板分别填写媒体 Key 和文本 Key</div>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/55 px-3 py-2.5 dark:border-emerald-300/15 dark:bg-emerald-300/10">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-200">媒体 Key</span>
                                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-100">media 分组</span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-300">图片和视频生成</p>
                                </div>
                                <div className="rounded-xl border border-sky-500/20 bg-sky-50/55 px-3 py-2.5 dark:border-sky-300/15 dark:bg-sky-300/10">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium text-sky-700 dark:text-sky-200">文本 Key</span>
                                        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-300/15 dark:text-sky-100">codex-pro 分组</span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-300">Agent 和文本模型</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="ml-auto max-w-[680px] rounded-[28px] border border-white/60 bg-white/70 p-3 shadow-2xl shadow-stone-900/10 backdrop-blur dark:border-white/10 dark:bg-white/[0.05] dark:shadow-black/30">
                            <div className="mb-3 flex items-center justify-between px-2">
                                <div>
                                    <span className="text-xs font-medium uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">Canvas Workflow</span>
                                    <div className="mt-1 text-sm font-semibold text-stone-900 dark:text-white">从想法到成片</div>
                                </div>
                            </div>
                            <div className="grid h-[380px] grid-cols-12 grid-rows-6 gap-2 sm:h-[460px]">
                                {heroPrompts.slice(0, heroPosterLayouts.length).map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            const promptIndex = previewPrompts.findIndex((prompt) => prompt.id === item.id);
                                            setPreviewIndex(Math.max(promptIndex, 0));
                                            setPreviewOpen(true);
                                        }}
                                        style={heroPosterLayouts[index]}
                                        className="group relative isolate overflow-hidden rounded-2xl bg-stone-100 shadow-md shadow-stone-900/10 ring-1 ring-black/10 transition [background-clip:padding-box] [contain:paint] hover:-translate-y-0.5 dark:bg-stone-950 dark:ring-white/10 dark:shadow-black/30"
                                    >
                                        <img src={item.coverUrl} alt={item.title} className="absolute -inset-px block h-[calc(100%+2px)] w-[calc(100%+2px)] rounded-[inherit] object-cover transform-gpu [backface-visibility:hidden] transition duration-500 group-hover:scale-[1.04]" onError={() => hidePrompt(item.id)} />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 text-left text-white">
                                            <p className="line-clamp-1 text-xs font-semibold">{item.title}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {workflowHighlights.map((item) => (
                                    <span key={item} className="rounded-full border border-black/10 bg-white/65 px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-stone-300">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="relative overflow-hidden bg-[#f4f2ed] px-6 py-14 dark:bg-[#181715]">
                <div className="pointer-events-none absolute inset-0 opacity-[0.35] [--home-grid:rgba(68,64,60,.11)] [background-image:linear-gradient(var(--home-grid)_1px,transparent_1px),linear-gradient(90deg,var(--home-grid)_1px,transparent_1px)] [background-size:48px_48px] dark:[--home-grid:rgba(245,245,244,.09)]" />
                <div className="relative mx-auto max-w-7xl">
                    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                        <div>
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">Prompt Gallery</p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-stone-950 dark:text-white">精选提示词示例</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-300">从精选提示词中展示不同风格的成片效果，适合快速感受画布里的创作方向。</p>
                        </div>
                        <a href="/prompts" className="inline-flex items-center gap-2 text-sm font-medium text-stone-700 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white">
                            查看提示词库
                            <ArrowRight className="size-4" />
                        </a>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        {galleryPrompts.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    const promptIndex = previewPrompts.findIndex((prompt) => prompt.id === item.id);
                                    setPreviewIndex(Math.max(promptIndex, index));
                                    setPreviewOpen(true);
                                }}
                                className="group relative isolate aspect-square cursor-pointer overflow-hidden rounded-2xl bg-stone-100 text-left shadow-sm ring-1 ring-stone-200 transition [background-clip:padding-box] [contain:paint] hover:-translate-y-0.5 dark:bg-white/5 dark:ring-white/10"
                            >
                                <img src={item.coverUrl} alt={item.title} className="absolute -inset-px block h-[calc(100%+2px)] w-[calc(100%+2px)] rounded-[inherit] object-cover transform-gpu [backface-visibility:hidden] transition duration-500 group-hover:scale-[1.03]" onError={() => hidePrompt(item.id)} />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 text-white">
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {item.tags.slice(0, 2).map((tag, tagIndex) => (
                                            <Tag key={`${tag}-${tagIndex}`} className="m-0 border-white/10 bg-white/15 text-[11px] text-white backdrop-blur">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>
            <Image.PreviewGroup
                preview={{
                    open: previewOpen,
                    current: previewIndex,
                    onOpenChange: setPreviewOpen,
                    onChange: setPreviewIndex,
                }}
            >
                <div className="hidden">
                    {previewPrompts.map((item) => (
                        <Image key={item.id} src={item.coverUrl} alt={item.title} onError={() => hidePrompt(item.id)} />
                    ))}
                </div>
            </Image.PreviewGroup>
        </main>
    );
}
