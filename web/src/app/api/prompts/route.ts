import type { NextRequest } from "next/server";

import { englishPromptFor, promptTagEnByZh, promptTitleEnById } from "@/local-prompts/anyaigc-prompt-translations";
import localPrompts from "@/local-prompts/anyaigc-prompts.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalPrompt = {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
};

type Prompt = LocalPrompt & {
    category: string;
    githubUrl: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
};

const promptCategory = "AnyAIGC 精选";
const promptCategoryEn = "AnyAIGC Curated";
const createdAt = "2026-06-28";

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const keyword = (params.get("keyword") || "").trim().toLowerCase();
    const tags = params.getAll("tag").filter(Boolean);
    const category = params.get("category") || "";
    const lang = normalizeLanguage(params.get("lang") || request.headers.get("accept-language"));
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params.get("pageSize")) || 20));
    const items = getPrompts(lang);
    const withoutTagFilter = filterPrompts(items, { keyword, category, tags: [] });
    const filtered = filterPrompts(items, { keyword, category, tags });

    return Response.json({
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        tags: collectTags(withoutTagFilter, lang),
        categories: collectCategories(items),
        total: filtered.length,
    });
}

function getPrompts(lang: "zh" | "en"): Prompt[] {
    return (localPrompts as LocalPrompt[]).map((item) => ({
        ...item,
        title: lang === "en" ? promptTitleEnById[item.id] || item.title : item.title,
        tags: uniqueTags(lang === "en" ? item.tags.map((tag) => promptTagEnByZh[tag] || tag) : item.tags),
        prompt: lang === "en" ? englishPromptFor(promptTitleEnById[item.id] || item.title, item.tags.map((tag) => promptTagEnByZh[tag] || tag)) : item.prompt,
        category: lang === "en" ? promptCategoryEn : promptCategory,
        githubUrl: "",
        preview: markdownPreview(item.coverUrl),
        createdAt,
        updatedAt: createdAt,
    }));
}

function filterPrompts(items: Prompt[], options: { keyword: string; category: string; tags: string[] }) {
    return items.filter((item) => {
        if (isActiveOption(options.category) && item.category !== options.category) return false;
        if (options.tags.length && !options.tags.some((tag) => item.tags.includes(tag))) return false;
        if (!options.keyword) return true;
        return [item.title, item.prompt, item.category, ...item.tags].join(" ").toLowerCase().includes(options.keyword);
    });
}

function collectTags(items: Prompt[], lang: "zh" | "en") {
    return Array.from(new Set(items.flatMap((item) => item.tags).filter(Boolean))).sort(new Intl.Collator(lang === "en" ? "en-US" : "zh-CN").compare);
}

function collectCategories(items: Prompt[]) {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
}

function uniqueTags(tags: string[]) {
    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function markdownPreview(image: string) {
    return image ? `![](${image})` : "";
}

function isActiveOption(value: string) {
    return Boolean(value && value !== "全部" && value !== "鍏ㄩ儴" && value.toLowerCase() !== "all");
}

function normalizeLanguage(value: string | null) {
    const language = (value || "").toLowerCase();
    return language.startsWith("zh") || language.includes("zh-") ? "zh" : "en";
}
