"use client";

import { FolderPlus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { App, Button, Empty, Input, Spin, Tag } from "antd";

import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptDetailDialog } from "@/components/prompts/prompt-detail-dialog";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCopyText } from "@/hooks/use-copy-text";
import { sharedErrorText, sharedText } from "@/lib/i18n-shared";
import { cn } from "@/lib/utils";
import { useAssetStore } from "@/stores/use-asset-store";
import { useLanguageStore } from "@/stores/use-language-store";
import { ALL_PROMPTS_OPTION, type Prompt } from "@/services/api/prompts";

export default function PromptsPage() {
    const { message } = App.useApp();
    const language = useLanguageStore((state) => state.language);
    const [titleKeyword, setTitleKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const addAsset = useAssetStore((state) => state.addAsset);
    const copyText = useCopyText();
    const { query, items: promptItems, tags: promptTags, categories: promptCategoryOptions, total: totalPrompts } = usePromptList({ keyword: titleKeyword, tags: selectedTags, category: selectedCategory });

    useEffect(() => {
        if (query.isError) {
            message.error(query.error instanceof Error ? sharedErrorText(query.error.message, language) : sharedText("获取提示词失败", "Failed to load prompts", language));
        }
    }, [language, message, query.error, query.isError]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };

    const savePromptAsset = (item: Prompt) => {
        addAsset({ kind: "text", title: item.title, coverUrl: item.coverUrl, tags: item.tags, source: item.category, data: { content: item.prompt }, metadata: { source: "prompt-library", promptId: item.id, githubUrl: item.githubUrl } });
        message.success(sharedText("已加入我的素材", "Added to My Assets", language));
    };

    return (
        <div className="min-h-full bg-background text-stone-800 dark:text-stone-100">
            <main className="bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-8 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]">
                <div className="pb-8">
                    <div className="mx-auto max-w-5xl text-center">
                        <h1 className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">{sharedText("提示词中心", "Prompt Center", language)}</h1>
                        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                            {language === "en" ? `${totalPrompts} ${totalPrompts === 1 ? "prompt" : "prompts"}. Find inspiration quickly by title, tag, and category.` : `共 ${totalPrompts} 条提示词，按标题、标签与分类快速查找灵感。`}
                        </p>
                    </div>
                    {query.isLoading ? (
                        <div className="flex h-60 items-center justify-center">
                            <Spin />
                        </div>
                    ) : null}
                    {!query.isLoading ? (
                        <>
                            <div className="mx-auto mt-8 w-full max-w-2xl">
                                <Input size="large" className="w-full" prefix={<Search className="size-4 text-stone-400" />} value={titleKeyword} placeholder={sharedText("按标题查询", "Search by title", language)} onChange={(event) => setTitleKeyword(event.target.value)} />
                            </div>
                            <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                                <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                    <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">{sharedText("分类", "Category", language)}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {promptCategoryOptions.map((category) => (
                                            <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                                {category === ALL_PROMPTS_OPTION ? sharedText("全部", "All", language) : <span data-no-i18n>{category}</span>}
                                            </Tag.CheckableTag>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                    <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">{sharedText("标签", "Tags", language)}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {promptTags.map((tag) => (
                                            <Tag.CheckableTag
                                                key={tag}
                                                checked={tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)}
                                                className={cn("prompt-filter-tag", (tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)) && "is-active")}
                                                onChange={() => toggleTag(tag)}
                                            >
                                                {tag === ALL_PROMPTS_OPTION ? sharedText("全部", "All", language) : <span data-no-i18n>{tag}</span>}
                                            </Tag.CheckableTag>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {!query.isLoading ? (
                    <div>
                        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {promptItems.map((item) => (
                                <PromptCard
                                    key={item.id}
                                    item={item}
                                    onOpen={() => setSelectedPrompt(item)}
                                    onCopy={() => copyText(item.prompt, sharedText("提示词已复制", "Prompt copied", language))}
                                    extraAction={
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => savePromptAsset(item)}>
                                            {sharedText("加入我的素材", "Add to My Assets", language)}
                                        </Button>
                                    }
                                />
                            ))}
                        </div>
                        {promptItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={sharedText("没有找到匹配的提示词", "No matching prompts found", language)} className="py-16" /> : null}
                        <div className="mx-auto mt-6 max-w-7xl text-center text-xs text-stone-500 dark:text-stone-400">
                            {query.hasNextPage ? (
                                <Button size="small" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                                    {sharedText("加载更多", "Load more", language)}
                                </Button>
                            ) : promptItems.length > 0 ? (
                                sharedText("已经到底了", "You have reached the end", language)
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </main>

            <PromptDetailDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} onCopy={(prompt) => copyText(prompt, sharedText("提示词已复制", "Prompt copied", language))} onSaveAsset={savePromptAsset} />
        </div>
    );
}
