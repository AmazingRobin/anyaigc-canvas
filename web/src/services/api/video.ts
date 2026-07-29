import axios from "axios";

import {
    buildGrokVideoPayload,
    buildKling3TurboVideoPayload,
    buildKlingMotionControlPayload,
    buildKlingOmniVideoPayload,
    buildMiniMaxHailuoVideoPayload,
    isGrokVideoModel,
    mediaModelCapability,
    mediaRequestError,
    normalizeAspectRatio,
    normalizeKling3TurboDuration,
    normalizeMiniMaxHailuoDuration,
    normalizeVideoDuration,
} from "@/lib/anyaigc-media-models";
import { workbenchText } from "@/lib/i18n-workbench";
import { uploadImageReference, uploadVideoReference } from "@/services/api/media-upload";
import { getMediaBlob, uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { getImageBlob } from "@/services/image-storage";
import { buildApiUrl, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

type RequestOptions = { signal?: AbortSignal };
type VideoResponse = {
    id?: string;
    task_id?: string;
    status?: string;
    state?: string;
    task_status?: string;
    success?: boolean;
    final?: boolean;
    video_url?: string | null;
    url?: string | null;
    result_urls?: string[];
    task_result?: { videos?: Array<{ url?: string | null }> };
    data?: VideoResponse | null;
    file?: { download_url?: string | null };
    error?: { message?: string };
    fail_reason?: string | null;
    failure_reason?: string | null;
    message?: string | null;
    msg?: string;
    code?: number;
};

export type VideoGenerationResult = { blob?: Blob; url?: string; mimeType?: string };
export type VideoGenerationTask = { id: string; provider: "grok" | "kling-motion-control" | "kling-omni-video" | "kling-3-turbo-text" | "kling-3-turbo-image" | "minimax-hailuo"; model: string; startedAt?: number };
export type VideoGenerationTaskState = { status: "pending" } | { status: "completed"; result: VideoGenerationResult } | { status: "failed"; error: string };
export type VideoGenerationPollConfig = { attempts: number; delayMs: number; timeoutMessage: string };

export function videoGenerationPollConfig(_task: VideoGenerationTask): VideoGenerationPollConfig {
    return { attempts: 240, delayMs: 3000, timeoutMessage: workbenchText("视频任务仍在排队或生成中，请稍后在历史记录中继续查看", "The video task is still pending. Check the generation history again later.") };
}

export async function requestVideoGeneration(config: AiConfig, prompt: string, references: ReferenceImage[] = [], videoReferences: ReferenceVideo[] = [], audioReferences: ReferenceAudio[] = [], options?: RequestOptions): Promise<VideoGenerationResult> {
    const task = await createVideoGenerationTask(config, prompt, references, videoReferences, audioReferences, options);
    const pollConfig = videoGenerationPollConfig(task);
    for (let attempt = 0; attempt < pollConfig.attempts; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const state = await pollVideoGenerationTask(config, task, options);
        if (state.status === "completed") return state.result;
        if (state.status === "failed") throw new Error(state.error);
        if (attempt === pollConfig.attempts - 1) throw new Error(pollConfig.timeoutMessage);
        await delay(pollConfig.delayMs, options?.signal);
    }
    throw new Error(pollConfig.timeoutMessage);
}

export async function createVideoGenerationTask(config: AiConfig, prompt: string, references: ReferenceImage[] = [], videoReferences: ReferenceVideo[] = [], audioReferences: ReferenceAudio[] = [], options?: RequestOptions): Promise<VideoGenerationTask> {
    const selectedModel = (config.videoModel || config.model).trim();
    const requestConfig = resolveModelRequestConfig(config, selectedModel);
    const capability = mediaModelCapability(requestConfig.model);
    if (!capability || capability.kind !== "video") throw new Error(workbenchText("请先配置 AnyAIGC 支持的视频模型", "Configure a supported AnyAIGC video model first"));
    if (!requestConfig.apiKey.trim()) throw new Error(workbenchText("请先配置媒体 API Key", "Configure a media API key first"));
    if (audioReferences.length) throw new Error(workbenchText("当前视频模型不支持参考音频", "The selected video model does not support audio references."));
    const validationError = mediaRequestError(requestConfig.model, { imageCount: references.length, videoCount: videoReferences.length, operation: config.videoOperation });
    if (validationError) throw new Error(validationError);

    if (capability.invocation === "grok") return createGrokTask(requestConfig, selectedModel, prompt, references, videoReferences, options);
    if (capability.invocation === "kling-motion-control") return createKlingMotionControlTask(requestConfig, selectedModel, prompt, references[0], videoReferences[0], options);
    if (capability.invocation === "kling-3-turbo") return createKling3TurboTask(requestConfig, selectedModel, prompt, references, options);
    if (capability.invocation === "minimax-hailuo") return createMiniMaxHailuoTask(requestConfig, selectedModel, prompt, references, config.videoOperation, options);
    return createKlingOmniVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, options);
}

export async function pollVideoGenerationTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    const requestConfig = resolveModelRequestConfig(config, task.model);
    const path = task.provider === "grok" ? `/video/query?id=${encodeURIComponent(task.id)}` : task.provider === "kling-motion-control" ? `/kling/v1/videos/motion-control/${encodeURIComponent(task.id)}` : task.provider === "kling-3-turbo-text" ? `/kling/text-to-video/kling-3.0-turbo/${encodeURIComponent(task.id)}` : task.provider === "kling-3-turbo-image" ? `/kling/image-to-video/kling-3.0-turbo/${encodeURIComponent(task.id)}` : task.provider === "minimax-hailuo" ? `/minimax/v1/query/video_generation?task_id=${encodeURIComponent(task.id)}` : `/kling/v1/videos/omni-video/${encodeURIComponent(task.id)}`;
    try {
        const response = await axios.get<VideoResponse>(apiUrl(requestConfig, path), { headers: apiHeaders(requestConfig), signal: options?.signal });
        const video = unwrap(response.data);
        if (isCompleted(video)) {
            const url = resultUrl(video);
            if (!url) return { status: "failed", error: workbenchText("视频任务完成但没有返回播放地址", "The completed video task returned no playable URL") };
            return { status: "completed", result: await videoResultFromUrl(url, options) };
        }
        if (isFailed(video)) return { status: "failed", error: taskError(video) };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, workbenchText("视频任务查询失败", "Failed to query the video task")));
    }
}

