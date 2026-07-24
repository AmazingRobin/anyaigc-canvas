# AnyAIGC Canvas Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing RelayBases-branded canvas into AnyAIGC Canvas with browser-local API keys, dynamic AnyAIGC model discovery, supported image/video adapters, and Vercel-ready branding and deployment.

**Architecture:** Keep the current browser-local Zustand/localforage architecture and OpenAI-compatible text/audio requests. Replace RelayBases-only configuration and media capability heuristics with one explicit AnyAIGC capability registry, filter `/v1/models` against that registry for media, and route image/video submissions through model-specific adapters. Remove RelayBases cloud synchronization completely while retaining WebDAV.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, Ant Design, Tailwind, browser `fetch`, Bun scripts.

---

## File Structure

- Create: `web/src/lib/anyaigc-media-models.ts` — supported media model capability registry, validation, labels, and request-payload constructors.
- Create: `web/src/services/api/media-upload.ts` — image-proxy and storage.to uploads with only browser-side request construction.
- Modify: `web/src/stores/use-config-store.ts` — AnyAIGC defaults, separate keys, dynamic discovery, explicit media filtering, and removal of cloud-sync state.
- Modify: `web/src/services/api/image.ts` — route GPT, Gemini, and Grok image requests by selected model capability.
- Modify: `web/src/services/api/video.ts` — route Grok and Kling create/poll calls and public-reference uploads.
- Modify: `web/src/components/video-settings-panel.tsx`, `web/src/app/(user)/video/page.tsx`, `web/src/app/(user)/canvas/utils/canvas-generation-config.ts`, `web/src/app/(user)/canvas/components/canvas-video-settings-popover.tsx` — capability-driven input controls and pre-submit errors.
- Delete: `web/src/services/cloud-sync.ts`, `web/src/components/layout/cloud-sync-action-button.tsx`, `web/src/components/layout/cloud-sync-auto-runner.tsx` — RelayBases-only sync and UI.
- Modify: `web/src/services/app-sync.ts`, `web/src/components/layout/app-providers.tsx`, `web/src/components/layout/user-status-actions.tsx`, `web/src/components/layout/app-config-modal.tsx` — retain WebDAV and remove cloud-sync entry points.
- Modify: branding/layout files, `README.md`, release/progress documents, and `web/next.config.ts` — AnyAIGC public identity and Vercel-safe build metadata.
- Modify tests: `web/scripts/test-dynamic-models.ts`, `web/scripts/test-grok-video-contract.ts`, `web/scripts/test-i18n.ts`; add `web/scripts/test-media-upload-contract.ts`.

### Task 1: Establish a tested baseline and replace obsolete contract entry points

**Files:**
- Modify: `web/package.json`
- Modify: `web/scripts/test-dynamic-models.ts`
- Modify: `web/scripts/test-grok-video-contract.ts`
- Create: `web/scripts/test-media-upload-contract.ts`

- [ ] **Step 1: Run the existing checks before changing implementation**

Run: `cd web; bun run check`

Expected: the existing typecheck and three contract scripts finish with exit code `0`; record any pre-existing failure before continuing.

- [ ] **Step 2: Write failing contracts for the new model rules**

Replace RelayBases/Nana/VEO/Seedance expectations with assertions for all of the following:

```ts
assert.deepEqual(filterMediaModels([
  "gpt-image-2", "gemini-3.1-flash-image-preview", "grok-imagine-video",
  "veo-3-1", "unrelated-chat-model",
]), [
  "gpt-image-2", "gemini-3.1-flash-image-preview", "grok-imagine-video",
]);
assert.equal(mediaModelCapability("grok-imagine-image")?.image?.allowsReferences, false);
assert.equal(mediaModelCapability("grok-imagine-video-1.5")?.video?.imageCount.max, 1);
assert.equal(mediaModelCapability("kling-motion-control")?.video?.videoCount.min, 1);
```

In `test-media-upload-contract.ts`, use a stubbed `fetch` and assert the image `FormData` field is `file`, storage.to calls `/api/upload/init` then signed `PUT`, and sends `/api/upload/confirm` only after the PUT succeeds.

