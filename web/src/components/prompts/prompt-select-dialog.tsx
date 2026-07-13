"use client";

import { Check, Search } from "lucide-react";
import { type UIEvent, useEffect, useState } from "react";
import { App, Empty, Input, Modal, Spin, Tag } from "antd";

import { ALL_PROMPTS_OPTION } from "@/services/api/prompts";
import { sharedErrorText, sharedText } from "@/lib/i18n-shared";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/stores/use-language-store";
import { PromptCard } from "./prompt-card";
import { usePromptList } from "./use-prompt-list";

export function PromptSelectDialog({ open, onOpenChange, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (prompt: string) => void }) {
    const { message } = App.useApp();
    const language = useLanguageStore((state) => state.language);
    const [keyword, setKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const { query, items, tags: promptTags, categories: promptCategories } = usePromptList({ keyword, tags: selectedTags, category: selectedCategory, enabled: open });
    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };
    const selectPrompt = (prompt: string) => {
        onSelect(prompt);
        onOpenChange(false);
    };

    useEffect(() => {
        if (query.isError) message.error(query.error instanceof Error ? sharedErrorText(query.error.message, language) : sharedText("获取提示词失败", "Failed to load prompts", language));
    }, [language, message, query.error, query.isError]);

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) void query.fetchNextPage();
    };

    return (
        <Modal title={sharedText("提示词库", "Prompt Library", language)} open={open} onCancel={() => onOpenChange(false)} footer={null} width={1040} centered styles={{ body: { maxHeight: "calc(100vh - 180px)", overflowY: "auto", paddingRight: 12 } }}>
            <div data-canvas-no-zoom onWheelCapture={(event) => event.stopPropagation()}>
                <div className="mx-auto max-w-2xl">
                    <Input size="large" prefix={<Search className="size-4 text-stone-400" />} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={sharedText("按标题查询", "Search by title", language)} />
                </div>
                <div className="mt-5 grid gap-3">
                    <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                        <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">{sharedText("分类", "Category", language)}</div>
                        <div className="flex flex-wrap gap-2">
                            {promptCategories.map((category) => (
                                <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                    {category === ALL_PROMPTS_OPTION ? sharedText("全部", "All", language) : <span data-no-i18n>{category}</span>}
                                </Tag.CheckableTag>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                        <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">{sharedText("标签", "Tags", language)}</div>
                        <div className="flex flex-wrap gap-2">
                            {promptTags.map((tag) => {
                                const active = tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag);
                                return (
                                    <Tag.CheckableTag key={tag} checked={active} className={cn("prompt-filter-tag", active && "is-active")} onChange={() => toggleTag(tag)}>
                                        {tag === ALL_PROMPTS_OPTION ? sharedText("全部", "All", language) : <span data-no-i18n>{tag}</span>}
                                    </Tag.CheckableTag>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="thin-scrollbar mt-6 max-h-[min(52vh,520px)] overflow-y-auto pr-2 pb-2" data-canvas-no-zoom onScroll={handleListScroll} onWheelCapture={(event) => event.stopPropagation()}>
                    {query.isLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Spin />
                        </div>
                    ) : null}
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => (
                            <PromptCard key={item.id} item={item} onOpen={() => selectPrompt(item.prompt)} onCopy={() => selectPrompt(item.prompt)} actionLabel={sharedText("使用此提示词", "Use this prompt", language)} actionIcon={<Check className="size-3.5" />} actionType="primary" />
                        ))}
                    </div>
                    {!query.isLoading && items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={sharedText("没有找到匹配的提示词", "No matching prompts found", language)} className="py-8" /> : null}
                    {query.isFetchingNextPage ? (
                        <div className="py-4 text-center">
                            <Spin size="small" />
                        </div>
                    ) : null}
                </div>
            </div>
        </Modal>
    );
}
