# AnyAIGC Canvas Migration Design

## Goal

将现有 Infinite Canvas 克隆项目改造成面向 AnyAIGC 用户的 `AnyAIGC Canvas`。用户在浏览器内分别填写媒体与文本 API Key，前端直连 AnyAIGC 接口。首版保留浏览器本地数据与 WebDAV，不接入 AnyAIGC 云同步。

## Product Decisions

- 保持现有配色和画布主题，不使用此前提出的新主色。
- 生产域名为 `canvas.anyaigc.com`，部署目标为 Vercel。
- 默认 Base URL 为 `https://anyaigc.com`，请求构造器补充 `/v1`。
- 媒体 API Key 和文本 API Key 保持两个独立输入框；两个输入框均提示用户选择 `智能自动` 分组。
- API Key、画布、素材与生成历史保存在浏览器本地；WebDAV 仍可作为用户自有的备份/同步方式。
- 删除 RelayBases 云同步和 RelayBases 公共素材服务；不能将任何用户内容或 API Key 发送至 RelayBases。
- 品牌资源与链接替换为用户提供的 AnyAIGC 值，且保留双语可见文案。

## Model Discovery

模型继续由每位用户的 API Key 请求 `GET /v1/models` 动态发现。媒体选择器展示的结果必须同时满足：

1. 模型在当前 API Key 的 `/v1/models` 返回中；
2. 模型属于本规格的 AnyAIGC 媒体白名单；
3. 模型的能力与当前选择器匹配。

文本和音频模型不受媒体白名单限制：保留 `/v1/models` 返回的动态文本、音频模型及当前的 OpenAI 兼容调用方式。

### Image Models

| Model ID | Invocation | Supported Canvas Flows |
| --- | --- | --- |
| `gpt-image-2` | OpenAI `/v1/images/generations` and `/v1/images/edits` | Text to image, image to image, masked edit |
| `gemini-3.1-flash-image-preview` | Native Gemini `/v1beta/models/{model}:generateContent` | Text to image, image to image |
| `gemini-3-pro-image-preview` | Native Gemini `/v1beta/models/{model}:generateContent` | Text to image, image to image |
| `grok-imagine-image` | OpenAI `/v1/images/generations` | Text to image only |
| `grok-imagine-image-pro` | OpenAI `/v1/images/generations` | Text to image only |

When the selected Grok image model receives reference images or a mask, the request must not be submitted. The UI must show an explicit bilingual capability error.

### Video Models

| Model ID | Create Endpoint | Poll Endpoint | Supported Canvas Flows |
| --- | --- | --- | --- |
| `grok-imagine-video` | `POST /v1/videos` | Existing OpenAI-compatible video polling | Text to video, image to video, video reference flow supported by upstream |
| `grok-imagine-video-1.5` | `POST /v1/videos` | Existing OpenAI-compatible video polling | Single-image to video only |
| `kling-motion-control` | `POST /kling/v1/videos/motion-control` | `GET /kling/v1/videos/motion-control/{id}` | Motion control only |
| `kling-omni-video` | `POST /kling/v1/videos/omni-video` | `GET /kling/v1/videos/omni-video/{id}` | Text to video, image reference, video reference/edit |

The two Kling request bodies must use the listed model IDs as their `model_name` values. The documentation examples such as `kling-v3` and `kling-video-o1` are not used.

`kling-motion-control` requires exactly one person image and exactly one motion-reference video. It sends the image URL, video URL, `model_name`, prompt, and the minimum required mode/orientation defaults. Invalid or missing inputs must fail before submission with a bilingual explanation.

`kling-omni-video` uses the AnyAIGC Omni endpoint with `model_name: "kling-omni-video"`, a standard mode, a duration, `multi_shot: false`, optional image list, and optional video list. The UI only exposes options that the resulting adapter can reliably map.

## Public Reference Media

- Image references required by remote video APIs are uploaded to `https://imageproxy.zhongzhuan.chat/api/upload`; the resulting public image URL is submitted to the upstream model.
- Video references required by Kling APIs are uploaded to `https://storage.to/api` using its documented pre-signed R2 upload flow. The completed `storage.to` URL is submitted as `video_url`.
- `storage.to` documents a share URL rather than a guaranteed raw media URL. The first real MP4 reference submission is a release acceptance test. If AnyAIGC cannot fetch the URL, Canvas reports the upstream-readable-link failure clearly and does not fall back to another model.
- Existing generated results and local user uploads remain browser-local unless the user chooses WebDAV backup.

## Removal Scope

Remove rather than hide, comment out, or retain dead code for all RelayBases-only capabilities:

- RelayBases cloud-sync UI, state, automatic runner, service, session handling, public upload, and public-copy logic;
- RelayBases service URLs, channel names, key-group labels, default model assumptions, and migrations;
- unsupported Nana asynchronous models, VEO models, generic `video-fast`/`video-pro`/`video-standard` models, and their timing/reference rules;
- RelayBases-specific Grok capability aliases and video mode assumptions that do not match AnyAIGC's selected models.

Keep the generic local file store, WebDAV support, dynamic model discovery, image/text/audio canvas nodes, and common OpenAI-compatible image/video polling paths where they remain applicable.

## Branding And Deployment

- Product name: `AnyAIGC Canvas`.
- Logo: `https://lsky.zhongzhuan.chat/i/2026/04/23/69e8f6ee60c5b.png`.
- Favicon source: `C:\Users\yijia\Downloads\favicon_io\favicon.ico`.
- Home link: `https://anyaigc.com`.
- API Key link: `https://anyaigc.com/console/token`.
- Console/balance link: `https://anyaigc.com/console`.
- Privacy link: `https://gptimage2.anyaigc.com/Privacy.html`.
- Deployment target: Vercel. The build configuration must account for the project's root-level `VERSION` read.

## Failure Handling

- Missing API Key, unavailable dynamic model, incompatible input combination, upload failure, task creation failure, polling failure, and unsupported storage URL must have a specific Chinese/English user-facing message.
- No model substitution or provider fallback is permitted when a selected model cannot execute a request.
- API Keys remain in browser-local configuration and are sent only to the selected AnyAIGC or user-selected public upload endpoint required for the request.

## Verification

- Unit tests cover white-list filtering, capability classification, selected model request-body construction, local validation, Kling response parsing, and dynamic discovery behavior.
- Run `cd web && bun run check` and `cd web && bun run build`.
- Verify browser UI in Chinese and English: configuration labels, placeholders, button labels, titles, empty states, errors, model pickers, and dangerous-action confirmation text.
- Run real user-Key smoke checks for one text-to-image model, one image-to-image model, one Grok video model, one Kling model, and an MP4 reference upload through `storage.to` before release.