- [ ] **Step 3: Run the new contract scripts and verify they fail for missing AnyAIGC behavior**

Run: `cd web; bun scripts/test-dynamic-models.ts; bun scripts/test-grok-video-contract.ts; bun scripts/test-media-upload-contract.ts`

Expected: failure because `anyaigc-media-models` and `media-upload` do not exist yet, rather than a TypeScript syntax/configuration error.

- [ ] **Step 4: Register the new media upload contract in `check`**

Change the script definition to:

```json
"check": "bunx tsc --noEmit && bun run test:i18n && bun run test:grok-video && bun run test:dynamic-models && bun run test:media-upload",
"test:media-upload": "bun scripts/test-media-upload-contract.ts"
```

- [ ] **Step 5: Commit the test harness checkpoint**

```powershell
git add web/package.json web/scripts/test-dynamic-models.ts web/scripts/test-grok-video-contract.ts web/scripts/test-media-upload-contract.ts
git commit -m "test: define AnyAIGC media contracts"
```

### Task 2: Add the explicit AnyAIGC media capability registry

**Files:**
- Create: `web/src/lib/anyaigc-media-models.ts`
- Modify: `web/scripts/test-dynamic-models.ts`
- Modify: `web/scripts/test-grok-video-contract.ts`

- [ ] **Step 1: Define the registry from the approved allowlist**

Create one exported registry containing exactly these IDs:

```ts
export const ANYAIGC_MEDIA_MODEL_IDS = [
  "gpt-image-2",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "grok-imagine-image",
  "grok-imagine-image-pro",
  "grok-imagine-video",
  "grok-imagine-video-1.5",
  "kling-motion-control",
  "kling-omni-video",
] as const;
```

Represent each ID with `kind`, image invocation (`openai` or `gemini`), and video input limits. Model-name helpers must remove the existing `channelId::` prefix before lookup so persisted picker values work unchanged.

- [ ] **Step 2: Implement pre-submit validation as pure functions**

Export a single capability error function that receives image count, video count, and optional mask state. It must return the first bilingual error string for these cases:

```ts
validateMediaRequest("grok-imagine-image", { imageCount: 1 }); // references unavailable
validateMediaRequest("grok-imagine-video-1.5", { imageCount: 0 }); // exactly one image required
validateMediaRequest("kling-motion-control", { imageCount: 1, videoCount: 0 }); // exactly one action video required
validateMediaRequest("kling-omni-video", { imageCount: 0, videoCount: 0 }); // valid text-to-video
```

Do not return a fallback model or silently normalize an unsupported operation.

- [ ] **Step 3: Implement request payload constructors for selected video families**

The registry module must export pure builders, with model IDs passed through exactly:

```ts
buildKlingMotionControlPayload({
  prompt: "dance", imageUrl: "https://example.com/person.png", videoUrl: "https://storage.to/example",
});
// includes model_name: "kling-motion-control", image_url, video_url, prompt

buildKlingOmniVideoPayload({
  prompt: "sunset", duration: 5, imageUrls: ["https://example.com/frame.png"], videoUrls: [],
});
// includes model_name: "kling-omni-video", mode: "std", duration: "5", multi_shot: false
```

Use only endpoint fields documented by AnyAIGC; do not include old `kling-v3`, `kling-v2-6`, or `kling-video-o1` aliases.

- [ ] **Step 4: Make the Task 1 contracts pass**

Run: `cd web; bun scripts/test-dynamic-models.ts; bun scripts/test-grok-video-contract.ts`

Expected: both scripts exit `0` and assert the selected image/video capability rules and builders.

- [ ] **Step 5: Commit the registry**

```powershell
git add web/src/lib/anyaigc-media-models.ts web/scripts/test-dynamic-models.ts web/scripts/test-grok-video-contract.ts
git commit -m "feat: define AnyAIGC media capabilities"
```

### Task 3: Convert configuration and dynamic model discovery to AnyAIGC

**Files:**
- Modify: `web/src/stores/use-config-store.ts`
- Modify: `web/src/components/model-picker.tsx`
- Modify: `web/scripts/test-dynamic-models.ts`

- [ ] **Step 1: Write failing discovery tests against the desired config API**

