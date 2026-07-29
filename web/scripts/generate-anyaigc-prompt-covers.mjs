import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const promptsPath = path.join(appRoot, "src", "local-prompts", "anyaigc-prompts.json");
const outputDir = path.join(appRoot, "public", "prompt-covers", "anyaigc");

const apiKey = process.env.ANYAIGC_API_KEY;
const baseUrl = process.env.ANYAIGC_BASE_URL || "https://anyaigc.com";
const model = process.env.ANYAIGC_IMAGE_MODEL || "gpt-image-2";
const size = process.env.PROMPT_COVER_SIZE || "1024x1024";
const apiOutputFormat = process.env.PROMPT_COVER_API_FORMAT || "png";
const coverExtension = normalizeCoverExtension(process.env.PROMPT_COVER_EXTENSION || "webp");
const coverQuality = clampInt(process.env.PROMPT_COVER_QUALITY, 50, 100, 86);
const concurrency = clampInt(process.env.CONCURRENCY, 1, 4, 1);
const retryCount = clampInt(process.env.RETRIES, 0, 5, 2);
const delayMs = clampInt(process.env.DELAY_MS, 0, 60_000, 1500);
const requestTimeoutMs = clampInt(process.env.REQUEST_TIMEOUT_MS, 30_000, 600_000, 180_000);
const start = clampInt(process.env.START, 1, 1000, 1);
const limit = clampInt(process.env.LIMIT, 0, 1000, 0);
const force = process.env.FORCE === "1" || process.env.FORCE === "true";

if (!apiKey) {
    console.error("Missing ANYAIGC_API_KEY.");
    process.exit(1);
}

const prompts = JSON.parse(await readFile(promptsPath, "utf8"));
const selected = prompts.slice(start - 1, limit ? start - 1 + limit : undefined);
let cursor = 0;
let completed = 0;
let failed = 0;

await mkdir(outputDir, { recursive: true });
console.log(`Generating ${selected.length} covers with model=${model}, size=${size}, extension=${coverExtension}, concurrency=${concurrency}, force=${force}`);

await Promise.all(Array.from({ length: concurrency }, (_, workerIndex) => runWorker(workerIndex + 1)));

if (failed) {
    console.error(`Finished with ${failed} failed cover(s).`);
    process.exit(1);
}

console.log(`Finished ${completed} cover(s).`);

async function runWorker(workerId) {
    while (cursor < selected.length) {
        const index = cursor++;
        const item = selected[index];
        const absoluteIndex = start + index;
        const outputPath = path.join(outputDir, `${item.id}.${coverExtension}`);
        if (!force && existsSync(outputPath)) {
            completed++;
            console.log(`[skip] ${absoluteIndex}/${prompts.length} ${item.id}`);
            continue;
        }

        try {
            const image = await withRetries(() => generateCover(item), retryCount, item.id);
            await writeFile(outputPath, image);
            completed++;
            console.log(`[done] worker=${workerId} ${absoluteIndex}/${prompts.length} ${item.id}`);
        } catch (error) {
            failed++;
            console.error(`[fail] worker=${workerId} ${absoluteIndex}/${prompts.length} ${item.id}: ${errorMessage(error)}`);
        }

        if (delayMs) await sleep(delayMs);
    }
}

async function generateCover(item) {
    const response = await fetchWithTimeout(apiUrl(baseUrl, "/images/generations"), {
        method: "POST",
        headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model,
            prompt: coverPrompt(item),
            n: 1,
            size,
            response_format: "b64_json",
            output_format: apiOutputFormat,
        }),
    });

    const text = await response.text();
    let payload;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON response (${response.status}): ${text.slice(0, 300)}`);
    }

    if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.msg || `HTTP ${response.status}`);
    }
    if (typeof payload?.code === "number" && payload.code !== 0) {
        throw new Error(payload.msg || `API code ${payload.code}`);
    }

    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    if (typeof first?.b64_json === "string" && first.b64_json) {
        return optimizeImage(Buffer.from(first.b64_json, "base64"));
    }
    if (typeof first?.url === "string" && first.url) {
        const imageResponse = await fetchWithTimeout(first.url);
        if (!imageResponse.ok) throw new Error(`Failed to download image URL (${imageResponse.status})`);
        return optimizeImage(Buffer.from(await imageResponse.arrayBuffer()));
    }
    throw new Error("No image returned.");
}

async function optimizeImage(buffer) {
    if (coverExtension === "png") return buffer;
    const args =
        coverExtension === "webp"
            ? ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vcodec", "libwebp", "-quality", String(coverQuality), "-compression_level", "6", "-f", "webp", "pipe:1"]
            : ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vcodec", "mjpeg", "-q:v", String(jpegQualityToQscale(coverQuality)), "-f", "image2pipe", "pipe:1"];
    return runFfmpeg(buffer, args);
}

function runFfmpeg(input, args) {
    return new Promise((resolve, reject) => {
        const child = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", (chunk) => stdout.push(chunk));
        child.stderr.on("data", (chunk) => stderr.push(chunk));
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) return resolve(Buffer.concat(stdout));
            reject(new Error(Buffer.concat(stderr).toString("utf8") || `ffmpeg exited with code ${code}`));
        });
        child.stdin.end(input);
    });
}

function jpegQualityToQscale(quality) {
    return Math.max(2, Math.min(15, Math.round(31 - quality * 0.29)));
}

async function fetchWithTimeout(url, init = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${requestTimeoutMs}ms`)), requestTimeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function withRetries(fn, retries, id) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt >= retries) break;
            const wait = 3000 * (attempt + 1);
            console.warn(`[retry] ${id} attempt=${attempt + 1}/${retries + 1}: ${errorMessage(error)}; wait=${wait}ms`);
            await sleep(wait);
        }
    }
    throw lastError;
}

function coverPrompt(item) {
    return `${item.prompt}

作为提示词库封面样图生成：正方形构图，主体清晰，视觉完成度高，质感精美，适合展示在网格卡片中。严格避免任何可读文字、品牌标识、水印、边框、二维码。`;
}

function apiUrl(rawBaseUrl, apiPath) {
    const normalized = rawBaseUrl.trim().replace(/\/+$/, "");
    const apiBase = normalized.toLowerCase().endsWith("/v1") ? normalized : `${normalized}/v1`;
    return `${apiBase}${apiPath}`;
}

function clampInt(value, min, max, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeCoverExtension(value) {
    const extension = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^\./, "");
    return ["webp", "jpg", "jpeg", "png"].includes(extension) ? extension : "webp";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
