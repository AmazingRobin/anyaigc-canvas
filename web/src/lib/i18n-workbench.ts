import { useLanguageStore, type LanguageName } from "@/stores/use-language-store";

/**
 * Workbench strings kept separate so the root i18n dictionary can consume the
 * same exact-text translations while image/video code uses explicit formatters
 * for values that must never depend on DOM mutation.
 */
export const workbenchZhToEn = {
    "记录": "History",
    "生成记录": "Generation History",
    "生成视频": "Generated video",
    "搜索提示词": "Search prompts",
    "全选": "Select all",
    "取消全选": "Deselect all",
    "删除选中": "Delete selected",
    "下载选中": "Download selected",
    "回收站": "Trash",
    "置顶": "Pin",
    "取消置顶": "Unpin",
    "当前会话": "Current session",
    "历史记录": "History",
    "默认": "Default",
    "请求": "Requests",
    "成功": "Succeeded",
    "生成中": "Generating",
    "生成方式": "Generation mode",
    "失败": "Failed",
    "并发": "Concurrent",
    "时间": "Time",
    "总耗时": "Total time",
    "总时长": "Total duration",
    "生成失败": "Generation failed",
    "生成记录回收站": "Generation history trash",
    "恢复": "Restore",
    "恢复选中": "Restore selected",
    "彻底删除": "Delete permanently",
    "彻底删除生成记录": "Delete generation history permanently",
    "清空回收站": "Empty trash",
    "清理": "Cleanup",
    "回收站为空": "Trash is empty",
    "未命名": "Untitled",
    "未找到匹配的生成记录": "No matching generation history found",
    "暂无生成记录": "No generation history yet",
    "还没有生成图片": "No images generated yet",
    "还没有生成视频": "No videos generated yet",
    "选择回收站记录": "Select trash item",
    "选择生成记录": "Select generation history item",
    "选择生成结果": "Select generated result",
    "生成结果": "Generated result",
    "图片缺失": "Image missing",
    "正在读取图片": "Loading image",
    "图片已生成": "Image generated",
    "视频已生成": "Video generated",
    "图片生成完成": "Image generation complete",
    "图片生成失败": "Image generation failed",
    "视频生成完成": "Video generation complete",
    "视频生成失败": "Video generation failed",
    "视频任务创建失败": "Failed to create video task",
    "生成记录保存失败": "Failed to save generation history",
    "重新生成": "Generate again",
    "恢复结果": "Restore result",
    "重试": "Retry",
    "删除结果": "Delete result",
    "删除生成结果": "Delete generated result",
    "删除生成记录": "Delete generation history",
    "下载图片": "Download image",
    "下载视频": "Download video",
    "复用提示词和配置": "Reuse prompt and settings",
    "作为参考图继续编辑": "Continue editing with this reference image",
    "作为参考视频继续编辑": "Continue editing with this reference video",
    "用这张图生成视频": "Generate video from this image",
    "添加到素材": "Add to assets",
    "取消加入素材": "Remove from assets",
    "已加入我的素材，点击取消": "Added to My Assets; click to remove",
    "已加入我的素材": "Added to My Assets",
    "已取消加入素材": "Removed from My Assets",
    "提示词已复制": "Prompt copied",
    "复用生成配置": "Reuse generation settings",
    "已复用生成配置": "Generation settings reused",
    "这条结果缺少可复用的生成配置": "This result has no reusable generation settings",
    "使用文本模型优化和丰富提示词": "Use a text model to improve and expand the prompt",
    "AI 优化": "AI Enhance",
    "请先输入提示词梗概": "Enter a prompt outline first",
    "请先配置文本 API Key 并获取文本模型": "Configure the text API key and load text models first",
    "提示词已优化": "Prompt enhanced",
    "提示词优化失败": "Failed to enhance prompt",
    "请输入生图提示词": "Enter an image prompt",
    "请输入视频提示词": "Enter a video prompt",
    "请先完成配置": "Complete the settings first",
    "描述画面主体、风格、构图、光线和用途": "Describe the subject, style, composition, lighting, and intended use",
    "描述镜头运动、主体动作、场景氛围和画面风格": "Describe camera movement, subject motion, scene mood, and visual style",
    "参考素材": "Reference media",
    "上传参考素材": "Upload reference media",
    "未添加": "Not added",
    "当前模型不使用": "Not used by this model",
    "不使用": "Not used",
    "移除参考视频": "Remove reference video",
    "移除参考音频": "Remove reference audio",
    "播放视频": "Play video",
    "视频播放": "Video player",
    "播放": "Play",
    "暂停": "Pause",
    "重播": "Replay",
    "静音": "Mute",
    "取消静音": "Unmute",
    "全屏": "Full screen",
    "大小": "Size",
    "声音": "Audio",
    "水印": "Watermark",
    "智能": "Auto",
    "横屏": "Landscape",
    "竖屏": "Portrait",
    "方形": "Square",
    "标准横屏": "Standard landscape",
    "标准竖屏": "Standard portrait",
    "宽银幕": "Widescreen",
    "当前": "Current",
    "开": "On",
    "关": "Off",
    "选择时长预设": "Choose a duration preset",
    "选择生成质量": "Choose generation quality",
    "张数": "Count",
    "处理参考图": "Handle reference image",
    "替换": "Replace",
    "追加": "Append",
    "处理参考视频": "Handle reference video",
    "正在打包图片": "Packaging images",
    "正在打包视频": "Packaging videos",
    "图片打包失败": "Failed to package images",
    "视频打包失败": "Failed to package videos",
    "请选择可下载的图片结果": "Select downloadable image results",
    "请选择可下载的视频结果": "Select downloadable video results",
    "已替换参考图": "Reference images replaced",
    "已加入参考图": "Reference images added",
    "已替换参考视频": "Reference video replaced",
    "已加入参考视频": "Reference video added",
    "已带入视频工作台参考图": "Reference image sent to Video Studio",
    "生图工作台只能使用文本或图片素材": "Image Studio only accepts text or image assets",
    "接口没有返回图片": "The API returned no image",
    "图片文件缺失": "Image file missing",
    "视频文件缺失": "Video file missing",
    "生成记录已恢复": "Generation history restored",
    "已彻底删除": "Deleted permanently",
    "回收站已清空": "Trash emptied",
    "重试结果已生成，但本地保存失败，刷新后可能不会保留": "The retry succeeded, but local saving failed. The result may be lost after refresh.",
    "参考图数量已达到当前模型上限": "The reference image limit for this model has been reached",
    "参考视频数量已达到当前模型上限": "The reference video limit for this model has been reached",
    "参考音频数量已达到当前模型上限": "The reference audio limit for this model has been reached",
    "当前模型不使用参考视频": "This model does not use reference video",
    "剪切板里没有可读取的图片": "No readable image was found on the clipboard",
    "已忽略不支持的参考图": "Unsupported reference images were ignored",
    "已忽略不支持的参考素材，请使用图片、mp4/mov 视频或 mp3/wav 音频": "Unsupported reference media was ignored. Use images, MP4/MOV video, or MP3/WAV audio.",
    "已忽略当前模型不使用的参考素材": "Reference media not used by this model was ignored",
    "找不到可恢复的视频任务记录": "No restorable video task was found",
    "该视频任务正在恢复中": "This video task is already being restored",
    "请先完成媒体 API Key 配置后再恢复结果": "Configure the media API key before restoring the result",
    "当前模型需要 1 个参考视频": "This model requires one reference video",
    "请先配置 API Key": "Configure the API key first",
    "视频任务仍在排队或生成中，请稍后在历史记录中继续查看": "The video task is still queued or generating. Check it again in history later.",
    "视频接口没有返回可播放的视频": "The video API returned no playable video",
    "视频接口没有返回任务 ID": "The video API returned no task ID",
    "视频编辑需要连接一个参考视频": "Video editing requires one reference video",
    "视频任务查询失败": "Failed to query the video task",
    "视频任务完成但结果下载失败": "The video task completed, but downloading the result failed",
    "视频下载失败": "Failed to download the video",
    "读取本地素材失败": "Failed to read local media",
    "参考图压缩失败，请换一张图片或重新上传": "Failed to compress the reference image. Choose another image or upload it again.",
    "参考图读取失败，请换一张图片或重新上传": "Failed to read the reference image. Choose another image or upload it again.",
    "参考视频必须是公网 URL，或重新上传后再生成": "The reference video must use a public URL. Upload it again before generating.",
    "参考音频必须是公网 URL，或重新上传后再生成": "The reference audio must use a public URL. Upload it again before generating.",
    "参考图自动压缩后仍超过 VEO 500KB 限制，请换一张更小的图片或降低图片分辨率": "The reference image still exceeds VEO's 500 KB limit after compression. Use a smaller image or lower its resolution.",
    "请求失败": "Request failed",
    "请求已取消": "Request cancelled",
    "鉴权失败，请检查 API Key、套餐权限或模型权限": "Authentication failed. Check the API key, plan access, and model permissions.",
    "请求被限流或额度不足，请稍后重试": "The request was rate-limited or has insufficient quota. Try again later.",
    "图像尺寸格式不支持，请使用 auto、9:16 或 1024x1024": "Unsupported image size format. Use auto, 9:16, or 1024x1024.",
    "图像比例必须是正数，例如 9:16": "The image ratio must use positive numbers, for example 9:16.",
    "图像宽高比不能超过 3:1，请调整尺寸": "The image aspect ratio cannot exceed 3:1. Adjust the size.",
    "图像尺寸必须是正整数，例如 1024x1024": "Image dimensions must be positive integers, for example 1024x1024.",
    "图像尺寸的宽高必须是 16 的倍数，请调整尺寸": "Image width and height must be multiples of 16. Adjust the size.",
    "图像尺寸最长边不能超过 3840px，请调整尺寸": "The longest image side cannot exceed 3840 px. Adjust the size.",
    "图像总像素需在 655360 到 8294400 之间，请调整尺寸": "Total image pixels must be between 655360 and 8294400. Adjust the size.",
    "异步任务接口没有返回任务": "The async API returned no task",
    "异步图片任务没有返回 task_id": "The async image task returned no task_id",
    "异步图片任务完成但没有返回图片 URL": "The async image task completed without an image URL",
    "异步图片任务生成失败": "Async image generation failed",
    "异步图片任务超时，请稍后重试": "The async image task timed out. Try again later.",
    "图片读取失败": "Failed to read the image",
    "读取图片失败": "Failed to read the image",
    "音频生成失败": "Audio generation failed",
    "请先配置音频模型": "Configure an audio model first",
    "请先完成 AnyAIGC 配置": "Complete the AnyAIGC settings first",
    "Gemini 调用格式暂不支持音频生成，请使用 OpenAI 格式渠道": "Gemini format does not support audio generation. Use an OpenAI-format channel.",
    "文本模型没有返回可用提示词": "The text model did not return a usable prompt",
    "读取模型失败": "Failed to load models",
    "没有返回内容": "No content was returned",
    "正在创建图片": "Creating image",
    "马上就好了": "Almost there",
    "再等等": "Just a little longer",
    "正在整理细节": "Refining details",
    "图像设置": "Image settings",
    "生成张数": "Image count",
    "音频设置": "Audio settings",
    "格式": "Format",
    "语速": "Speed",
    "声音指令": "Voice instructions",
    "分辨率": "Resolution",
    "输出": "Output",
    "生成声音": "Generate audio",
    "添加水印": "Add watermark",
    "自适应": "Adaptive",
    "模型固定": "Fixed by model",
    "fast 模型不支持 1080p，会自动使用 720p。": "Fast models do not support 1080p and will automatically use 720p.",
} as const satisfies Record<string, string>;

