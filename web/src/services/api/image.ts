import axios from "axios";

import { buildApiUrl, modelOptionName, resolveModelRequestConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";
import { nanoid } from "nanoid";
import { AZURE_IMAGE_MASK_MAX_BYTES, dataUrlToFile, validateAzureImageEditFile } from "@/lib/image-utils";
import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { workbenchText } from "@/lib/i18n-workbench";
import { isGeminiImageModel, isGrokImageModel, mediaRequestError } from "@/lib/anyaigc-media-models";
import { imageToDataUrl } from "@/services/image-storage";
import type { ReferenceImage } from "@/types/image";

export type AiTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

export type ResponseToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    thoughtSignature?: string;
};

export type ResponseInputMessage = AiTextMessage | { type: "function_call"; call_id: string; name: string; arguments: string; thoughtSignature?: string } | { role: "tool"; tool_call_id: string; content: string };

export type ResponseFunctionTool = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
        strict?: boolean;
    };
};

export type ToolResponseResult = {
    content: string;
    toolCalls: ResponseToolCall[];
};

type ToolChoice = "auto" | "required" | { type: "function"; name: string };
type ResponseMessageContent = AiTextMessage["content"] | string;
type ResponseInputContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };
type ResponseInputItem = { role: "system" | "user" | "assistant"; content: string | ResponseInputContent[] } | { type: "function_call"; call_id: string; name: string; arguments: string } | { type: "function_call_output"; call_id: string; output: string };
type ResponseApiToolDefinition = {
    type: "function";
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
};
type ResponseApiOutputItem = { type?: "message"; content?: Array<{ type?: string; text?: string }> } | { type?: "function_call"; id?: string; call_id?: string; name?: string; arguments?: string };
type ResponseApiPayload = {
    id?: string;
    output?: ResponseApiOutputItem[];
    output_text?: string;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type ResponseStreamState = { buffer: string; text: string; toolCalls: ResponseToolCall[]; toolCallIndexes: Record<string, number>; payload?: ResponseApiPayload; error?: string };

type ImageApiResponse = {
    data?: Array<Record<string, unknown>>;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type GeminiPart = {
    text?: string;
    inlineData?: { mimeType?: string; data?: string };
    inline_data?: { mime_type?: string; mimeType?: string; data?: string };
    fileData?: { mimeType?: string; fileUri?: string };
    functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
    functionResponse?: { id?: string; name?: string; response?: Record<string, unknown> };
    thoughtSignature?: string;
    thought_signature?: string;
};
type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };
type GeminiPayload = {
    candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
    models?: Array<{ name?: string }>;
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
};
type GeminiStreamState = { buffer: string; text: string; toolCalls: ResponseToolCall[]; error?: string };
type RequestOptions = { signal?: AbortSignal };

const QUALITY_BASE: Record<string, number> = {
    low: 1024,
    medium: 2048,
    high: 2880,
    standard: 1024,
    hd: 2048,
};
const QUALITY_ALIASES: Record<string, string> = {
    "1k": "low",
    "2k": "medium",
    "4k": "high",
};
const DEFAULT_IMAGE_SHORT_SIDE = 1024;
const IMAGE_SIZE_STEP = 16;
const IMAGE_MIN_PIXELS = 655360;
const IMAGE_MAX_PIXELS = 8294400;
const IMAGE_MAX_EDGE = 3840;
const IMAGE_MAX_RATIO = 3;
const IMAGE_OUTPUT_FORMAT = "png";
const GEMINI_IMAGE_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "1:8", "4:1", "8:1"];
const GEMINI_IMAGE_SIZES = [
    { value: "1K", longEdge: 1024 },
    { value: "2K", longEdge: 2048 },
    { value: "4K", longEdge: 4096 },
];
const GROK_IMAGE_SIZES = [
    { value: "960x960", width: 960, height: 960 },
    { value: "720x1280", width: 720, height: 1280 },
    { value: "1280x720", width: 1280, height: 720 },
    { value: "1168x784", width: 1168, height: 784 },
    { value: "784x1168", width: 784, height: 1168 },
];
const GROK_IMAGE_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "9:19.5", "19.5:9", "9:20", "20:9", "1:2", "2:1", "auto"];

function normalizeQuality(quality: string) {
    const value = quality.trim().toLowerCase();
    const normalized = QUALITY_ALIASES[value] || value;
    return QUALITY_BASE[normalized] ? normalized : undefined;
}

