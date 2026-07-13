import { requestImageQuestion, type AiTextMessage } from "@/services/api/image";
import { workbenchText } from "@/lib/i18n-workbench";
import { resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export type PromptOptimizeTarget = "image" | "video";

type RequestOptions = { signal?: AbortSignal };

export function isPromptOptimizerReady(config: AiConfig) {
    const model = config.textModel.trim();
    if (!model) return false;
    const requestConfig = resolveModelRequestConfig(config, model);
    return Boolean(requestConfig.model.trim() && requestConfig.baseUrl.trim() && requestConfig.apiKey.trim());
}

export async function optimizeGenerationPrompt(config: AiConfig, target: PromptOptimizeTarget, prompt: string, options?: RequestOptions) {
    const text = prompt.trim();
    if (!text) throw new Error(workbenchText("请先输入提示词梗概"));
    if (!isPromptOptimizerReady(config)) throw new Error(workbenchText("请先配置文本 API Key 并获取文本模型"));

    const messages: AiTextMessage[] = [
        {
            role: "system",
            content: [
                "你是专业的媒体生成提示词编辑器。",
                "根据用户提供的简短梗概，改写为更完整、更可执行的生成提示词。",
                target === "video"
                    ? "补充主体动作、镜头运动、场景变化、节奏、光线、风格和运动连续性。"
                    : "补充主体、构图、风格、材质、光线、色彩、镜头/媒介和细节层次。",
                "必须保留用户原意，不添加与原意冲突的内容。",
                "使用用户原文的主要语言输出。",
                "只返回优化后的提示词正文，不要解释，不要 Markdown 代码块，不要标题。",
            ].join("\n"),
        },
        {
            role: "user",
            content: `类型：${target === "video" ? "视频生成" : "图像生成"}\n原始梗概：${text}`,
        },
    ];

    const result = cleanOptimizedPrompt(await requestImageQuestion(config, messages, () => {}, options));
    if (!result) throw new Error(workbenchText("文本模型没有返回可用提示词"));
    return result;
}

function cleanOptimizedPrompt(value: string) {
    return value
        .trim()
        .replace(/^```(?:text|markdown|prompt)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .replace(/^["'“”]+|["'“”]+$/g, "")
        .trim();
}