const workbenchEnToZh = new Map<string, string>(Object.entries(workbenchZhToEn).map(([zh, en]) => [en, zh]));

const dynamicWorkbenchErrorRules = [
    [/^视频(\d+) 超过 50MB，请压缩后再上传$/u, /^Video (\d+) exceeds 50 MB; compress it before uploading again$/u, (number: string) => `视频${number} 超过 50MB，请压缩后再上传`, (number: string) => `Video ${number} exceeds 50 MB; compress it before uploading again`],
    [/^视频(\d+) 时长需要在 2-15 秒之间$/u, /^Video (\d+) must be 2-15 seconds long$/u, (number: string) => `视频${number} 时长需要在 2-15 秒之间`, (number: string) => `Video ${number} must be 2-15 seconds long`],
    [/^视频(\d+) 宽高需要在 300-6000px 之间$/u, /^Video (\d+) width and height must each be 300-6000 px$/u, (number: string) => `视频${number} 宽高需要在 300-6000px 之间`, (number: string) => `Video ${number} width and height must each be 300-6000 px`],
    [/^视频(\d+) 宽高比需要在 0\.4-2\.5 之间$/u, /^Video (\d+) aspect ratio must be between 0\.4 and 2\.5$/u, (number: string) => `视频${number} 宽高比需要在 0.4-2.5 之间`, (number: string) => `Video ${number} aspect ratio must be between 0.4 and 2.5`],
    [/^Gemini 拒绝了本次请求：(.*)$/u, /^Gemini rejected this request: (.*)$/u, (detail: string) => `Gemini 拒绝了本次请求：${detail}`, (detail: string) => `Gemini rejected this request: ${detail}`],
] as const;