/** Map "quality + ratio" to an explicit pixel dimension like "3840x2160". */
function resolveSize(quality: string | undefined, ratio: string): string {
    const parsedRatio = parseImageRatio(ratio);
    const basePixels = quality ? QUALITY_BASE[quality] : undefined;
    const isLandscape = parsedRatio.width >= parsedRatio.height;
    const longRatio = isLandscape ? parsedRatio.width / parsedRatio.height : parsedRatio.height / parsedRatio.width;
    let longSide: number;
    let shortSide: number;

    if (basePixels) {
        const targetPixels = basePixels * basePixels;
        const longSideRaw = Math.sqrt(targetPixels * longRatio);
        longSide = Math.floor(longSideRaw / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
        shortSide = Math.round(longSide / longRatio / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    } else {
        shortSide = DEFAULT_IMAGE_SHORT_SIDE;
        longSide = Math.round((shortSide * longRatio) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    }

    const width = isLandscape ? longSide : shortSide;
    const height = isLandscape ? shortSide : longSide;
    validateImageSize(width, height);
    return `${width}x${height}`;
}

function parseImageRatio(value: string) {
    const parts = value.split(":");
    if (parts.length !== 2) throw new Error(workbenchText("图像尺寸格式不支持，请使用 auto、9:16 或 1024x1024"));
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error(workbenchText("图像比例必须是正数，例如 9:16"));
    if (Math.max(w, h) / Math.min(w, h) > IMAGE_MAX_RATIO) throw new Error(workbenchText("图像宽高比不能超过 3:1，请调整尺寸"));
    return { width: w, height: h };
}

function parseImageDimensions(value: string) {
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
}

function validateImageSize(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error(workbenchText("图像尺寸必须是正整数，例如 1024x1024"));
    if (width % IMAGE_SIZE_STEP !== 0 || height % IMAGE_SIZE_STEP !== 0) throw new Error(workbenchText("图像尺寸的宽高必须是 16 的倍数，请调整尺寸"));
    if (Math.max(width, height) > IMAGE_MAX_EDGE) throw new Error(workbenchText("图像尺寸最长边不能超过 3840px，请调整尺寸"));
    if (Math.max(width, height) / Math.min(width, height) > IMAGE_MAX_RATIO) throw new Error(workbenchText("图像宽高比不能超过 3:1，请调整尺寸"));
    const pixels = width * height;
    if (pixels < IMAGE_MIN_PIXELS || pixels > IMAGE_MAX_PIXELS) throw new Error(workbenchText("图像总像素需在 655360 到 8294400 之间，请调整尺寸"));
}

function resolveRequestSize(quality: string | undefined, size: string) {
    const value = size.trim();
    if (!value || value.toLowerCase() === "auto") return undefined;
    const dimensions = parseImageDimensions(value);
    if (dimensions) {
        validateImageSize(dimensions.width, dimensions.height);
        return `${dimensions.width}x${dimensions.height}`;
    }
    if (value.includes(":")) return resolveSize(quality, value);
    throw new Error(workbenchText("图像尺寸格式不支持，请使用 auto、9:16 或 1024x1024"));
}

function closestGeminiAspectRatio(width: number, height: number) {
    const ratio = width / height;
    return GEMINI_IMAGE_ASPECT_RATIOS.reduce((closest, value) => {
        const [candidateWidth, candidateHeight] = value.split(":").map(Number);
        return Math.abs(Math.log(ratio) - Math.log(candidateWidth / candidateHeight)) < Math.abs(Math.log(ratio) - Math.log(closest.width / closest.height)) ? { value, width: candidateWidth, height: candidateHeight } : closest;
    }, { value: "1:1", width: 1, height: 1 }).value;
}

function closestGeminiImageSize(width: number, height: number) {
    const longestEdge = Math.max(width, height);
    return GEMINI_IMAGE_SIZES.reduce((closest, value) => Math.abs(longestEdge - value.longEdge) < Math.abs(longestEdge - closest.longEdge) ? value : closest).value;
}

function geminiImageConfig(config: AiConfig) {
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    if (requestSize) {
        const dimensions = parseImageDimensions(requestSize);
        if (!dimensions) return undefined;
        return { aspectRatio: closestGeminiAspectRatio(dimensions.width, dimensions.height), imageSize: closestGeminiImageSize(dimensions.width, dimensions.height) };
    }
    if (quality === "low") return { imageSize: "1K" };
    if (quality === "medium") return { imageSize: "2K" };
    if (quality === "high") return { imageSize: "4K" };
    return undefined;
}

function grokImageOptions(config: AiConfig, n: number) {
    const quality = normalizeQuality(config.quality) || "medium";
    const requestSize = resolveRequestSize(quality, config.size) || "960x960";
    const dimensions = parseImageDimensions(requestSize) || { width: 960, height: 960 };
    const size = GROK_IMAGE_SIZES.reduce((closest, value) => Math.abs(Math.log(dimensions.width / dimensions.height) - Math.log(value.width / value.height)) < Math.abs(Math.log(dimensions.width / dimensions.height) - Math.log(closest.width / closest.height)) ? value : closest).value;
    const ratio = dimensions.width / dimensions.height;
    const normalizedAspectRatio = GROK_IMAGE_ASPECT_RATIOS.filter((value) => value !== "auto").reduce((closest, value) => {
        const [width, height] = value.split(":").map(Number);
        return Math.abs(Math.log(ratio) - Math.log(width / height)) < Math.abs(Math.log(ratio) - Math.log(closest.width / closest.height)) ? { value, width, height } : closest;
    }, { value: "1:1", width: 1, height: 1 }).value;
    const resolution = quality === "high" ? "2k" : "1k";
    return { size, aspectRatio: Array.from({ length: n }, () => normalizedAspectRatio), quality: Array.from({ length: n }, () => quality), resolution: Array.from({ length: n }, () => resolution) };
}

function resolveImageDataUrl(item: Record<string, unknown>) {
    if (typeof item.b64_json === "string" && item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }
    if (typeof item.url === "string" && item.url) {
        return item.url;
    }
    return null;
}

function parseImagePayload(payload: ImageApiResponse) {
    if (typeof payload.code === "number" && payload.code !== 0) {
        throw new Error(payload.msg || workbenchText("请求失败"));
    }
    const images =
        payload.data
            ?.map(resolveImageDataUrl)
            .filter((value): value is string => Boolean(value))
            .map((dataUrl) => ({ id: nanoid(), dataUrl })) || [];

    if (images.length === 0) {
        throw new Error(workbenchText("接口没有返回图片"));
    }

    return images;
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isCancel(error)) return workbenchText("请求已取消");
    if (axios.isAxiosError<{ error?: { message?: string }; msg?: string; code?: number }>(error)) {
        const responseData = error.response?.data;
        return responseData?.msg || responseData?.error?.message || readStatusError(error.response?.status, fallback);
    }
    if (error instanceof DOMException && error.name === "AbortError") return workbenchText("请求已取消");
    return error instanceof Error ? error.message : fallback;
}


function readStatusError(status: number | undefined, fallback: string) {
    if (status === 401 || status === 403) return workbenchText("鉴权失败，请检查 API Key、套餐权限或模型权限");
    if (status === 429) return workbenchText("请求被限流或额度不足，请稍后重试");
    return status ? `${fallback}：${status}` : fallback;
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
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

function geminiBaseUrl(config: Pick<AiConfig, "baseUrl">) {
    const normalizedBaseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    return lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/v1beta") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1beta`;
}

function geminiModelName(model: string) {
    return model.trim().replace(/^models\//, "");
}

function geminiApiUrl(config: Pick<AiConfig, "baseUrl" | "model">, action?: "generateContent" | "streamGenerateContent") {
    const baseUrl = geminiBaseUrl(config);
    if (!action) return `${baseUrl}/models`;
    return `${baseUrl}/models/${encodeURIComponent(geminiModelName(config.model))}:${action}`;
}

function geminiHeaders(config: Pick<AiConfig, "apiKey">) {
    return {
        "x-goog-api-key": config.apiKey,
        "Content-Type": "application/json",
    };
}

function withSystemMessage<T extends ResponseInputMessage>(config: AiConfig, messages: T[]): ResponseInputMessage[] {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? [{ role: "system" as const, content: systemPrompt }, ...messages] : messages;
}

function toResponseInput(messages: ResponseInputMessage[]): ResponseInputItem[] {
    return messages.flatMap((message): ResponseInputItem[] => {
        if ("type" in message) return [message];
        if (message.role === "tool") return [{ type: "function_call_output", call_id: message.tool_call_id, output: message.content }];
        return [{ role: message.role, content: toResponseContent(message.content || "") }];
    });
}

function toResponseContent(content: ResponseMessageContent): string | ResponseInputContent[] {
    if (!Array.isArray(content)) return String(content || "");
    return content.map((item) => (item.type === "text" ? { type: "input_text" as const, text: item.text } : { type: "input_image" as const, image_url: item.image_url.url }));
}

function toResponseTool(tool: ResponseFunctionTool): ResponseApiToolDefinition {
    return {
        type: "function",
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
    };
}

function parseToolResponse(payload: ResponseApiPayload): ToolResponseResult {
    const output = payload.output || [];
    const content =
        payload.output_text ||
        output
            .flatMap((item) => (item.type === "message" ? item.content || [] : []))
            .map((item) => item.text || "")
            .join("");
    const toolCalls = output
        .filter((item): item is Extract<ResponseApiOutputItem, { type?: "function_call" }> => item.type === "function_call")
        .map((item) => ({
            id: item.call_id || item.id || "",
            type: "function" as const,
            function: { name: item.name || "", arguments: item.arguments || "{}" },
        }))
        .filter((item) => item.id && item.function.name);
    return { content, toolCalls };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function responseErrorMessage(value: unknown) {
    if (!isRecord(value)) return "";
    const error = isRecord(value.error) ? value.error : undefined;
    const response = isRecord(value.response) ? value.response : undefined;
    const responseError = response && isRecord(response.error) ? response.error : undefined;
    return stringValue(value.msg) || stringValue(error?.message) || stringValue(responseError?.message);
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : "";
}

function validateResponsePayload(payload: ResponseApiPayload) {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || workbenchText("请求失败"));
    if (payload.error?.message) throw new Error(payload.error.message);
}

function validateGeminiPayload(payload: GeminiPayload) {
    if (payload.error?.message) throw new Error(payload.error.message);
    if (payload.promptFeedback?.blockReason) throw new Error(workbenchText(`Gemini 拒绝了本次请求：${payload.promptFeedback.blockReason}`, `Gemini rejected this request: ${payload.promptFeedback.blockReason}`));
}

function responseStreamKey(value: unknown) {
    if (typeof value === "number") return String(value);
    return typeof value === "string" && value ? value : "";
}

function uniqueStreamKeys(keys: string[]) {
    return Array.from(new Set(keys.filter(Boolean)));
}

function responseStreamToolCallKeys(item: Record<string, unknown>, extraKeys: string[] = []) {
    return uniqueStreamKeys([...extraKeys, responseStreamKey(item.call_id), responseStreamKey(item.id), responseStreamKey(item.item_id), responseStreamKey(item.output_index)]);
}

function findResponseStreamToolCallIndex(state: ResponseStreamState, keys: string[]) {
    for (const key of keys) {
        const index = state.toolCallIndexes[key];
        if (typeof index === "number") return index;
    }
    return -1;
}

function rememberResponseStreamToolCallKeys(state: ResponseStreamState, index: number, keys: string[]) {
    keys.forEach((key) => {
        state.toolCallIndexes[key] = index;
    });
}

function upsertResponseStreamToolCall(state: ResponseStreamState, item: Record<string, unknown>, extraKeys: string[] = []) {
    const keys = responseStreamToolCallKeys(item, extraKeys);
    const index = findResponseStreamToolCallIndex(state, keys);
    const id = stringValue(item.call_id) || stringValue(item.id) || keys[0] || nanoid();
    const name = stringValue(item.name);
    const args = typeof item.arguments === "string" ? item.arguments : undefined;
    if (index >= 0) {
        const current = state.toolCalls[index];
        state.toolCalls[index] = {
            ...current,
            id: current.id || id,
            function: {
                name: current.function.name || name,
                arguments: args ?? current.function.arguments,
            },
        };
        rememberResponseStreamToolCallKeys(state, index, [...keys, id]);
        return state.toolCalls[index];
    }
    const toolCall: ResponseToolCall = { id, type: "function", function: { name, arguments: args ?? "" } };
    state.toolCalls.push(toolCall);
    rememberResponseStreamToolCallKeys(state, state.toolCalls.length - 1, [...keys, id]);
    return toolCall;
}

function appendResponseStreamToolCallArguments(state: ResponseStreamState, event: Record<string, unknown>) {
    const keys = uniqueStreamKeys([responseStreamKey(event.call_id), responseStreamKey(event.item_id), responseStreamKey(event.output_index)]);
    const index = findResponseStreamToolCallIndex(state, keys);
    const delta = typeof event.delta === "string" ? event.delta : "";
    if (!delta) return;
    if (index >= 0) {
        const current = state.toolCalls[index];
        state.toolCalls[index] = { ...current, function: { ...current.function, arguments: `${current.function.arguments || ""}${delta}` } };
        return;
    }
    upsertResponseStreamToolCall(state, { call_id: keys[0] || nanoid(), arguments: delta }, keys);
}

function setResponseStreamToolCallArguments(state: ResponseStreamState, event: Record<string, unknown>) {
    const args = typeof event.arguments === "string" ? event.arguments : "";
    if (!args) return;
    const keys = uniqueStreamKeys([responseStreamKey(event.call_id), responseStreamKey(event.item_id), responseStreamKey(event.output_index)]);
    const index = findResponseStreamToolCallIndex(state, keys);
    if (index >= 0) {
        const current = state.toolCalls[index];
        state.toolCalls[index] = { ...current, function: { ...current.function, arguments: args } };
        return;
    }
    upsertResponseStreamToolCall(state, { call_id: keys[0] || nanoid(), arguments: args }, keys);
}

function finalResponseStreamToolCalls(state: ResponseStreamState) {
    return state.toolCalls.filter((item) => item.id && item.function.name);
}

function mergeToolCalls(primary: ResponseToolCall[], secondary: ResponseToolCall[]) {
    const seen = new Set<string>();
    return [...primary, ...secondary].filter((item) => {
        const key = item.id || `${item.function.name}:${item.function.arguments}`;
        if (!item.function.name || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function readFetchError(response: Response, fallback: string) {
    const text = await response.text();
    if (!text) return readStatusError(response.status, fallback);
    try {
        return responseErrorMessage(JSON.parse(text)) || readStatusError(response.status, fallback);
    } catch {
        return text.slice(0, 300) || readStatusError(response.status, fallback);
    }
}

function consumeResponseStreamBlock(block: string, state: ResponseStreamState, onDelta?: (text: string) => void) {
    const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n")
        .trim();
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data) as Record<string, unknown>;
    const type = stringValue(event.type);
    const errorMessage = responseErrorMessage(event);
    if (errorMessage) state.error = errorMessage;
    if (type === "response.output_text.delta" && typeof event.delta === "string") {
        state.text += event.delta;
        onDelta?.(state.text);
    }
    if (type === "response.output_text.done" && !state.text && typeof event.text === "string") {
        state.text = event.text;
        onDelta?.(state.text);
    }
    const item = isRecord(event.item) ? event.item : undefined;
    if (item?.type === "function_call") {
        upsertResponseStreamToolCall(state, item, [responseStreamKey(event.item_id), responseStreamKey(event.output_index)]);
    }
    if (type === "response.function_call_arguments.delta") {
        appendResponseStreamToolCallArguments(state, event);
    }
    if (type === "response.function_call_arguments.done") {
        setResponseStreamToolCallArguments(state, event);
    }
    if (type === "response.completed" && isRecord(event.response)) {
        state.payload = event.response as ResponseApiPayload;
    } else if (Array.isArray(event.output)) {
        state.payload = event as ResponseApiPayload;
    }
}

function consumeResponseStreamText(state: ResponseStreamState, text: string, onDelta?: (text: string) => void, flush = false) {
    state.buffer += text;
    for (;;) {
        const match = state.buffer.match(/\r?\n\r?\n/);
        if (!match) break;
        const index = match.index ?? 0;
        consumeResponseStreamBlock(state.buffer.slice(0, index), state, onDelta);
        state.buffer = state.buffer.slice(index + match[0].length);
    }
    if (flush && state.buffer.trim()) {
        consumeResponseStreamBlock(state.buffer, state, onDelta);
        state.buffer = "";
    }
}

async function requestStreamingResponse(config: AiConfig, body: Record<string, unknown>, onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const response = await fetch(aiApiUrl(config, "/responses"), {
        method: "POST",
        headers: { ...aiHeaders(config, "application/json"), Accept: "text/event-stream" },
        body: JSON.stringify({ ...body, stream: true }),
        signal: options?.signal,
    });
    if (!response.ok) throw new Error(await readFetchError(response, workbenchText("请求失败")));
    if (!response.body) {
        const payload = (await response.json()) as ResponseApiPayload;
        validateResponsePayload(payload);
        return parseToolResponse(payload);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: ResponseStreamState = { buffer: "", text: "", toolCalls: [], toolCallIndexes: {} };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        consumeResponseStreamText(state, decoder.decode(value, { stream: true }), onDelta);
        if (state.error) throw new Error(state.error);
    }
    consumeResponseStreamText(state, decoder.decode(), onDelta, true);
    if (state.error) throw new Error(state.error);
    if (!state.payload) return { content: state.text, toolCalls: finalResponseStreamToolCalls(state) };
    validateResponsePayload(state.payload);
    const result = parseToolResponse(state.payload);
    return { ...result, content: state.text || result.content, toolCalls: mergeToolCalls(result.toolCalls, finalResponseStreamToolCalls(state)) };
}

function toGeminiBody(config: AiConfig, messages: ResponseInputMessage[], extra?: Record<string, unknown>) {
    const systemText = [config.systemPrompt.trim(), ...messages.flatMap((message) => (!("type" in message) && message.role === "system" ? [geminiTextContent(message.content)] : []))].filter(Boolean).join("\n\n");
    const contents = toGeminiContents(messages.filter((message) => ("type" in message ? true : message.role !== "system")));
    return {
        contents,
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        ...extra,
    };
}

function toGeminiContents(messages: ResponseInputMessage[]): GeminiContent[] {
    const callNameById = new Map<string, string>();
    return messages.flatMap((message): GeminiContent[] => {
        if ("type" in message) {
            callNameById.set(message.call_id, message.name);
            return [{ role: "model", parts: [{ functionCall: { id: message.call_id, name: message.name, args: jsonObject(message.arguments) }, ...(message.thoughtSignature ? { thoughtSignature: message.thoughtSignature } : {}) }] }];
        }
        if (message.role === "tool") {
            const name = callNameById.get(message.tool_call_id) || "tool_result";
            return [{ role: "user", parts: [{ functionResponse: { id: message.tool_call_id, name, response: { result: jsonValue(message.content) } } }] }];
        }
        return [{ role: message.role === "assistant" ? "model" : "user", parts: toGeminiParts(message.content) }];
    });
}

function toGeminiParts(content: ResponseMessageContent): GeminiPart[] {
    if (!Array.isArray(content)) return [{ text: String(content || "") }];
    return content.map((item) => (item.type === "text" ? { text: item.text } : toGeminiImagePart(item.image_url.url)));
}

function toGeminiImagePart(url: string): GeminiPart {
    const match = url.match(/^data:([^;,]+);base64,(.+)$/);
    if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
    return { fileData: { fileUri: url, mimeType: "image/png" } };
}

function geminiTextContent(content: ResponseMessageContent) {
    if (!Array.isArray(content)) return String(content || "");
    return content.map((item) => (item.type === "text" ? item.text : item.image_url.url)).join("\n");
}

function jsonObject(value: string): Record<string, unknown> {
    const parsed = jsonValue(value);
    return isRecord(parsed) ? parsed : {};
}

function jsonValue(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function toGeminiToolOptions(tools: ResponseFunctionTool[], toolChoice: ToolChoice) {
    if (!tools.length) return {};
    const functionDeclarations = tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
    }));
    const functionCallingConfig = typeof toolChoice === "object" ? { mode: "ANY", allowedFunctionNames: [toolChoice.name] } : { mode: toolChoice === "required" ? "ANY" : "AUTO" };
    return {
        tools: [{ functionDeclarations }],
        toolConfig: { functionCallingConfig },
    };
}

async function requestGeminiStreamingResponse(config: AiConfig, body: Record<string, unknown>, onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const response = await fetch(`${geminiApiUrl(config, "streamGenerateContent")}?alt=sse`, {
        method: "POST",
        headers: geminiHeaders(config),
        body: JSON.stringify(body),
        signal: options?.signal,
    });
    if (!response.ok) throw new Error(await readFetchError(response, workbenchText("请求失败")));
    if (!response.body) {
        const payload = (await response.json()) as GeminiPayload;
        return parseGeminiToolResponse(payload);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: GeminiStreamState = { buffer: "", text: "", toolCalls: [] };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        consumeGeminiStreamText(state, decoder.decode(value, { stream: true }), onDelta);
        if (state.error) throw new Error(state.error);
    }
    consumeGeminiStreamText(state, decoder.decode(), onDelta, true);
    if (state.error) throw new Error(state.error);
    return { content: state.text, toolCalls: state.toolCalls };
}

function consumeGeminiStreamText(state: GeminiStreamState, text: string, onDelta?: (text: string) => void, flush = false) {
    state.buffer += text;
    for (;;) {
        const match = state.buffer.match(/\r?\n\r?\n/);
        if (!match) break;
        const index = match.index ?? 0;
        consumeGeminiStreamBlock(state.buffer.slice(0, index), state, onDelta);
        state.buffer = state.buffer.slice(index + match[0].length);
    }
    if (flush && state.buffer.trim()) {
        consumeGeminiStreamBlock(state.buffer, state, onDelta);
        state.buffer = "";
    }
}

function consumeGeminiStreamBlock(block: string, state: GeminiStreamState, onDelta?: (text: string) => void) {
    const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n")
        .trim();
    if (!data || data === "[DONE]") return;
    const result = parseGeminiToolResponse(JSON.parse(data) as GeminiPayload);
    if (result.content) {
        state.text += result.content;
        onDelta?.(state.text);
    }
    state.toolCalls.push(...result.toolCalls);
}

function parseGeminiToolResponse(payload: GeminiPayload): ToolResponseResult {
    validateGeminiPayload(payload);
    const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
    const content = parts.map((part) => part.text || "").join("");
    const toolCalls = parts
        .map((part) => part.functionCall)
        .filter((call): call is NonNullable<GeminiPart["functionCall"]> => Boolean(call?.name))
        .map((call) => {
            const part = parts.find((item) => item.functionCall === call);
            const thoughtSignature = part?.thoughtSignature || part?.thought_signature;
            return {
                id: call.id || nanoid(),
                type: "function" as const,
                function: { name: call.name || "", arguments: JSON.stringify(call.args || {}) },
                ...(thoughtSignature ? { thoughtSignature } : {}),
            };
        });
    return { content, toolCalls };
}

async function requestGeminiImages(config: AiConfig, prompt: string, references: ReferenceImage[], count: number, options?: RequestOptions) {
    const requests = Array.from({ length: count }, () => requestGeminiImagesOnce(config, prompt, references, options));
    return (await Promise.all(requests)).flat();
}

async function requestGeminiImagesOnce(config: AiConfig, prompt: string, references: ReferenceImage[], options?: RequestOptions) {
    const parts: GeminiPart[] = [{ text: prompt }];
    for (const image of references) {
        parts.push(toGeminiImagePart(await imageToDataUrl(image)));
    }
    const imageConfig = geminiImageConfig(config);
    const response = await axios.post<GeminiPayload>(
        geminiApiUrl(config, "generateContent"),
        {
            ...toGeminiBody(config, [{ role: "user", content: prompt }], { generationConfig: { responseModalities: ["TEXT", "IMAGE"], ...(imageConfig ? { imageConfig } : {}) } }),
            contents: [{ role: "user", parts }],
        },
        { headers: geminiHeaders(config), signal: options?.signal },
    );
    return parseGeminiImagePayload(response.data);
}

function parseGeminiImagePayload(payload: GeminiPayload) {
    validateGeminiPayload(payload);
    const images =
        payload.candidates
            ?.flatMap((candidate) => candidate.content?.parts || [])
            .map((part) => {
                const inlineData = part.inlineData || (part.inline_data ? { mimeType: part.inline_data.mimeType || part.inline_data.mime_type, data: part.inline_data.data } : undefined);
                if (inlineData?.data) return `data:${inlineData.mimeType || "image/png"};base64,${inlineData.data}`;
                return part.fileData?.fileUri || null;
            })
            .filter((value): value is string => Boolean(value))
            .map((dataUrl) => ({ id: nanoid(), dataUrl })) || [];
    if (!images.length) throw new Error(workbenchText("Gemini 接口没有返回图片", "The Gemini API returned no image"));
    return images;
}

export async function requestGeneration(config: AiConfig, prompt: string, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.imageModel);
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const capabilityError = mediaRequestError(requestConfig.model, { imageCount: 0 });
    if (capabilityError) throw new Error(capabilityError);
    if (isGeminiImageModel(requestConfig.model)) {
        try {
            return await requestGeminiImages(requestConfig, prompt, [], n, options);
        } catch (error) {
            throw new Error(readAxiosError(error, workbenchText("请求失败")));
        }
    }
    if (isGrokImageModel(requestConfig.model)) {
        const grokN = Math.min(10, n);
        const grok = grokImageOptions(requestConfig, grokN);
        try {
            const response = await axios.post<ImageApiResponse>(
                aiApiUrl(requestConfig, "/images/generations"),
                { model: requestConfig.model, prompt: withSystemPrompt(requestConfig, prompt), size: grok.size, aspect_ratio: grok.aspectRatio, n: grokN, quality: grok.quality, resolution: grok.resolution, response_format: "b64_json" },
                { headers: aiHeaders(requestConfig, "application/json"), signal: options?.signal },
            );
            return parseImagePayload(response.data);
        } catch (error) {
            throw new Error(readAxiosError(error, workbenchText("请求失败")));
        }
    }
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    try {
        const response = await axios.post<ImageApiResponse>(
            aiApiUrl(requestConfig, "/images/generations"),
            {
                model: requestConfig.model,
                prompt: withSystemPrompt(requestConfig, prompt),
                n,
                ...(quality ? { quality } : {}),
                ...(requestSize ? { size: requestSize } : {}),
                // gpt-image 系列不接受 response_format（恒返回 b64_json），带上会被部分上游 400 拒绝
                output_format: IMAGE_OUTPUT_FORMAT,
            },
            {
                headers: aiHeaders(requestConfig, "application/json"),
                signal: options?.signal,
            },
        );
        const images = parseImagePayload(response.data);
        return images;
    } catch (error) {
        throw new Error(readAxiosError(error, workbenchText("请求失败")));
    }
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask?: ReferenceImage, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.imageModel);
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const capabilityError = mediaRequestError(requestConfig.model, { imageCount: references.length, hasMask: Boolean(mask) });
    if (capabilityError) throw new Error(capabilityError);
    const requestPrompt = buildImageReferencePromptText(prompt, references);
    if (isGeminiImageModel(requestConfig.model)) {
        if (mask) throw new Error(workbenchText("Gemini 调用格式暂不支持蒙版编辑", "The Gemini API format does not currently support mask editing"));
        try {
            return await requestGeminiImages(requestConfig, requestPrompt, references, n, options);
        } catch (error) {
            throw new Error(readAxiosError(error, workbenchText("请求失败")));
        }
    }
    if (isGrokImageModel(requestConfig.model)) {
        const grokN = Math.min(10, n);
        const grok = grokImageOptions(requestConfig, grokN);
        const formData = new FormData();
        formData.set("model", requestConfig.model);
        formData.set("prompt", withSystemPrompt(requestConfig, requestPrompt));
        formData.set("image", dataUrlToFile({ ...references[0], dataUrl: await imageToDataUrl(references[0]) }));
        formData.set("aspect_ratio", grok.aspectRatio[0]);
        formData.set("quality", grok.quality[0]);
        formData.set("resolution", grok.resolution[0]);
        formData.set("n", String(grokN));
        formData.set("response_format", "b64_json");
        try {
            const response = await axios.post<ImageApiResponse>(aiApiUrl(requestConfig, "/images/edits"), formData, { headers: aiHeaders(requestConfig), signal: options?.signal });
            return parseImagePayload(response.data);
        } catch (error) {
            throw new Error(readAxiosError(error, workbenchText("请求失败")));
        }
    }
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    const formData = new FormData();
    formData.set("model", requestConfig.model);
    formData.set("prompt", withSystemPrompt(requestConfig, requestPrompt));
    formData.set("n", String(n));
    formData.set("output_format", IMAGE_OUTPUT_FORMAT);
    if (quality) {
        formData.set("quality", quality);
    }
    if (requestSize) {
        formData.set("size", requestSize);
    }
    let firstImageDimensions: { width: number; height: number } | undefined;
    const files = await Promise.all(
        references.map(async (image, index) => {
            const file = dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) });
            const dimensions = await validateAzureImageEditFile(file, { index: index + 1 });
            if (index === 0) firstImageDimensions = dimensions;
            return file;
        }),
    );
    files.forEach((file) => formData.append("image[]", file));
    if (mask) {
        const maskFile = dataUrlToFile(mask);
        await validateAzureImageEditFile(maskFile, { label: workbenchText("遮罩图", "Mask image"), pngOnly: true, maxBytes: AZURE_IMAGE_MASK_MAX_BYTES, expectedDimensions: firstImageDimensions });
        formData.set("mask", maskFile);
    }

    try {
        const response = await axios.post<ImageApiResponse>(aiApiUrl(requestConfig, "/images/edits"), formData, { headers: aiHeaders(requestConfig), signal: options?.signal });
        const images = parseImagePayload(response.data);
        return images;
    } catch (error) {
        throw new Error(readAxiosError(error, workbenchText("请求失败")));
    }
}

