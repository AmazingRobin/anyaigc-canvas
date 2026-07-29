import type { SharedLanguage } from "@/lib/i18n-shared";

type DisplayAsset = {
    title: string;
    source?: string;
    metadata?: Record<string, unknown>;
};

const canonicalSources: Record<string, string> = {
    Manual: "手动添加",
    Canvas: "画布",
    "Prompt Library": "提示词库",
    "AnyAIGC Curated": "AnyAIGC 精选",
    "Image Studio": "生图工作台",
    "Video Studio": "视频创作台",
};

export function canonicalAssetSource(value?: string) {
    const source = value?.trim();
    if (!source) return undefined;
    return canonicalSources[source] ?? source;
}

export function assetDisplaySource(value: string | undefined, language: SharedLanguage) {
    const source = canonicalAssetSource(value);
    if (!source) return "";
    const translations: Record<string, string> = {
        手动添加: "Manual",
        画布: "Canvas",
        提示词库: "Prompt Library",
        "AnyAIGC 精选": "AnyAIGC Curated",
        生图工作台: "Image Studio",
        视频创作台: "Video Studio",
    };
    return language === "en" ? translations[source] ?? source : source;
}

/** Localizes only application-generated default titles; user-entered titles remain untouched. */
export function assetDisplayTitle(asset: DisplayAsset, language: SharedLanguage) {
    const source = typeof asset.metadata?.source === "string" ? asset.metadata.source : "";
    if (source === "image-page") {
        const match = asset.title.match(/^(?:生成结果|Generated result)\s+(\d+)$/iu);
        if (match) return language === "en" ? `Generated result ${match[1]}` : `生成结果 ${match[1]}`;
    }
    if (source === "video-page" && /^(?:生成视频|Generated video)$/iu.test(asset.title)) {
        return language === "en" ? "Generated video" : "生成视频";
    }
    return asset.title;
}