Add assertions that a media `/v1/models` result only exposes IDs in `ANYAIGC_MEDIA_MODEL_IDS`, and that an allowed model not returned by the current API key is not selectable. Add an assertion that text and audio models retain their dynamic lists and are not filtered by this media allowlist.

- [ ] **Step 2: Run the dynamic-model test to prove current RelayBases behavior does not satisfy it**

Run: `cd web; bun scripts/test-dynamic-models.ts`

Expected: failure for the removed RelayBases constants/classification logic.

- [ ] **Step 3: Replace the config defaults and storage identity**

In `use-config-store.ts`:

```ts
export const ANYAIGC_BASE_URL = "https://anyaigc.com";
export const ANYAIGC_MEDIA_CHANNEL_ID = "anyaigc-media";
export const ANYAIGC_TEXT_CHANNEL_ID = "anyaigc-text";
export const ANYAIGC_RECOMMENDED_KEY_GROUP = "智能自动";
export const CONFIG_STORE_KEY = "anyaigc-canvas:ai_config_store";
```

Set both channel base URLs to `ANYAIGC_BASE_URL`. Keep separate `mediaApiKey` and `textApiKey`, clear only the related selection/list when its key changes, and construct model endpoint URLs as `https://anyaigc.com/v1/models` without double-appending `/v1`.

- [ ] **Step 4: Replace heuristic media classification with the registry**

Make `filterModelsByCapability(models, "image" | "video")` use `mediaModelCapability` exclusively. `text` and `audio` retain existing dynamic classification because they are not part of the restricted media registry. Remove `RELAYBASES_*` lists, relay migration code, and billing labels that point to unavailable models.

- [ ] **Step 5: Update picker labels without changing the theme**

Make the model picker show supported AnyAIGC media models from discovery and remove RelayBases labels/pricing assumptions. Retain existing picker layout and return an explicit bilingual empty state when a key has no supported models.

- [ ] **Step 6: Re-run the dynamic-model contract**

Run: `cd web; bun scripts/test-dynamic-models.ts`

Expected: exit `0`; it proves a model needs both `/v1/models` presence and an AnyAIGC registry entry to be selectable as media.

- [ ] **Step 7: Commit the configuration migration**

```powershell
git add web/src/stores/use-config-store.ts web/src/components/model-picker.tsx web/scripts/test-dynamic-models.ts
git commit -m "feat: discover supported AnyAIGC media models"
```

### Task 4: Implement public reference-media upload adapters

**Files:**
- Create: `web/src/services/api/media-upload.ts`
- Modify: `web/scripts/test-media-upload-contract.ts`

- [ ] **Step 1: Implement image reference upload**

Export `uploadImageReference(file, signal?)` that performs:

```ts
const form = new FormData();
form.append("file", file, file.name || "reference.png");
const response = await fetch("https://imageproxy.zhongzhuan.chat/api/upload", {
  method: "POST", body: form, signal,
});
```

Require a successful JSON `{ url: string }`; throw `图片参考素材上传失败 / Failed to upload image reference` for invalid response or non-OK status.

- [ ] **Step 2: Implement storage.to’s documented presigned flow**

Export `uploadVideoReference(file, signal?)`. It calls `POST https://storage.to/api/upload/init` with the file name/type/size, uploads the raw file by `PUT` to the returned signed URL, then calls `POST https://storage.to/api/upload/confirm` with the returned upload identifier. Require a final share URL string. Preserve the upstream `https://storage.to/...` result unchanged for Kling.

- [ ] **Step 3: Finish response parsing and error contracts**

Handle documented response nesting defensively only for the documented `data` wrapper. Convert network, invalid init, signed PUT, confirm, and missing URL failures to specific bilingual errors. Never upload keys or unrelated local assets.

- [ ] **Step 4: Verify no live upload is performed by tests**

Run: `cd web; bun scripts/test-media-upload-contract.ts`

Expected: exit `0`, with mocked fetch calls proving request order and no network dependency.

- [ ] **Step 5: Commit the upload adapter**

```powershell
git add web/src/services/api/media-upload.ts web/scripts/test-media-upload-contract.ts
git commit -m "feat: add AnyAIGC reference media uploads"
```