export async function requestImageQuestion(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, options?: RequestOptions) {
    if (!config.textModel.trim()) throw new Error(workbenchText("请先配置文本 API Key 并获取文本模型"));
    const requestConfig = resolveModelRequestConfig(config, config.textModel);
    try {
        if (requestConfig.apiFormat === "gemini") {
            const emptyContent = workbenchText("没有返回内容");
            const answer = (await requestGeminiStreamingResponse(requestConfig, toGeminiBody(requestConfig, messages), onDelta, options)).content || emptyContent;
            if (answer === emptyContent) onDelta(answer);
            return answer;
        }
        const answer =
            (
                await requestStreamingResponse(
                    requestConfig,
                    {
                        model: requestConfig.model,
                        input: toResponseInput(withSystemMessage(requestConfig, messages)),
                    },
                    onDelta,
                    options,
                )
            ).content || workbenchText("没有返回内容");
        if (answer === workbenchText("没有返回内容")) onDelta(answer);
        return answer;
    } catch (error) {
        throw new Error(readAxiosError(error, workbenchText("请求失败")));
    }
}

export async function requestToolResponse(config: AiConfig, messages: ResponseInputMessage[], tools: ResponseFunctionTool[], toolChoice: ToolChoice = "auto", onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    if (!config.textModel.trim()) throw new Error(workbenchText("请先配置文本 API Key 并获取文本模型"));
    const requestConfig = resolveModelRequestConfig(config, config.textModel);
    try {
        if (requestConfig.apiFormat === "gemini") {
            return await requestGeminiStreamingResponse(requestConfig, toGeminiBody(requestConfig, messages, toGeminiToolOptions(tools, toolChoice)), onDelta, options);
        }
        return await requestStreamingResponse(
            requestConfig,
            {
                model: requestConfig.model,
                input: toResponseInput(withSystemMessage(requestConfig, messages)),
                tools: tools.map(toResponseTool),
                tool_choice: toolChoice,
                parallel_tool_calls: false,
            },
            onDelta,
            options,
        );
    } catch (error) {
        throw new Error(readAxiosError(error, workbenchText("请求失败")));
    }
}

