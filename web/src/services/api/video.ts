import axios from "axios";

import { getDataUrlByteSize } from "@/lib/image-utils";
import { normalizeRelayBasesVideoDuration } from "@/lib/relaybases-video";
import { copyRelayBasesPublicMedia, uploadRelayBasesPublicMedia } from "@/services/cloud-sync";
import { getMediaBlob, uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { getImageBlob, imageToDataUrl } from "@/services/image-storage";
import { boolConfig, buildSeedancePromptText, isSeedanceVideoConfig, normalizeSeedanceDuration, normalizeSeedanceRatio, normalizeSeedanceResolution, seedanceVideoReferenceError, SEEDANCE_REFERENCE_LIMITS } from "@/lib/seedance-video";
import { buildApiUrl, isRelayBasesVideoModel, modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

type VideoResponse = {
    id?: string;
    task_id?: string;
    status?: string;
    state?: string;
    task_status?: string;
    success?: boolean;
    final?: boolean;
    progress?: number;
    image_url?: string | null;
    video_url?: string | null;
    url?: string | null;
    result_urls?: string[];
    metadata?: {
        url?: string | null;
        video_url?: string | null;
        image_url?: string | null;
        result_urls?: string[] | null;
        [key: string]: unknown;
    } | null;
    error?: { code?: string | number; message?: string };
    fail_reason?: string | null;
    failure_reason?: string | null;
    message?: string | null;
    code?: string | number;
};
type ApiVideoResponse = VideoResponse | { code?: number; data?: VideoResponse | null; msg?: string };
type SeedanceTask = {
    id: string;
    status?: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
    error?: { code?: string; message?: string } | null;
    content?: { video_url?: string; last_frame_url?: string } | null;
};
type ApiEnvelope<T> = T | { code?: number; data?: T | null; msg?: string };
type RequestOptions = { signal?: AbortSignal };
const RELAYBASES_IMAGE_DATA_URL_LIMIT_BYTES = 500 * 1024;
const RELAYBASES_IMAGE_DATA_URL_TARGET_BYTES = 480 * 1024;
const RELAYBASES_IMAGE_MAX_EDGE = 1536;
const RELAYBASES_IMAGE_MIN_EDGE = 256;
const GENERATED_VIDEO_ARCHIVE_TIMEOUT_MS = 12000;
const relayBasesPublicMediaUploads = new Map<string, Promise<string>>();

export type VideoGenerationResult = { blob?: Blob; url?: string; mimeType?: string };
export type VideoGenerationTask = { id: string; provider: "openai" | "seedance"; model: string; mode?: AiConfig["videoCallMode"] };
export type VideoGenerationTaskState = { status: "pending" } | { status: "completed"; result: VideoGenerationResult } | { status: "failed"; error: string };
export type VideoGenerationPollConfig = { attempts: number; delayMs: number; timeoutMessage: string };

export function videoGenerationPollConfig(task: VideoGenerationTask): VideoGenerationPollConfig {
    if (task.provider === "openai" && isRelayBasesVideoModel(task.model)) {
        return {
            attempts: 2400,
            delayMs: 3000,
            timeoutMessage: "视频任务仍在排队或生成中，请稍后在历史记录中继续查看",
        };
    }
    return {
        attempts: 120,
        delayMs: task.provider === "seedance" ? 5000 : 2500,
        timeoutMessage: `${task.provider === "seedance" ? "Seedance " : ""}视频生成超时，请稍后重试`,
    };
}

function aiApiUrl(config: AiConfig, path: string) {
    return buildApiUrl(config.baseUrl, path);
}

function aiHeaders(config: AiConfig, contentType?: string) {
    return {
        Authorization: `Bearer ${config.apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
    };
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
    assertVideoConfig(requestConfig, requestConfig.model);
    if (isSeedanceVideoConfig(requestConfig)) {
        return createSeedanceTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
    }
    return createOpenAIVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
}

export async function pollVideoGenerationTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    const requestConfig = resolveModelRequestConfig(config, task.model);
    assertVideoConfig(requestConfig, requestConfig.model);
    return task.provider === "seedance" ? pollSeedanceTask(requestConfig, task, options) : pollOpenAIVideoTask(requestConfig, task, options);
}

export async function storeGeneratedVideo(result: VideoGenerationResult, options: { apiKey?: string; signal?: AbortSignal } = {}): Promise<UploadedFile> {
    if (result.blob) return uploadMediaFile(result.blob, "video");
    if (result.url) {
        const mimeType = result.mimeType || "video/mp4";
        const url = options.apiKey ? await copyGeneratedVideoWithFallback(options.apiKey, result.url, mimeType, options.signal) : result.url;
        return { url, storageKey: "", bytes: 0, mimeType };
    }
    throw new Error("视频接口没有返回可播放的视频");
}

async function copyGeneratedVideoWithFallback(apiKey: string, sourceUrl: string, mimeType: string, signal?: AbortSignal) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), GENERATED_VIDEO_ARCHIVE_TIMEOUT_MS);
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
        return await copyRelayBasesPublicMedia(apiKey, sourceUrl, { fileName: mediaFileNameFromUrl(sourceUrl, "generated-video.mp4"), contentType: mimeType, signal: controller.signal });
    } catch (error) {
        if (signal?.aborted) throw error;
        return sourceUrl;
    } finally {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
    }
}

async function createOpenAIVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const body = await buildRelayBasesVideoPayload(config, model, prompt, references, videoReferences, audioReferences, options);
    try {
        const isRelayBasesVideo = isRelayBasesVideoModel(model);
        const mode = isRelayBasesVideo ? config.videoCallMode || "sync" : undefined;
        const path = isRelayBasesVideo && mode !== "async" ? "/video/generations" : "/videos";
        const created = unwrapVideoResponse((await axios.post<ApiVideoResponse>(aiApiUrl(config, path), body, { headers: aiHeaders(config, "application/json"), signal: options?.signal })).data);
        const id = created.task_id || created.id;
        if (!id) throw new Error("视频接口没有返回任务 ID");
        return { id, provider: "openai", model, mode };
    } catch (error) {
        throw new Error(readAxiosError(error, "视频任务创建失败"));
    }
}

async function buildRelayBasesVideoPayload(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions) {
    const modelName = modelOptionName(model);
    const images = await Promise.all(references.map((image) => resolveRelayBasesImageUrl(config, image, options)));
    const videos = await Promise.all(videoReferences.map((video) => resolveRelayBasesVideoReferenceUrl(config, video, options)));
    const audios = await Promise.all(audioReferences.map((audio) => resolveRelayBasesAudioReferenceUrl(config, audio, options)));
    const payload: Record<string, unknown> = {
        model: modelName,
        prompt,
        duration: normalizeRelayBasesVideoDuration(config.videoSeconds, modelName),
        aspect_ratio: normalizeRelayBasesAspectRatio(config.size),
    };

    if (modelName === "veo-omni-flash-video-edit") {
        if (!videos[0]) throw new Error("视频编辑需要连接一个参考视频");
        payload.video_url = videos[0];
        if (images.length) payload.Ingredients_images = images.slice(0, 5);
        return payload;
    }

    if (modelName === "veo-omni-flash") {
        if (images.length) payload.Ingredients_images = images.slice(0, 5);
        return payload;
    }

    if (modelName === "video-fast-480p" || modelName === "video-fast-720p" || modelName === "video-pro-480p" || modelName === "video-pro-720p" || modelName === "video-pro-1080p" || modelName === "video-standard-720p") {
        if (images[0]) payload.image_url = images[0];
        if (images.length > 1) payload.extra_images = images.slice(1, 5);
        if (videos.length) payload.extra_videos = videos;
        if (audios.length) payload.extra_audios = audios;
        return payload;
    }

    if (images.length) payload.images = images.slice(0, 5);
    return payload;
}

async function resolveRelayBasesImageUrl(config: AiConfig, image: ReferenceImage, options?: RequestOptions) {
    const directUrl = image.url || image.dataUrl || "";
    if (isPublicMediaUrl(directUrl) || directUrl.startsWith("asset://")) return directUrl;
    const blob = await readRelayBasesImageBlob(image, directUrl);
    return uploadRelayBasesReferenceBlob(config, blob, relayBasesReferenceCacheKey("image", image.storageKey, directUrl, blob), image.name || "reference.png", image.type || blob.type || "image/png", options);
}

async function resolveRelayBasesVideoReferenceUrl(config: AiConfig, video: ReferenceVideo, options?: RequestOptions) {
    const directUrl = video.url || "";
    if (isPublicMediaUrl(directUrl) || directUrl.startsWith("asset://")) return directUrl;
    const blob = await readRelayBasesStoredMediaBlob(video.storageKey, directUrl, "参考视频必须是公网 URL，或重新上传后再生成");
    return uploadRelayBasesReferenceBlob(config, blob, relayBasesReferenceCacheKey("video", video.storageKey, directUrl, blob), video.name || "reference.mp4", video.type || blob.type || "video/mp4", options);
}

async function resolveRelayBasesAudioReferenceUrl(config: AiConfig, audio: ReferenceAudio, options?: RequestOptions) {
    const directUrl = audio.url || "";
    if (isPublicMediaUrl(directUrl) || directUrl.startsWith("asset://")) return directUrl;
    const blob = await readRelayBasesStoredMediaBlob(audio.storageKey, directUrl, "参考音频必须是公网 URL，或重新上传后再生成");
    return uploadRelayBasesReferenceBlob(config, blob, relayBasesReferenceCacheKey("audio", audio.storageKey, directUrl, blob), audio.name || "reference.mp3", audio.type || blob.type || "audio/mpeg", options);
}

async function readRelayBasesImageBlob(image: ReferenceImage, directUrl: string) {
    if (image.storageKey) {
        const stored = await getImageBlob(image.storageKey);
        if (stored) return stored;
    }
    if (directUrl.startsWith("data:") || directUrl.startsWith("blob:")) return (await fetch(directUrl)).blob();
    const dataUrl = await imageToDataUrl(image);
    if (!dataUrl) throw new Error("参考图读取失败，请换一张图片或重新上传");
    return (await fetch(dataUrl)).blob();
}

async function readRelayBasesStoredMediaBlob(storageKey: string | undefined, directUrl: string, emptyMessage: string) {
    if (storageKey) {
        const stored = await getMediaBlob(storageKey);
        if (stored) return stored;
    }
    if (directUrl.startsWith("data:") || directUrl.startsWith("blob:")) return (await fetch(directUrl)).blob();
    throw new Error(emptyMessage);
}

function relayBasesReferenceCacheKey(kind: string, storageKey: string | undefined, directUrl: string, blob: Blob) {
    return storageKey ? `${kind}:storage:${storageKey}:${blob.size}` : `${kind}:inline:${directUrl.slice(0, 128)}:${blob.size}:${blob.type}`;
}

function uploadRelayBasesReferenceBlob(config: AiConfig, blob: Blob, cacheKey: string, fileName: string, contentType: string, options?: RequestOptions) {
    const cached = relayBasesPublicMediaUploads.get(cacheKey);
    if (cached) return cached;
    const upload = uploadRelayBasesPublicMedia(config.apiKey, blob, { fileName, contentType, signal: options?.signal }).catch((error) => {
        relayBasesPublicMediaUploads.delete(cacheKey);
        throw error;
    });
    relayBasesPublicMediaUploads.set(cacheKey, upload);
    return upload;
}

async function compressRelayBasesImageDataUrl(dataUrl: string) {
    if (!dataUrl.startsWith("data:image/") || getDataUrlByteSize(dataUrl) <= RELAYBASES_IMAGE_DATA_URL_LIMIT_BYTES) return dataUrl;

    const image = await loadImageElement(dataUrl);
    const sourceWidth = image.naturalWidth || image.width || 1024;
    const sourceHeight = image.naturalHeight || image.height || 1024;
    const sourceLongEdge = Math.max(sourceWidth, sourceHeight);
    const qualities = [0.82, 0.72, 0.62, 0.52, 0.42, 0.34, 0.26];
    let edge = Math.min(sourceLongEdge, RELAYBASES_IMAGE_MAX_EDGE);
    let smallest = dataUrl;

    while (edge >= RELAYBASES_IMAGE_MIN_EDGE) {
        const scale = Math.min(1, edge / sourceLongEdge);
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));

        for (const quality of qualities) {
            const compressed = await drawImageDataUrl(image, width, height, quality);
            if (getDataUrlByteSize(compressed) < getDataUrlByteSize(smallest)) smallest = compressed;
            if (getDataUrlByteSize(compressed) <= RELAYBASES_IMAGE_DATA_URL_TARGET_BYTES) return compressed;
        }

        edge = Math.floor(edge * 0.78);
    }

    if (getDataUrlByteSize(smallest) <= RELAYBASES_IMAGE_DATA_URL_LIMIT_BYTES) return smallest;
    throw new Error("参考图压缩后仍超过 VEO 500KB 限制，请换一张更小的图，或使用公网图片 URL");
}

function normalizeRelayBasesDuration(value: string, model: string) {
    if (model === "veo-3-1") return 8;
    if (model === "veo-omni-flash" || model === "veo-omni-flash-video-edit") return 10;
    if (model === "video-standard-720p") return 15;
    if (model === "nana-banana-2" || model === "nana-banana-pro") return 4;
    const seconds = Math.floor(Number(value) || 6);
    return Math.max(4, Math.min(15, seconds));
}

function normalizeRelayBasesAspectRatio(value: string) {
    if (!value || value === "auto" || value === "adaptive") return "16:9";
    if (/^\d+:\d+$/.test(value)) return value;
    const match = value.match(/^(\d+)x(\d+)$/);
    if (!match) return "16:9";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "16:9";
    if (width === height) return "1:1";
    return width > height ? "16:9" : "9:16";
}

function readRelayBasesResultUrl(video: VideoResponse) {
    const metadata = video.metadata || {};
    return video.video_url || video.url || video.result_urls?.find(Boolean) || metadata.video_url || metadata.url || metadata.result_urls?.find(Boolean) || video.image_url || metadata.image_url || "";
}

function videoTaskStatuses(video: VideoResponse) {
    return [video.task_status, video.status, video.state]
        .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
        .filter(Boolean);
}

function isOpenAIVideoTaskCompleted(video: VideoResponse) {
    const statuses = videoTaskStatuses(video);
    return statuses.some((status) => status === "completed" || status === "succeeded" || status === "success") || (video.success === true && Boolean(readRelayBasesResultUrl(video)));
}

function isOpenAIVideoTaskFailed(video: VideoResponse) {
    const statuses = videoTaskStatuses(video);
    if (video.success === false) return true;
    if (statuses.some((status) => status.includes("fail") || status.includes("error") || status.includes("cancel") || status.includes("expire"))) return true;
    return Boolean(video.final && !readRelayBasesResultUrl(video));
}

function stringValue(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readOpenAIVideoTaskError(video: VideoResponse) {
    const metadata = video.metadata || {};
    return (
        stringValue(video.error?.message) ||
        stringValue(video.fail_reason) ||
        stringValue(video.failure_reason) ||
        stringValue(video.message) ||
        stringValue(metadata.error) ||
        stringValue(metadata.fail_reason) ||
        stringValue(metadata.failure_reason) ||
        stringValue(metadata.message) ||
        "视频生成失败"
    );
}

async function pollOpenAIVideoTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const video = unwrapVideoResponse((await axios.get<ApiVideoResponse>(aiApiUrl(config, `/videos/${task.id}`), { headers: aiHeaders(config), signal: options?.signal })).data);
        if (isOpenAIVideoTaskCompleted(video)) {
            const url = readRelayBasesResultUrl(video);
            if (!url) return { status: "failed", error: "视频任务完成但没有返回结果 URL" };
            return { status: "completed", result: await videoResultFromUrl(url, options) };
        }
        if (isOpenAIVideoTaskFailed(video)) return { status: "failed", error: readOpenAIVideoTaskError(video) };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "视频任务查询失败"));
    }
}

async function createSeedanceTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    if (audioReferences.length && !references.length && !videoReferences.length) {
        throw new Error("Seedance 参考音频不能单独使用，请同时添加参考图或参考视频");
    }
    assertSeedanceVideoReferences(videoReferences);
    assertSeedanceAudioReferences(audioReferences);
    const content = await buildSeedanceContent(config, prompt, references, videoReferences, audioReferences);
    if (!content.length) throw new Error("请输入视频提示词，或连接参考图片/视频/音频");
    const payload = {
        model: modelOptionName(model),
        content,
        ratio: normalizeSeedanceRatio(config.size),
        resolution: normalizeSeedanceResolution(config.vquality, modelOptionName(model)),
        duration: normalizeSeedanceDuration(config.videoSeconds),
        generate_audio: boolConfig(config.videoGenerateAudio, true),
        watermark: boolConfig(config.videoWatermark, false),
    };

    try {
        const created = unwrapSeedanceTask((await axios.post<ApiEnvelope<SeedanceTask>>(seedanceApiUrl(config), payload, { headers: aiHeaders(config, "application/json"), signal: options?.signal })).data);
        if (!created.id) throw new Error("Seedance 接口没有返回任务 ID");
        return { id: created.id, provider: "seedance", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "Seedance 任务创建失败"));
    }
}

async function pollSeedanceTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const state = unwrapSeedanceTask((await axios.get<ApiEnvelope<SeedanceTask>>(seedanceApiUrl(config, task.id), { headers: aiHeaders(config), signal: options?.signal })).data);
        if (state.status === "succeeded") {
            const url = state.content?.video_url;
            if (!url) return { status: "failed", error: "Seedance 任务成功但没有返回视频 URL" };
            return { status: "completed", result: await videoResultFromUrl(url, options) };
        }
        if (state.status === "failed" || state.status === "cancelled" || state.status === "expired") return { status: "failed", error: state.error?.message || `Seedance 视频生成${state.status === "expired" ? "超时" : "失败"}` };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "Seedance 任务查询失败"));
    }
}

function assertSeedanceVideoReferences(videoReferences: ReferenceVideo[]) {
    const error = seedanceVideoReferenceError(videoReferences);
    if (error) throw new Error(error);
    let total = 0;
    for (const video of videoReferences) {
        if (!video.durationMs) continue;
        if (video.durationMs < 2000 || video.durationMs > 15000) throw new Error("Seedance 参考视频单个时长需要在 2-15 秒之间");
        total += video.durationMs;
    }
    if (total > 15000) throw new Error("Seedance 参考视频总时长不能超过 15 秒");
}

function assertSeedanceAudioReferences(audioReferences: ReferenceAudio[]) {
    let total = 0;
    for (const audio of audioReferences) {
        if (!audio.durationMs) continue;
        if (audio.durationMs < 2000 || audio.durationMs > 15000) throw new Error("Seedance 参考音频单个时长需要在 2-15 秒之间");
        total += audio.durationMs;
    }
    if (total > 15000) throw new Error("Seedance 参考音频总时长不能超过 15 秒");
}

function seedanceApiUrl(config: AiConfig, taskId?: string) {
    return buildApiUrl(config.baseUrl, `/contents/generations/tasks${taskId ? `/${encodeURIComponent(taskId)}` : ""}`);
}

async function buildSeedanceContent(config: AiConfig, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[]) {
    const content: Array<Record<string, unknown>> = [];
    const text = buildSeedancePromptText(prompt, references, videoReferences, audioReferences);
    if (text) content.push({ type: "text", text });
    for (const image of references.slice(0, SEEDANCE_REFERENCE_LIMITS.images)) {
        content.push({ type: "image_url", image_url: { url: await resolveSeedanceImageUrl(config, image) }, role: "reference_image" });
    }
    for (const video of videoReferences.slice(0, SEEDANCE_REFERENCE_LIMITS.videos)) {
        content.push({ type: "video_url", video_url: { url: await resolveSeedanceVideoUrl(video) }, role: "reference_video" });
    }
    for (const audio of audioReferences.slice(0, SEEDANCE_REFERENCE_LIMITS.audios)) {
        content.push({ type: "audio_url", audio_url: { url: await resolveSeedanceAudioUrl(audio) }, role: "reference_audio" });
    }
    return content;
}

async function resolveSeedanceImageUrl(config: AiConfig, image: ReferenceImage) {
    const directUrl = image.url || image.dataUrl;
    if (isPublicMediaUrl(directUrl) || directUrl.startsWith("asset://")) return directUrl;
    const dataUrl = await imageToDataUrl(image);
    if (!dataUrl) throw new Error("参考图读取失败，请换一张图片或重新上传");
    return dataUrl;
}

async function resolveSeedanceVideoUrl(video: ReferenceVideo) {
    if (isPublicMediaUrl(video.url) || video.url.startsWith("asset://")) return video.url;
    let blob: Blob | null = null;
    if (video.storageKey) blob = await getMediaBlob(video.storageKey);
    if (!blob && video.url?.startsWith("blob:")) blob = await (await fetch(video.url)).blob();
    if (!blob) throw new Error("参考视频必须是公网 URL、素材 ID，或本地已保存的视频");
    return blobToDataUrl(blob);
}

async function resolveSeedanceAudioUrl(audio: ReferenceAudio) {
    if (isPublicMediaUrl(audio.url) || audio.url.startsWith("asset://")) return audio.url;
    let blob: Blob | null = null;
    if (audio.storageKey) blob = await getMediaBlob(audio.storageKey);
    if (!blob && audio.url?.startsWith("blob:")) blob = await (await fetch(audio.url)).blob();
    if (!blob) throw new Error("参考音频必须是公网 URL、素材 ID，或本地已保存的音频");
    return blobToDataUrl(blob);
}

async function videoResultFromUrl(url: string, options?: RequestOptions): Promise<VideoGenerationResult> {
    if (/^https?:\/\//i.test(url)) return { url, mimeType: "video/mp4" };
    try {
        const response = await axios.get<Blob>(url, { responseType: "blob", signal: options?.signal });
        await assertVideoBlob(response.data);
        return { blob: response.data };
    } catch (error) {
        if (axios.isCancel(error) || options?.signal?.aborted) throw error;
        return { url, mimeType: "video/mp4" };
    }
}

function assertVideoConfig(config: AiConfig, model: string) {
    if (!model) throw new Error("请先配置视频模型");
    if (!config.baseUrl.trim()) throw new Error("请先完成 RelayBases 配置");
    if (!config.apiKey.trim()) throw new Error("请先配置 API Key");
    if (config.apiFormat === "gemini") throw new Error("Gemini 调用格式暂不支持视频生成，请使用 OpenAI 格式渠道");
}

function unwrapVideoResponse(payload: ApiVideoResponse) {
    return unwrapEnvelope(payload, "接口没有返回视频任务");
}

function unwrapSeedanceTask(payload: ApiEnvelope<SeedanceTask>) {
    return unwrapEnvelope(payload, "Seedance 接口没有返回任务");
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T>, emptyMessage: string): T {
    if (!payload) throw new Error(emptyMessage);
    if (typeof payload === "object" && "code" in payload && typeof payload.code === "number") {
        if (payload.code !== 0) throw new Error(payload.msg || "请求失败");
        if (!payload.data) throw new Error(emptyMessage);
        return payload.data;
    }
    return payload as T;
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isCancel(error)) return "请求已取消";
    if (axios.isAxiosError<{ error?: { message?: string }; msg?: string; code?: number }>(error)) {
        const responseData = error.response?.data;
        return responseData?.msg || responseData?.error?.message || statusMessage(error.response?.status, fallback);
    }
    if (error instanceof DOMException && error.name === "AbortError") return "请求已取消";
    return error instanceof Error ? error.message : fallback;
}

function statusMessage(status: number | undefined, fallback: string) {
    if (status === 401 || status === 403) return "鉴权失败，请检查 API Key、套餐权限或模型权限";
    if (status === 429) return "请求被限流或额度不足，请稍后重试";
    return status ? `${fallback}（${status}）` : fallback;
}

async function assertVideoBlob(blob: Blob) {
    if (!blob.type.includes("json")) return;
    let payload: { code?: number; msg?: string; error?: { message?: string } };
    try {
        payload = JSON.parse(await blob.text()) as { code?: number; msg?: string; error?: { message?: string } };
    } catch {
        return;
    }
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "视频下载失败");
    if (payload.error?.message) throw new Error(payload.error.message);
}

function isPublicMediaUrl(value: string) {
    return /^https?:\/\//i.test(value || "");
}

function mediaFileNameFromUrl(value: string, fallback: string) {
    try {
        const pathname = new URL(value).pathname;
        return pathname.split("/").pop() || fallback;
    } catch {
        return fallback;
    }
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
    });
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取本地素材失败"));
        reader.readAsDataURL(blob);
    });
}

function loadImageElement(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("参考图压缩失败，请换一张图片或重新上传"));
        image.src = src;
    });
}

function drawImageDataUrl(image: HTMLImageElement, width: number, height: number, quality: number) {
    return new Promise<string>((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return resolve(image.src);
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
            (blob) => {
                if (!blob) return resolve(canvas.toDataURL("image/jpeg", quality));
                resolve(blobToDataUrl(blob));
            },
            "image/jpeg",
            quality,
        );
    });
}