### Task 5: Route image generation through supported AnyAIGC APIs

**Files:**
- Modify: `web/src/services/api/image.ts`
- Modify: `web/scripts/test-dynamic-models.ts`
- Modify: `web/scripts/test-i18n.ts`

- [ ] **Step 1: Add failing request contracts for image adapters**

Assert `gpt-image-2` uses `/v1/images/generations` without references and `/v1/images/edits` with references/mask, the two Gemini IDs use `/v1beta/models/{id}:generateContent`, and both Grok image IDs reject reference images or masks before fetch.

- [ ] **Step 2: Run the image-related contracts to show existing format-level routing is insufficient**

Run: `cd web; bun scripts/test-dynamic-models.ts; bun scripts/test-i18n.ts`

Expected: a failure that identifies the channel-wide Gemini assumption or absent Grok restrictions.

- [ ] **Step 3: Route by selected model capability, not channel API format**

Use the media registry to route Gemini models to the native Gemini request already present in `image.ts`, with an AnyAIGC base URL and the media key. Use the existing OpenAI create/edit code for GPT Image 2. For Grok image models, call only OpenAI `images/generations`, and block reference/mask use with the registry validation before network submission.

- [ ] **Step 4: Replace Nana async task logic**

Delete `nana-banana-*` names, task polling, and UI/result code that only supports RelayBases asynchronous image endpoints. Do not leave commented dead paths.

- [ ] **Step 5: Add bilingual error assertions and run tests**

Run: `cd web; bun scripts/test-dynamic-models.ts; bun scripts/test-i18n.ts`

Expected: exit `0`; the contracts include a visible Chinese and English error for an incompatible Grok image input.

- [ ] **Step 6: Commit image routing**

```powershell
git add web/src/services/api/image.ts web/scripts/test-dynamic-models.ts web/scripts/test-i18n.ts
git commit -m "feat: route AnyAIGC image models"
```

### Task 6: Replace video requests and polling with Grok/Kling adapters

**Files:**
- Modify: `web/src/services/api/video.ts`
- Modify: `web/src/lib/anyaigc-media-models.ts`
- Modify: `web/scripts/test-grok-video-contract.ts`
- Modify: `web/scripts/test-media-upload-contract.ts`

- [ ] **Step 1: Write failing video create/poll tests**

Use mocked fetch to assert:

```ts
// Grok create and poll
POST /v1/videos
GET /v1/video/query?id=<taskId>

// Kling create and poll
POST /kling/v1/videos/motion-control
GET /kling/v1/videos/motion-control/<taskId>
POST /kling/v1/videos/omni-video
GET /kling/v1/videos/omni-video/<taskId>
```

The Kling tests must check literal `model_name: "kling-motion-control"` and `model_name: "kling-omni-video"`.

- [ ] **Step 2: Run the video contract before implementation**

Run: `cd web; bun scripts/test-grok-video-contract.ts`

Expected: failure because the current code assumes RelayBases modes/endpoints and has no Kling poll adapter.

- [ ] **Step 3: Remove RelayBases-only video implementations**

Delete VEO compression, VEO model routes, Seedance validation/routes, generic `video-fast`/`video-pro`/`video-standard` routes, old Grok five-mode payload generation, RelayBases public-media copying, and unsupported model fallback logic.

- [ ] **Step 4: Implement Grok video create/poll behavior**

Use the user’s selected media key and base URL. `grok-imagine-video` submits documented `/v1/videos` multipart fields, and `grok-imagine-video-1.5` validates exactly one image before submit. Poll with `/v1/video/query?id=...`, parse documented task status/URL fields, and retain the existing local archive/result pattern.

- [ ] **Step 5: Implement Kling create/poll behavior**

Before Kling submission, upload local image references through `uploadImageReference` and local video references through `uploadVideoReference`. Build each request using the pure registry builder. Poll until a documented success URL or terminal failure. If storage.to’s share URL cannot be fetched by upstream, surface `视频参考链接无法被上游读取 / The upstream service could not read the video reference link` and do not submit another model.

- [ ] **Step 6: Verify video contracts**