export type DiscoveredModel = {
    id: string;
    supportedEndpointTypes: string[];
};

export class ModelDiscoveryError extends Error {
    status?: number;
    clearModels: boolean;

    constructor(message: string, status?: number, clearModels = false) {
        super(message);
        this.name = "ModelDiscoveryError";
        this.status = status;
        this.clearModels = clearModels;
    }
}

type FetchModelsOptions = { signal?: AbortSignal };

export async function fetchImageModels(config: Pick<AiConfig, "baseUrl" | "apiKey" | "apiFormat">, options?: FetchModelsOptions): Promise<DiscoveredModel[]> {
    try {
        if (config.apiFormat === "gemini") {
            const response = await axios.get<GeminiPayload>(geminiApiUrl({ ...defaultGeminiConfig, ...config }), {
                headers: geminiHeaders({ ...defaultGeminiConfig, ...config }),
                signal: options?.signal,
                timeout: 15000,
            });
            validateGeminiPayload(response.data);
            return normalizeDiscoveredModels((response.data.models || []).map((model) => ({ id: model.name?.replace(/^models\//, ""), supported_endpoint_types: ["gemini"] })));
        }
        const response = await axios.get<{
            success?: boolean;
            data?: Array<{ id?: string; supported_endpoint_types?: string[] }>;
            message?: string;
            error?: { message?: string };
        }>(buildApiUrl(config.baseUrl, "/models"), {
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
            },
            signal: options?.signal,
            timeout: 15000,
        });
        if (response.data.success === false) throw new ModelDiscoveryError(response.data.message || response.data.error?.message || workbenchText("读取模型失败"));
        if (!Array.isArray(response.data.data)) throw new Error(workbenchText("模型接口返回格式无效", "The model endpoint returned an invalid response"));
        return normalizeDiscoveredModels(response.data.data);
    } catch (error) {
        if (error instanceof ModelDiscoveryError) throw error;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        throw new ModelDiscoveryError(readAxiosError(error, workbenchText("读取模型失败")), status, status === 401 || status === 403);
    }
}

export async function fetchChannelModels(channel: ModelChannel, options?: FetchModelsOptions) {
    return fetchImageModels({ baseUrl: channel.baseUrl, apiKey: channel.apiKey, apiFormat: channel.apiFormat }, options);
}

export function responseCapableModelIds(models: DiscoveredModel[]) {
    return models.filter((model) => model.supportedEndpointTypes.includes("openai-response")).map((model) => model.id);
}

export function normalizeDiscoveredModels(models: unknown[]) {
    const byId = new Map<string, Set<string>>();
    for (const model of models.slice(0, 1000)) {
        if (!model || typeof model !== "object") continue;
        const candidate = model as { id?: unknown; supported_endpoint_types?: unknown };
        const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
        if (!id || id.length > 200 || id.includes("::")) continue;
        const endpoints = byId.get(id) || new Set<string>();
        for (const endpoint of Array.isArray(candidate.supported_endpoint_types) ? candidate.supported_endpoint_types : []) {
            const normalized = typeof endpoint === "string" ? endpoint.trim().toLowerCase() : "";
            if (normalized) endpoints.add(normalized);
        }
        byId.set(id, endpoints);
    }
    return Array.from(byId, ([id, endpoints]) => ({ id, supportedEndpointTypes: Array.from(endpoints).sort() })).sort((a, b) => a.id.localeCompare(b.id));
}

const defaultGeminiConfig: Pick<AiConfig, "baseUrl" | "apiKey" | "apiFormat" | "model" | "systemPrompt"> = {
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKey: "",
    apiFormat: "gemini",
    model: "",
    systemPrompt: "",
};