export async function storeGeneratedVideo(result: VideoGenerationResult): Promise<UploadedFile> {
    if (result.blob) return uploadMediaFile(result.blob, "video");
    if (result.url) return { url: result.url, storageKey: "", bytes: 0, mimeType: result.mimeType || "video/mp4" };
    throw new Error(workbenchText("视频接口没有返回可播放的视频", "The video API returned no playable video"));
}

async function createGrokTask(config: AiConfig, selectedModel: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], options?: RequestOptions): Promise<VideoGenerationTask> {
    if (videoReferences.length) throw new Error(workbenchText("当前 Grok 视频模型不支持参考视频", "The selected Grok video model does not support reference videos."));
    const imageUrls = await Promise.all(references.map((image) => referenceImageUrl(image, options)));
    const payload = buildGrokVideoPayload({ model: config.model, prompt, size: config.size, imageUrls });
    const created = await createTask(config, "/video/create", payload, options);
    return { id: taskId(created), provider: "grok", model: selectedModel, startedAt: Date.now() };
}

async function createKlingMotionControlTask(config: AiConfig, selectedModel: string, prompt: string, image: ReferenceImage, video: ReferenceVideo, options?: RequestOptions): Promise<VideoGenerationTask> {
    const payload = buildKlingMotionControlPayload({ prompt, imageUrl: await referenceImageUrl(image, options), videoUrl: await referenceVideoUrl(video, options) });
    const created = await createTask(config, "/kling/v1/videos/motion-control", payload, options);
    return { id: taskId(created), provider: "kling-motion-control", model: selectedModel, startedAt: Date.now() };
}

async function createKlingOmniVideoTask(config: AiConfig, selectedModel: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const [imageUrls, videoUrls] = await Promise.all([Promise.all(references.map((image) => referenceImageUrl(image, options))), Promise.all(videoReferences.map((video) => referenceVideoUrl(video, options)))]);
    const payload = buildKlingOmniVideoPayload({ prompt, duration: normalizeVideoDuration(config.videoSeconds), aspectRatio: normalizeAspectRatio(config.size), imageUrls, videoUrls });
    const created = await createTask(config, "/kling/v1/videos/omni-video", payload, options);
    return { id: taskId(created), provider: "kling-omni-video", model: selectedModel, startedAt: Date.now() };
}