export type WorkbenchLanguage = LanguageName;

function currentLanguage(language?: WorkbenchLanguage): WorkbenchLanguage {
    return language ?? useLanguageStore.getState().language;
}

export function workbenchText(zh: string, en?: string, language?: WorkbenchLanguage): string {
    if (currentLanguage(language) !== "en") return zh;
    return en ?? workbenchZhToEn[zh as keyof typeof workbenchZhToEn] ?? zh;
}

/** Formats the persisted-history trash button, whose count makes it a dynamic string. */
export function workbenchTrashLabel(count: number, language?: WorkbenchLanguage): string {
    const label = workbenchText("回收站", "Trash", language);
    return count > 0 ? `${label} ${count}` : label;
}

/** Keeps the visible tooltip and accessibility label in the active language. */
export function workbenchPinLabel(pinned: boolean, language?: WorkbenchLanguage): string {
    return pinned ? workbenchText("取消置顶", "Unpin", language) : workbenchText("置顶", "Pin", language);
}

function localizedKnownWorkbenchBase(value: string, language: WorkbenchLanguage) {
    if (language === "en") {
        const translated = workbenchZhToEn[value as keyof typeof workbenchZhToEn];
        if (translated) return translated;
        return workbenchEnToZh.has(value) ? value : "";
    }
    const translated = workbenchEnToZh.get(value);
    if (translated) return translated;
    return value in workbenchZhToEn ? value : "";
}

