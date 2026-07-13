"use client";

import { Copy, FolderPlus } from "lucide-react";
import { Button, Modal, Space, Tag } from "antd";

import { sharedFormatDate, sharedText } from "@/lib/i18n-shared";
import { type Prompt } from "@/services/api/prompts";
import { useLanguageStore } from "@/stores/use-language-store";

export function PromptDetailDialog({ prompt, onClose, onCopy, onSaveAsset }: { prompt: Prompt | null; onClose: () => void; onCopy: (prompt: string) => void; onSaveAsset?: (prompt: Prompt) => void }) {
    const language = useLanguageStore((state) => state.language);
    return (
        <>
            <Modal title={<span data-no-i18n>{prompt?.title}</span>} open={Boolean(prompt)} onCancel={onClose} footer={null} width={860}>
                {prompt ? (
                    <>
                        <div className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
                            <div className="space-y-3">
                                <img data-no-i18n src={prompt.coverUrl} alt={prompt.title} className="aspect-[4/3] w-full rounded-lg object-cover" />
                                {prompt.preview ? <pre data-no-i18n className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-100 p-3 text-xs leading-5 text-stone-600 dark:bg-stone-900 dark:text-stone-300">{prompt.preview}</pre> : null}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap gap-1.5">
                                    {prompt.tags.map((tag, index) => (
                                        <Tag data-no-i18n key={`${tag}-${index}`} className="m-0">
                                            {tag}
                                        </Tag>
                                    ))}
                                </div>
                                <p data-no-i18n className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-800 dark:text-stone-300">{prompt.prompt}</p>
                                <div className="mt-4 text-xs text-stone-500 dark:text-stone-400">
                                    {sharedText("创建", "Created", language)}: {sharedFormatDate(prompt.createdAt, language)} · {sharedText("更新", "Updated", language)}: {sharedFormatDate(prompt.updatedAt, language)}
                                </div>
                                <Space wrap className="mt-5">
                                    <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(prompt.prompt)}>
                                        {sharedText("复制提示词", "Copy prompt", language)}
                                    </Button>
                                    {onSaveAsset ? (
                                        <Button icon={<FolderPlus className="size-4" />} onClick={() => onSaveAsset(prompt)}>
                                            {sharedText("加入我的素材", "Add to My Assets", language)}
                                        </Button>
                                    ) : null}
                                </Space>
                            </div>
                        </div>
                    </>
                ) : null}
            </Modal>
        </>
    );
}
