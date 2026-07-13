import { compactApiParams, serializeApiParams } from "@/services/api/request";
import { sharedFormatDate, sharedText, type SharedLanguage } from "@/lib/i18n-shared";

export type Prompt = {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
    category: string;
    githubUrl: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
};

export const ALL_PROMPTS_OPTION = "全部";

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    total: number;
};

export async function fetchPrompts({ keyword = "", tag = [], category = ALL_PROMPTS_OPTION, page, pageSize, language = "zh" }: { keyword?: string; tag?: string[]; category?: string; page?: number; pageSize?: number; language?: SharedLanguage } = {}) {
    const params = serializeApiParams(
        compactApiParams({
            lang: language,
            ...(keyword ? { keyword } : {}),
            ...(tag.length ? { tag } : {}),
            ...(category !== ALL_PROMPTS_OPTION ? { category } : {}),
            ...(page ? { page } : {}),
            ...(pageSize ? { pageSize } : {}),
        }),
    );
    const response = await fetch(`/api/prompts${params.size ? `?${params}` : ""}`);
    if (!response.ok) throw new Error(sharedText("获取提示词失败", "Failed to load prompts"));
    return (await response.json()) as PromptListResponse;
}

export function formatPromptDate(value: string, language?: SharedLanguage) {
    return sharedFormatDate(value, language);
}