function localizedHttpStatusError(value: string, language: WorkbenchLanguage) {
    const colon = value.match(/^(.+?)(?:：|:)\s*(\d{3})$/u);
    if (colon) {
        const base = localizedKnownWorkbenchBase(colon[1].trim(), language);
        if (base) return language === "en" ? `${base}: ${colon[2]}` : `${base}：${colon[2]}`;
    }
    const parentheses = value.match(/^(.+?)(?:（|\()\s*(\d{3})\s*(?:）|\))$/u);
    if (parentheses) {
        const base = localizedKnownWorkbenchBase(parentheses[1].trim(), language);
        if (base) return language === "en" ? `${base} (${parentheses[2]})` : `${base}（${parentheses[2]}）`;
    }
    return "";
}

/** Localizes exact application-owned workbench messages while preserving unknown upstream text. */
export function workbenchErrorText(value: string, language?: WorkbenchLanguage): string {
    const targetLanguage = currentLanguage(language);
    if (targetLanguage === "en") {
        const exact = workbenchZhToEn[value as keyof typeof workbenchZhToEn];
        if (exact) return exact;
        const statusError = localizedHttpStatusError(value, targetLanguage);
        if (statusError) return statusError;
        for (const [zhPattern, , , toEnglish] of dynamicWorkbenchErrorRules) {
            const match = value.match(zhPattern);
            if (match) return toEnglish(match[1]);
        }
        return value;
    }
    const exact = workbenchEnToZh.get(value);
    if (exact) return exact;
    const statusError = localizedHttpStatusError(value, targetLanguage);
    if (statusError) return statusError;
    for (const [, enPattern, toChinese] of dynamicWorkbenchErrorRules) {
        const match = value.match(enPattern);
        if (match) return toChinese(match[1]);
    }
    return value;
}