Run: `cd web; bun scripts/test-grok-video-contract.ts; bun scripts/test-media-upload-contract.ts`

Expected: exit `0`; contracts prove literals, endpoints, validation, and upload sequencing.

- [ ] **Step 7: Commit the video migration**

```powershell
git add web/src/services/api/video.ts web/src/lib/anyaigc-media-models.ts web/scripts/test-grok-video-contract.ts web/scripts/test-media-upload-contract.ts
git commit -m "feat: add AnyAIGC Grok and Kling video adapters"
```

### Task 7: Make video controls and canvas handoff capability-driven

**Files:**
- Modify: `web/src/components/video-settings-panel.tsx`
- Modify: `web/src/app/(user)/video/page.tsx`
- Modify: `web/src/app/(user)/canvas/utils/canvas-generation-config.ts`
- Modify: `web/src/app/(user)/canvas/components/canvas-video-settings-popover.tsx`
- Modify: `web/scripts/test-grok-video-contract.ts`
- Modify: `web/scripts/test-i18n.ts`

- [ ] **Step 1: Add UI-source contracts for supported controls**

Assert that the video page and canvas popover derive available settings from `mediaModelCapability`, do not mention VEO/Seedance/Nana/RelayBases model names, and expose no old Grok edit/extend modes.

- [ ] **Step 2: Run the UI contracts before replacement**

Run: `cd web; bun scripts/test-grok-video-contract.ts; bun scripts/test-i18n.ts`

Expected: failure because the current controls are based on RelayBases-specific mode lists.

- [ ] **Step 3: Implement the supported control matrix**

Use the capability registry to provide only these flows:

| Model | Visible flow |
| --- | --- |
| `grok-imagine-video` | text to video, image to video, documented video-reference flow |
| `grok-imagine-video-1.5` | single-image to video |
| `kling-motion-control` | one person image plus one action-reference video |
| `kling-omni-video` | text, optional image references, optional video references |

Hide controls that cannot map to request payload fields. Validate before uploading or submitting, show the capability error in both languages, and never select a different model automatically.

- [ ] **Step 4: Preserve canvas node metadata without old billing semantics**

Keep image/video references passed from Canvas and My Assets, including `mimeType`, `bytes`, and `durationMs`, so `storage.to` can upload the original MP4. Remove old edit/extend billing, source duration, and VEO compression requirements.

- [ ] **Step 5: Verify UI and language contracts**

Run: `cd web; bun scripts/test-grok-video-contract.ts; bun scripts/test-i18n.ts`

Expected: exit `0`, proving no unsupported media flow remains exposed in the configured video UI.

- [ ] **Step 6: Commit the UI migration**

```powershell
git add web/src/components/video-settings-panel.tsx web/src/app/(user)/video/page.tsx web/src/app/(user)/canvas/utils/canvas-generation-config.ts web/src/app/(user)/canvas/components/canvas-video-settings-popover.tsx web/scripts/test-grok-video-contract.ts web/scripts/test-i18n.ts
git commit -m "feat: expose AnyAIGC video capabilities"
```

### Task 8: Remove RelayBases cloud synchronization while retaining WebDAV

**Files:**
- Delete: `web/src/services/cloud-sync.ts`
- Delete: `web/src/components/layout/cloud-sync-action-button.tsx`
- Delete: `web/src/components/layout/cloud-sync-auto-runner.tsx`
- Modify: `web/src/services/app-sync.ts`
- Modify: `web/src/stores/use-config-store.ts`
- Modify: `web/src/components/layout/app-providers.tsx`
- Modify: `web/src/components/layout/user-status-actions.tsx`
- Modify: `web/src/components/layout/app-config-modal.tsx`
- Modify: `web/scripts/test-i18n.ts`

- [ ] **Step 1: Add source-level tests preventing cloud-sync imports and RelayBases URLs**

Make the i18n/source audit assert that app providers and status actions no longer import `cloud-sync`, and that no source file under `web/src` contains `relaybases.com/api/canvas-sync`.

- [ ] **Step 2: Run the audit before deleting cloud sync**

Run: `cd web; bun scripts/test-i18n.ts`

