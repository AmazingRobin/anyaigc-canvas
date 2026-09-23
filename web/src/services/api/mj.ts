import axios from "axios";

import { buildMjBlendPayload, buildMjImaginePayload, buildMjPrompt, isMjBlendModel, mediaRequestError } from "@/lib/anyaigc-media-models";
import { workbenchText } from "@/lib/i18n-workbench";
import { imageToDataUrl } from "@/services/image-storage";
import { resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";

type RequestOptions = { signal?: AbortSignal };

/** MJ 提交接口的响应：成功时 code 为 1（注意与项目其他接口的 code 0 相反），任务 ID 在 result。 */
type MjSubmitResponse = { code?: number; description?: string; result?: string; error?: { message?: string } };

type MjFetchResponse = {
    id?: string;
    status?: string;
    progress?: string;
    imageUrl?: string;
    failReason?: string;
    promptEn?: string;
    buttons?: MjButton[];
    error?: { message?: string };
};

export type MjButton = { customId: string; label: string; emoji: string };
export type MjTask = { id: string; model: string };
export type MjResult = { imageUrl: string; taskId: string; buttons: MjButton[]; promptEn?: string };
export type MjTaskState = { status: "pending"; progress?: string } | { status: "completed"; result: MjResult } | { status: "failed"; error: string };
export type MjZoomAction = "ZOOM_OUT_2X" | "ZOOM_OUT_1_5X";

const POLL_ATTEMPTS = 240;
const POLL_DELAY_MS = 3000;

/** MJ 派生操作按钮的 customId 约定：MJ::JOB::<动作>::<序号>::<uuid>。 */
export function findMjUpscaleButtons(buttons: MjButton[] = []) {
    return buttons.filter((button) => button.customId.includes("::upsample::"));
}

export function findMjVariationButtons(buttons: MjButton[] = []) {
    return buttons.filter((button) => button.customId.includes("::variation::"));
}

export function findMjInpaintButton(buttons: MjButton[] = []) {
    return buttons.find((button) => /Inpaint|Vary\s*\(Region\)/i.test(button.label) || button.customId.includes("::Inpaint::"));
}

export function findMjCustomZoomButton(buttons: MjButton[] = []) {
    return buttons.find((button) => /Custom\s*Zoom/i.test(button.label) || button.customId.includes("CustomZoom"));
}

export function hasMjActions(buttons: MjButton[] | undefined) {
    return Boolean(buttons?.length);
}

export async function submitMjImagine(config: AiConfig, prompt: string, references: ReferenceImage[] = [], options?: RequestOptions): Promise<MjTask> {
    const requestConfig = mjRequestConfig(config, references.length);
    if (!prompt.trim()) throw new Error(workbenchText("请先输入提示词", "Enter a prompt first"));
    const base64Array = await Promise.all(references.map((reference) => imageToDataUrl(reference)));
    const payload = buildMjImaginePayload({ prompt, size: requestConfig.size, version: requestConfig.mjVersion, base64Array: base64Array.filter(Boolean) });
    return submit(requestConfig, "/mj/submit/imagine", payload, options);
}

export async function submitMjBlend(config: AiConfig, references: ReferenceImage[], options?: RequestOptions): Promise<MjTask> {
    const requestConfig = mjRequestConfig(config, references.length);
    const base64Array = (await Promise.all(references.map((reference) => imageToDataUrl(reference)))).filter(Boolean);
    return submit(requestConfig, "/mj/submit/blend", buildMjBlendPayload({ base64Array, size: requestConfig.size }), options);
}

/** Upscale / Variation / Reroll 共用：直接执行父任务 buttons 里给出的 customId。 */
export async function submitMjAction(config: AiConfig, model: string, taskId: string, customId: string, options?: RequestOptions): Promise<MjTask> {
    return submit(resolveModelRequestConfig(config, model), "/mj/submit/action", { taskId, customId }, options);
}

export async function submitMjZoom(config: AiConfig, model: string, taskId: string, action: MjZoomAction, options?: RequestOptions): Promise<MjTask> {
    return submit(resolveModelRequestConfig(config, model), "/mj/submit/change", { taskId, action }, options);
}

/**
 * 局部重绘：MJ 要求先点 Vary(Region) 进入 modal 态，再提交蒙版与提示词。
 * 这里把两步串成一次调用，调用方无需感知中间态。
 */
export async function submitMjInpaint(config: AiConfig, model: string, source: MjResult, input: { prompt: string; maskBase64: string }, options?: RequestOptions): Promise<MjTask> {
    const button = findMjInpaintButton(source.buttons);
    if (!button) throw new Error(workbenchText("当前图片不支持局部重绘", "This image does not support inpainting"));
    if (!input.maskBase64) throw new Error(workbenchText("请先在图片上涂抹要重绘的区域", "Mark the area to repaint first"));
    const modal = await submitMjAction(config, model, source.taskId, button.customId, options);
    return submit(resolveModelRequestConfig(config, model), "/mj/submit/modal", { taskId: modal.id, prompt: input.prompt, maskBase64: input.maskBase64 }, options);
}

/** 自定义 Zoom：同样是两步，第二步 prompt 里带 `--zoom <倍数>`。 */
export async function submitMjCustomZoom(config: AiConfig, model: string, source: MjResult, input: { prompt: string; zoom: number }, options?: RequestOptions): Promise<MjTask> {
    const button = findMjCustomZoomButton(source.buttons);
    if (!button) throw new Error(workbenchText("当前图片不支持自定义 Zoom", "This image does not support custom zoom"));
    const modal = await submitMjAction(config, model, source.taskId, button.customId, options);
    const requestConfig = resolveModelRequestConfig(config, model);
    const basePrompt = (input.prompt || source.promptEn || "").replace(/\s*--zoom\s+[\d.]+/gi, "").trim();
    const zoom = Math.min(2, Math.max(1, Number(input.zoom) || 2));
    // 版本参数与 imagine 保持一致，避免派生结果回退到账号默认版本
    const prompt = `${buildMjPrompt(basePrompt, "auto", requestConfig.mjVersion)} --zoom ${zoom}`.trim();
    return submit(requestConfig, "/mj/submit/modal", { taskId: modal.id, prompt }, options);
}

export async function pollMjTask(config: AiConfig, task: MjTask, options?: RequestOptions): Promise<MjTaskState> {
    const requestConfig = resolveModelRequestConfig(config, task.model);
    try {
        const response = await axios.get<MjFetchResponse>(mjApiUrl(requestConfig, `/mj/task/${encodeURIComponent(task.id)}/fetch`), { headers: mjHeaders(requestConfig), signal: options?.signal });
        const payload = response.data;
        const status = (payload.status || "").trim().toUpperCase();
        if (status === "SUCCESS") {
            if (!payload.imageUrl) return { status: "failed", error: workbenchText("MJ 任务完成但没有返回图片", "The completed MJ task returned no image") };
            return { status: "completed", result: { imageUrl: payload.imageUrl, taskId: payload.id || task.id, buttons: payload.buttons || [], promptEn: payload.promptEn } };
        }
        if (status === "FAILURE" || status === "CANCEL") return { status: "failed", error: payload.failReason || workbenchText("MJ 生成失败", "MJ generation failed") };
        return { status: "pending", progress: payload.progress };
    } catch (error) {
        throw new Error(readMjError(error, workbenchText("MJ 任务查询失败", "Failed to query the MJ task")));
    }
}

/** 提交后轮询到出图，超时不代表失败，任务仍在 MJ 队列中。 */
export async function waitForMjTask(config: AiConfig, task: MjTask, options?: RequestOptions): Promise<MjResult> {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const state = await pollMjTask(config, task, options);
        if (state.status === "completed") return state.result;
        if (state.status === "failed") throw new Error(state.error);
        await delay(POLL_DELAY_MS, options?.signal);
    }
    throw new Error(workbenchText("MJ 任务仍在排队或生成中，请稍后在历史记录中继续查看", "The MJ task is still pending. Check the generation history again later."));
}