export function normalizeWorkbenchQuality(value?: string): "auto" | "high" | "medium" | "low" {
    const normalized = String(value || "auto").trim().toLowerCase();
    if (["high", "高", "高质量"].includes(normalized)) return "high";
    if (["medium", "中", "中等", "中等质量"].includes(normalized)) return "medium";
    if (["low", "低", "低质量"].includes(normalized)) return "low";
    return "auto";
}

export function workbenchQualityLabel(value?: string, language?: WorkbenchLanguage): string {
    const quality = normalizeWorkbenchQuality(value);
    const labels = {
        auto: ["自动", "Auto"],
        high: ["高质量", "High"],
        medium: ["中等质量", "Medium"],
        low: ["低质量", "Low"],
    } as const;
    const [zh, en] = labels[quality];
    return workbenchText(zh, en, language);
}

export function workbenchStatusLabel(value?: string, language?: WorkbenchLanguage): string {
    const normalized = String(value || "").trim().toLowerCase();
    if (["pending", "running", "generating", "生成中"].includes(normalized)) return workbenchText("生成中", "Generating", language);
    if (["success", "succeeded", "成功"].includes(normalized)) return workbenchText("成功", "Succeeded", language);
    if (["failed", "failure", "error", "失败"].includes(normalized)) return workbenchText("失败", "Failed", language);
    return value || workbenchText("默认", "Default", language);
}

export function workbenchCount(count: number, zhUnit: string, singular: string, plural = `${singular}s`, language?: WorkbenchLanguage): string {
    return currentLanguage(language) === "en" ? `${count} ${count === 1 ? singular : plural}` : `${count} ${zhUnit}`;
}

export function workbenchFormatDuration(milliseconds: number, language?: WorkbenchLanguage): string {
    const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (currentLanguage(language) === "en") return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
    return minutes ? `${minutes}分${String(seconds).padStart(2, "0")}秒` : `${seconds}秒`;
}

export function workbenchFormatDate(value: number | string | Date, options: Intl.DateTimeFormatOptions = {}, language?: WorkbenchLanguage): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(currentLanguage(language) === "en" ? "en-US" : "zh-CN", options);
}

export function workbenchFormatTime(value: number | string | Date, language?: WorkbenchLanguage): string {
    return workbenchFormatDate(value, { hour12: false, hour: "2-digit", minute: "2-digit" }, language);
}

export function workbenchTrashExpiry(expiresAt: number, language?: WorkbenchLanguage): string {
    const remaining = Math.max(0, expiresAt - Date.now());
    const hours = Math.ceil(remaining / 3_600_000);
    if (hours <= 1) return workbenchText("即将清理", "Cleaning soon", language);
    if (hours < 24) return currentLanguage(language) === "en" ? `Cleaned in ${hours} hours` : `${hours} 小时后清理`;
    const days = Math.ceil(hours / 24);
    return currentLanguage(language) === "en" ? `Cleaned in ${days} days` : `${days} 天后清理`;
}