Expected: failure because the RelayBases cloud-sync service and UI still exist.

- [ ] **Step 3: Delete RelayBases-only sync code and state**

Remove `CloudSyncConfig`, cloud activity fields/actions, session/key helpers, automatic runner, manual action button, config-tab content, and status-action UI. In `app-sync.ts`, keep the generic sync archive and WebDAV storage functions, remove `syncAppDataToRelayBasesCloud`, and remove special RelayBases public-media URL filtering.

- [ ] **Step 4: Preserve a clear local/WebDAV explanation**

The configuration UI must explain in Chinese and English that keys, canvases, assets, and history are browser-local; WebDAV remains a user-managed backup/sync option. It must not claim AnyAIGC cloud synchronization exists.

- [ ] **Step 5: Verify no cloud-sync code remains**

Run: `cd web; bun scripts/test-i18n.ts; rg -n -i "cloud-sync|relaybases\.com/api/canvas-sync" src`

Expected: the test exits `0`; `rg` returns no matches.

- [ ] **Step 6: Commit cloud-sync removal**

```powershell
git add -u web/src
git add web/scripts/test-i18n.ts
git commit -m "refactor: remove RelayBases cloud sync"
```

### Task 9: Apply AnyAIGC branding, links, and local persistence names

**Files:**
- Create: `web/public/anyaigc-canvas-logo.png`
- Create: `web/src/components/brand/anyaigc-canvas-icon.tsx`
- Create: `web/src/constant/anyaigc-links.ts`
- Delete: `web/src/components/brand/relaybases-canvas-icon.tsx`
- Delete: `web/src/constant/relaybases-links.ts`
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/components/layout/app-top-nav.tsx`
- Modify: `web/src/components/layout/mobile-nav-drawer.tsx`
- Modify: `web/src/components/layout/app-legal-footer.tsx`
- Modify: `web/src/app/(user)/page.tsx`
- Modify: `web/src/lib/workbench-preferences.ts`
- Modify: `web/src/stores/use-language-store.ts`
- Modify: `web/src/services/workbench-handoff.ts`
- Modify: `web/scripts/test-i18n.ts`

- [ ] **Step 1: Add failing identity tests**

Assert application metadata/title contains `AnyAIGC Canvas`, user-facing key-group guidance contains `智能自动 / Smart Auto`, and the known links resolve to the supplied AnyAIGC home, token, console, and privacy URLs.

- [ ] **Step 2: Add supplied logo and favicon resources**

Download the user’s PNG to `web/public/anyaigc-canvas-logo.png`. Copy `C:\Users\yijia\Downloads\favicon_io\favicon.ico` to `web/src/app/favicon.ico` after confirming it exists and is a non-empty ICO file. Do not alter the current color tokens/theme.

- [ ] **Step 3: Replace branding and link imports**

Create:

```ts
export const ANYAIGC_HOME_URL = "https://anyaigc.com";
export const ANYAIGC_KEYS_URL = "https://anyaigc.com/console/token";
export const ANYAIGC_CONSOLE_URL = "https://anyaigc.com/console";
export const ANYAIGC_PRIVACY_URL = "https://gptimage2.anyaigc.com/Privacy.html";
```

Replace all old icon/constant imports. Use the supplied PNG in the icon component and app metadata. Change only brand text/links and key guidance; retain layout, existing visual theme, and original-project attribution/license links in the legal footer.

- [ ] **Step 4: Replace pre-launch local storage keys without migrations**

Rename RelayBases-branded storage keys for language, workbench preferences, and image-to-video handoff to `anyaigc-canvas:*`. Do not add migration fallback because the product is not yet launched.

- [ ] **Step 5: Update all user-visible bilingual labels**

Use the shared dictionary/formatters for `AnyAIGC Canvas`, media key, text key, `智能自动`, local-storage disclosure, WebDAV, and link labels. Mark user-entered prompt/content surfaces with existing `data-no-i18n` safeguards; do not translate user data.

- [ ] **Step 6: Verify branding contracts**

Run: `cd web; bun scripts/test-i18n.ts; rg -n -i "RelayBases" src README.md`

Expected: test exits `0`; only required original-project historical attribution remains, with no active product/UI references.

- [ ] **Step 7: Commit branding changes**

```powershell
git add -u web/src
git add web/public/anyaigc-canvas-logo.png web/src/constant/anyaigc-links.ts web/scripts/test-i18n.ts
git commit -m "feat: brand canvas for AnyAIGC"
```

### Task 10: Make the Next.js build Vercel-safe and update documentation

**Files:**
- Modify: `web/next.config.ts`
- Create: `vercel.json` (only if build-root testing proves it necessary)
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/content/docs/progress/todo.mdx`
- Modify: `docs/content/docs/progress/pending-test.mdx`