async function createKling3TurboTask(config: AiConfig, selectedModel: string, prompt: string, references: ReferenceImage[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const imageUrl = references[0] ? await referenceImageUrl(references[0], options) : "";
    const payload = buildKling3TurboVideoPayload({ prompt, imageUrl, duration: normalizeKling3TurboDuration(config.videoSeconds), aspectRatio: config.size, resolution: config.vquality });
    const provider = imageUrl ? "kling-3-turbo-image" : "kling-3-turbo-text";
    const path = imageUrl ? "/kling/image-to-video/kling-3.0-turbo" : "/kling/text-to-video/kling-3.0-turbo";
    const created = await createTask(config, path, payload, options);
    return { id: taskId(created), provider, model: selectedModel, startedAt: Date.now() };
}

async function createMiniMaxHailuoTask(config: AiConfig, selectedModel: string, prompt: string, references: ReferenceImage[], operation: AiConfig["videoOperation"], options?: RequestOptions): Promise<VideoGenerationTask> {
    const imageUrls = await Promise.all(references.map((image) => referenceImageUrl(image, options)));
    const payload = buildMiniMaxHailuoVideoPayload({ model: config.model, prompt, duration: normalizeMiniMaxHailuoDuration(config.videoSeconds), operation, imageUrls });
    const created = await createTask(config, "/minimax/v1/video_generation", payload, options);
    return { id: taskId(created), provider: "minimax-hailuo", model: selectedModel, startedAt: Date.now() };
}

async function createTask(config: AiConfig, path: string, body: FormData | Record<string, unknown>, options?: RequestOptions) {
    try {
        const response = await axios.post<VideoResponse>(apiUrl(config, path), body, { headers: body instanceof FormData ? apiHeaders(config) : apiHeaders(config, "application/json"), signal: options?.signal });
        return unwrap(response.data);
    } catch (error) {
        throw new Error(readAxiosError(error, workbenchText("视频任务创建失败", "Failed to create the video task")));
    }
}

async function referenceImageUrl(image: ReferenceImage, options?: RequestOptions) {
    const directUrl = image.url || image.dataUrl || "";
    if (isPublicUrl(directUrl)) return directUrl;
    const blob = image.storageKey ? await getImageBlob(image.storageKey) : await fetch(directUrl).then((response) => response.blob());
    if (!blob) throw new Error(workbenchText("参考图读取失败，请重新添加", "Failed to read the image reference. Add it again."));
    return uploadImageReference(new File([blob], image.name || "reference.png", { type: blob.type || image.type || "image/png" }), options?.signal);
}

async function referenceVideoUrl(video: ReferenceVideo, options?: RequestOptions) {
    if (isStorageVideoUrl(video.url)) return video.url;
    const blob = video.storageKey ? await getMediaBlob(video.storageKey) : await fetch(video.url).then((response) => response.blob());
    if (!blob) throw new Error(workbenchText("参考视频读取失败，请重新添加 MP4", "Failed to read the video reference. Add the MP4 again."));
    return uploadVideoReference(new File([blob], video.name || "reference.mp4", { type: blob.type || video.type || "video/mp4" }), options?.signal);
}

function apiUrl(config: AiConfig, path: string) {
    return path.startsWith("/kling/") || path.startsWith("/minimax/") ? `${config.baseUrl.replace(/\/+$/, "")}${path}` : buildApiUrl(config.baseUrl, path);
}

function apiHeaders(config: AiConfig, contentType?: string) {
    return { Authorization: `Bearer ${config.apiKey}`, ...(contentType ? { "Content-Type": contentType } : {}) };
}

function unwrap(payload: VideoResponse) {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || taskError(payload));
    return payload.data || payload;
}

function taskId(video: VideoResponse) {
    const id = video.id || video.task_id;
    if (!id) throw new Error(workbenchText("视频接口没有返回任务 ID", "The video API returned no task ID"));
    return id;
}

function resultUrl(video: VideoResponse) {
    return video.video_url || video.url || video.result_urls?.find(Boolean) || video.task_result?.videos?.find((item) => item.url)?.url || video.file?.download_url || video.data?.file?.download_url || "";
}

function statuses(video: VideoResponse): string[] {
    return [video.status, video.state, video.task_status, video.data?.status].flatMap((value) => {
        const status = value?.trim().toLowerCase();
        return status ? [status] : [];
    });
}

function isCompleted(video: VideoResponse) {
    return statuses(video).some((status) => status === "completed" || status === "succeed" || status === "succeeded" || status === "success") || (video.success === true && Boolean(resultUrl(video)));
}

function isFailed(video: VideoResponse) {
    return statuses(video).some((status) => status.includes("fail") || status.includes("error") || status.includes("cancel") || status.includes("expire")) || video.final === true && video.success === false;
}

function taskError(video: VideoResponse) {
    return video.error?.message || video.fail_reason || video.failure_reason || video.message || workbenchText("视频生成失败", "Video generation failed");
}

async function videoResultFromUrl(url: string, options?: RequestOptions): Promise<VideoGenerationResult> {
    if (isPublicUrl(url)) return { url, mimeType: "video/mp4" };
    try {
        const response = await axios.get<Blob>(url, { responseType: "blob", signal: options?.signal });
        return { blob: response.data, mimeType: response.data.type || "video/mp4" };
    } catch (error) {
        throw new Error(readAxiosError(error, workbenchText("视频结果下载失败", "Failed to download the video result")));
    }
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isCancel(error)) return workbenchText("请求已取消", "Request cancelled");
    if (axios.isAxiosError<{ error?: { message?: string }; msg?: string }>(error)) return error.response?.data?.msg || error.response?.data?.error?.message || (error.response?.status ? `${fallback} (${error.response.status})` : fallback);
    return error instanceof Error ? error.message : fallback;
}

function isPublicUrl(value: string) {
    return /^https?:\/\//i.test(value);
}

function isStorageVideoUrl(value: string) {
    try {
        return new URL(value).hostname.toLowerCase() === "storage.to";
    } catch {
        return false;
    }
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
    });
}
