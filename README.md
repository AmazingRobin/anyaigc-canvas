# ✨ AnyAIGC Canvas

AnyAIGC Canvas 是面向 AnyAIGC 用户的浏览器端 AI 创作工作台。它将无限画布、图片生成、视频生成、提示词库、素材库和本地 Agent 工作流放在同一界面中；每位用户使用自己的 AnyAIGC API Key。

项目基于 [infinite-canvas](https://github.com/basketikun/infinite-canvas) 二次开发，遵循 [GNU Affero General Public License v3.0](LICENSE)。

## 🎨 功能

- 🗺️ 无限画布：创建多个画布，在画布中组织文本、图片、视频和生成节点，支持连线、小地图、撤销重做、导入与导出。
- 🖼️ 图片创作：支持文生图、图生图和蒙版编辑；可使用当前 Key 返回且 Canvas 已接入的 GPT Image、Nano Banana、Grok、Seedream 和 Midjourney 图片模型。
- 🎬 视频创作：支持文生视频、图生视频、首帧与首尾帧视频，以及部分模型的动作视频参考、多模态参考素材和原生配音。
- 🪄 提示词与素材：内置精选提示词库；画布、素材和生成记录保存在浏览器本地，可在工作台和画布中复用。
- 💾 WebDAV：可选的用户自有 WebDAV 备份与跨设备同步，不提供平台云同步。
- 🤖 Canvas Agent：可连接在线或本地 Agent，通过工具调用辅助操作当前画布。

## 🧩 支持的媒体模型

媒体模型由当前 API Key 请求 `/v1/models` 后动态决定：只有接口实际返回、且下列表格已接入的模型才会显示和可选。界面会按所选模型自动限制可用参数，不满足要求时在提交前给出提示。

> 下表模型名省略了日期版本号。实际请求会使用完整 ID，例如 `doubao-seedance-2-0` 对应 `doubao-seedance-2-0-260128`。

### 🖼️ 图片模型

| 模型 | 说明 | 文生图 | 图生图 | 参考图 | 蒙版编辑 |
| --- | --- | :-: | :-: | --- | :-: |
| `gpt-image-2` | GPT Image 2 | ✅ | ✅ | 最多 5 张 | ✅ |
| `gpt-image-2-c` | GPT Image 2 高性价比通道 | ✅ | ✅ | 最多 5 张 | ✅ |
| `gpt-image-2.5-sunburst` | GPT Image 2.5 Sunburst | ✅ | ✅ | 最多 5 张 | ✅ |
| `gpt-image-2.5-sunburst-c` | Sunburst 高性价比通道 | ✅ | ✅ | 最多 5 张 | ✅ |
| `gpt-image-2.5-flare` | GPT Image 2.5 Flare | ✅ | ✅ | 最多 5 张 | ✅ |
| `gpt-image-2.5-flare-c` | Flare 高性价比通道 | ✅ | ✅ | 最多 5 张 | ✅ |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | ✅ | ✅ | 最多 5 张 | ❌ |
| `gemini-3-pro-image-preview` | Nano Banana Pro | ✅ | ✅ | 最多 5 张 | ❌ |
| `grok-imagine-image` | Grok Imagine | ✅ | ✅ | 仅 1 张 | ❌ |
| `grok-imagine-image-pro` | Grok Imagine Pro | ✅ | ✅ | 仅 1 张 | ❌ |
| `doubao-seedream-5-0` | Seedream 5.0 | ✅ | ✅ | 最多 14 张 | ❌ |
| `doubao-seedream-5-0-pro` | Seedream 5.0 Pro | ✅ | ✅ | 最多 10 张 | ❌ |
| `mj_imagine` | Midjourney 文生图，支持 v7 / v8 与放大、变化、Zoom、局部重绘 | ✅ | ✅ | 最多 5 张 | ❌ |
| `mj_blend` | Midjourney 多图混合 | ❌ | ✅ | 必须 2-5 张 | ❌ |

### 🎬 视频模型

| 模型 | 说明 | 生成方式 | 参考素材 | 时长 | 分辨率 | 原生配音 |
| --- | --- | --- | --- | --- | --- | :-: |
| `grok-imagine-video` | Grok 视频 | 文生、图生 | 图 0-1 | 3-10s | 模型默认 | ❌ |
| `grok-imagine-video-1.5` | Grok 视频 1.5，仅图生 | 图生 | 图 1 张（必填） | 3-10s | 模型默认 | ❌ |
| `kling-motion-control` | 可灵动作控制，用动作视频驱动人物 | 动作控制 | 图 1 张 + 视频 1 个（均必填） | 3-10s | 模型默认 | ❌ |
| `kling-omni-video` | 可灵全能视频 | 全能视频 | 图 0-5、视频 0-1 | 3-10s | 模型默认 | ❌ |
| `kling-3.0-turbo` | 可灵 3.0 Turbo | 文生、图生 | 图 0-1 | 3-15s | 720p / 1080p | ❌ |
| `MiniMax-Hailuo-02` | 海螺 02 | 文生、图生、首尾帧 | 图 0-2（首尾帧需恰好 2 张，顺序为首帧、尾帧） | 6s 或 10s | 模型默认 | ❌ |
| `MiniMax-Hailuo-2.3` | 海螺 2.3 | 文生、图生、首尾帧 | 同上 | 6s 或 10s | 模型默认 | ❌ |
| `doubao-seedance-2-5` | Seedance 2.5，多模态参考能力最强 | 全能视频、首帧、首尾帧 | 图 0-30、视频 0-10、音频 0-10 | 4-30s | 480p / 720p / 1080p | ✅ |
| `doubao-seedance-2-0` | Seedance 2.0，可出 4k | 全能视频、首帧、首尾帧 | 图 0-9、视频 0-3、音频 0-3 | 4-15s | 480p / 720p / 1080p / 4k | ✅ |
| `doubao-seedance-2-0-fast` | Seedance 2.0 Fast，速度优先 | 全能视频、首帧、首尾帧 | 图 0-9、视频 0-3、音频 0-3 | 4-15s | 480p / 720p | ✅ |

#### Seedance 的三种模式互斥

Seedance 的图片输入分三种场景，不能混用，界面通过「生成方式」切换：

| 模式 | 图片数量 | 说明 |
| --- | --- | --- |
| 全能视频 | 0 张起 | 多图、参考视频、参考音频可同时使用；不传图即为文生视频 |
| 首帧 | 恰好 1 张 | 以该图作为视频首帧 |
| 首尾帧 | 恰好 2 张 | 按列表顺序作为首帧与尾帧，可用排序按钮调整 |

首帧与首尾帧模式下不接受参考视频和参考音频。另外 `doubao-seedance-2-5` 在这两种模式下由上游强制使用自适应比例，界面会隐藏比例选择器；`doubao-seedance-2-0` 与 `doubao-seedance-2-0-fast` 不受此限制。

## 🚀 使用方式

1. ⚙️ 打开应用右上角的“设置”，选择平台：默认亚洲站 [anyaigc.com](https://anyaigc.com)，也可切换国际站 [anyaigc.ai](https://anyaigc.ai)。
2. 🔑 分别填写所选平台的媒体 API Key 和文本 API Key；Key 仅保存在当前浏览器中。
3. 🧠 创建 Key 时推荐选择“智能自动 / Smart Auto”分组。
4. ✨ 点击“获取模型”，再在图片、视频或画布中选择可用模型并开始创作；切换平台后需重新获取该平台的模型。

> ⚠️ 智能自动分组可能不返回 Gemini 图片模型。需要使用 Nano Banana 2 / Pro 时，请创建已设置 Gemini 支持的分组 Key（例如特价 banana），然后重新点击“获取模型”。

## 💻 本地开发

```bash
git clone https://github.com/AmazingRobin/anyaigc-canvas.git
cd anyaigc-canvas/web
bun install
bun run dev
```

开发服务器默认运行在 `http://localhost:3000`。

常用命令：

```bash
bun run check
bun run build
```

## ☁️ 部署到 Vercel

1. 📦 在 Vercel 导入本仓库。
2. 📁 将 **Root Directory** 设置为 `web`。
3. 🏗️ 使用默认构建命令 `bun run build` 并部署。
4. 🌐 在 Vercel 添加自定义域名 `canvas.anyaigc.com`，再按 Vercel 提示配置 DNS 记录。

无需在 Vercel 配置平台 API Key 环境变量。应用由用户在浏览器中填写各自的 Key，并由前端直接请求 API。

## 🔒 数据与安全

- 🗃️ API Key、画布、素材、提示词和生成记录默认保存在用户浏览器本地。
- 🛡️ 前端直接请求 AnyAIGC API，请仅在可信设备和浏览器中输入自己的 API Key。
- 🔗 WebDAV 为可选功能，连接信息由用户自行填写和管理。
- ☁️ 项目不提供云同步，也不会将用户内容或 API Key 上传至项目自有服务。

## 📚 文档

- 🧭 [文档索引](docs/index.md)
- 🚀 [快速开始与部署说明](docs/content/docs/overview/quick-start.mdx)
- 🧪 [待人工验证事项](docs/content/docs/progress/pending-test.mdx)

## 🌟 关于 AnyAIGC

AnyAIGC 在[亚洲站](https://anyaigc.com)和[国际站](https://anyaigc.ai)提供多模型 AI API 与控制台服务。请在设置中选择对应平台，再使用该平台创建的 Key；本项目使用用户自有 Key 接入模型能力。

## 📜 上游项目与许可证

AnyAIGC Canvas 的上游项目是 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)。本项目保留上游项目的署名与许可信息，并以 [AGPL-3.0](LICENSE) 继续发布。使用、修改、部署或通过网络向用户提供本项目时，请遵守许可证条款，尤其是 AGPL-3.0 对网络服务源码提供的要求。