- [ ] **Step 1: Add a Vercel-root regression test or safe metadata fallback**

In `web/next.config.ts`, replace unconditional `readFileSync(resolve(webDir, "../VERSION"))` with an `existsSync` guard and a stable `"dev"` fallback. This allows Vercel to use `web` as Root Directory when the root `VERSION` is absent from the deployment artifact.

- [ ] **Step 2: Update README for the finished product**

Make the README concise: AnyAIGC Canvas introduction, supported image/video model families, quick start with media/text keys and `智能自动`, browser-local storage/security disclosure, WebDAV option, Vercel deployment using `canvas.anyaigc.com`, and documentation link. Remove RelayBases clone URLs and cloud-sync promises.

- [ ] **Step 3: Update release/progress documentation**

Move completed migration work from `todo.mdx` to `pending-test.mdx` with explicit manual checks: media discovery, five image models, Grok/Kling video, storage.to MP4 reference, bilingual UI, and Vercel deployment. Reduce `CHANGELOG.md` `Unreleased` to a version-level AnyAIGC migration summary without copying individual implementation lines.

- [ ] **Step 4: Run documentation/source checks**

Run: `cd web; bun run test:i18n; rg -n -i "RelayBases 云同步|relaybases\.com/api/canvas-sync" ..\README.md ..\docs src`

Expected: no active cloud-sync claim or provider endpoint remains.

- [ ] **Step 5: Commit deployment/docs preparation**

```powershell
git add web/next.config.ts README.md CHANGELOG.md docs/content/docs/progress/todo.mdx docs/content/docs/progress/pending-test.mdx vercel.json
git commit -m "docs: prepare AnyAIGC Canvas deployment"
```

### Task 11: Verify the complete browser build and release acceptance paths

**Files:**
- Modify only if verification discovers a scoped defect in files named above.

- [ ] **Step 1: Run the complete automated suite**

Run: `cd web; bun run check`

Expected: exit `0`; TypeScript, i18n, media capability, video-adapter, and upload-contract tests all pass.

- [ ] **Step 2: Run the production build**

Run: `cd web; bun run build`

Expected: exit `0` with no missing-root-`VERSION` failure.

- [ ] **Step 3: Run local browser regression in Chinese and English**

Run: `cd web; bun run dev`

Verify `/`, `/image`, `/video`, and one canvas route in both languages. Check configuration labels/placeholders/titles, local/WebDAV disclosure, model picker filtering, empty states, validation errors, buttons, and destructive dialogs. Confirm user prompt/asset text stays unchanged after language switch.

- [ ] **Step 4: Run live-key release smoke checks before deployment**

Using a real AnyAIGC user key and a test asset, verify one text-to-image (`gpt-image-2`), one image-to-image (`gemini-3.1-flash-image-preview` or `gpt-image-2`), one Grok video, one Kling model, and one MP4 reference uploaded through storage.to. Record any upstream inability to fetch a storage.to share URL as a release blocker; do not implement fallback routing.

- [ ] **Step 5: Review final changes and commit any scoped fixes**

Run: `git status --short; git diff --check; git log --oneline -10`

Expected: no whitespace errors; only intended migration files are staged/committed; preserve the user’s pre-existing untracked `.spec-workflow/` and `docs/llms.txt`.

- [ ] **Step 6: Present Vercel deployment handoff**

Provide the project/repository selection, Vercel Root Directory choice, build command, custom-domain DNS step for `canvas.anyaigc.com`, and the required live-key smoke-test result. Do not claim production release until these acceptance checks are complete.