export async function requestMjImage(config: AiConfig, prompt: string, references: ReferenceImage[] = [], options?: RequestOptions): Promise<MjResult> {
    const model = config.model || config.imageModel;
    const task = isMjBlendModel(model) ? await submitMjBlend(config, references, options) : await submitMjImagine(config, prompt, references, options);
    return waitForMjTask(config, task, options);
}

function mjRequestConfig(config: AiConfig, imageCount: number) {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.imageModel);
    if (!requestConfig.apiKey.trim()) throw new Error(workbenchText("请先配置媒体 API Key", "Configure a media API key first"));
    const validationError = mediaRequestError(requestConfig.model, { imageCount });
    if (validationError) throw new Error(validationError);
    return requestConfig;
}

async function submit(config: AiConfig, path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<MjTask> {
    try {
        const response = await axios.post<MjSubmitResponse>(mjApiUrl(config, path), payload, { headers: mjHeaders(config, "application/json"), signal: options?.signal });
        return { id: readMjTaskId(response.data), model: config.model };
    } catch (error) {
        throw new Error(readMjError(error, workbenchText("MJ 任务创建失败", "Failed to create the MJ task")));
    }
}

/** MJ 提交成功时 code 为 1、任务 ID 在 result；非 1 且无 result 视为失败。 */
function readMjTaskId(payload: MjSubmitResponse) {
    if (payload.result) return payload.result;
    throw new Error(payload.error?.message || payload.description || workbenchText("MJ 接口没有返回任务 ID", "The MJ API returned no task ID"));
}

/**
 * MJ 端点挂在域名根路径下（`https://anyaigc.ai/mj/submit/imagine`），不带 `/v1`，
 * 所以不能用 buildApiUrl（它会统一补 `/v1`）。这里去掉 baseUrl 末尾的 API 版本段，保留自建代理的子路径。
 */
function mjApiUrl(config: AiConfig, path: string) {
    const baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    return `${baseUrl.replace(/\/(?:v1|api\/v3|api\/plan\/v3)$/i, "")}${path}`;
}

function mjHeaders(config: AiConfig, contentType?: string) {
    return { Authorization: `Bearer ${config.apiKey}`, ...(contentType ? { "Content-Type": contentType } : {}) };
}

function readMjError(error: unknown, fallback: string) {
    if (axios.isCancel(error)) return workbenchText("请求已取消", "Request cancelled");
    if (axios.isAxiosError<{ error?: { message?: string }; description?: string }>(error)) {
        const data = error.response?.data;
        if (error.response?.status === 401 || error.response?.status === 403) return workbenchText("鉴权失败，请检查 API Key、套餐权限或模型权限", "Authentication failed. Check the API key, plan, or model permissions.");
        return data?.error?.message || data?.description || (error.response?.status ? `${fallback} (${error.response.status})` : fallback);
    }
    if (error instanceof DOMException && error.name === "AbortError") return workbenchText("请求已取消", "Request cancelled");
    return error instanceof Error ? error.message : fallback;
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
    });
}
