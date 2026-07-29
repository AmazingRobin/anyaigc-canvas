# AnyAIGC Canvas

AnyAIGC Canvas 是面向 AnyAIGC 用户的浏览器端 AI 创作工作台。它将无限画布、图片生成、视频生成、提示词库、素材库和本地 Agent 工作流放在同一界面中；每位用户使用自己的 AnyAIGC API Key。

项目基于 [infinite-canvas](https://github.com/basketikun/infinite-canvas) 二次开发，遵循 [GNU Affero General Public License v3.0](LICENSE)。

## 功能

- 无限画布：创建多个画布，在画布中组织文本、图片、视频和生成节点，支持连线、小地图、撤销重做、导入与导出。
- 图片创作：支持文生图、图生图和蒙版编辑；可使用当前 Key 返回且 Canvas 已接入的 GPT Image、Nano Banana 和 Grok 图片模型。
- 视频创作：支持文生视频、图生视频、首尾帧视频，以及部分模型的动作视频参考和多模态参考素材。
- 提示词与素材：内置精选提示词库；画布、素材和生成记录保存在浏览器本地，可在工作台和画布中复用。
- WebDAV：可选的用户自有 WebDAV 备份与跨设备同步，不提供平台云同步。
- Canvas Agent：可连接在线或本地 Agent，通过工具调用辅助操作当前画布。

## 支持的媒体模型

媒体模型由当前 API Key 请求 `/v1/models` 后动态决定：只有接口实际返回、且下列列表已接入的模型才会显示和可选。

| 类型 | 已接入模型 |
| --- | --- |
| 图片 | `gpt-image-2`、`gemini-3.1-flash-image-preview`（Nano Banana 2）、`gemini-3-pro-image-preview`（Nano Banana Pro）、`grok-imagine-image`、`grok-imagine-image-pro` |
| 视频 | `grok-imagine-video`、`grok-imagine-video-1.5`、`kling-motion-control`、`kling-omni-video`、`kling-3.0-turbo`、`MiniMax-Hailuo-02`、`MiniMax-Hailuo-2.3` |

不同模型支持的生成方式和参考素材不同，界面会根据所选模型限制可用参数。比如 `kling-motion-control` 需要一张图片和一个动作视频参考，MiniMax Hailuo 支持文生、首帧图生和首尾帧视频。

## 使用方式

1. 打开应用右上角的“设置”。
2. 分别填写自己的媒体 API Key 和文本 API Key；Key 仅保存在当前浏览器中。
3. 创建 Key 时推荐选择“智能自动 / Smart Auto”分组。
4. 点击“获取模型”，再在图片、视频或画布中选择可用模型并开始创作。

> 智能自动分组可能不返回 Gemini 图片模型。需要使用 Nano Banana 2 / Pro 时，请创建已设置 Gemini 支持的分组 Key（例如特价 banana），然后重新点击“获取模型”。

## 本地开发

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

## 部署到 Vercel

1. 在 Vercel 导入本仓库。
2. 将 **Root Directory** 设置为 `web`。
3. 使用默认构建命令 `bun run build` 并部署。
4. 在 Vercel 添加自定义域名 `canvas.anyaigc.com`，再按 Vercel 提示配置 DNS 记录。

无需在 Vercel 配置平台 API Key 环境变量。应用由用户在浏览器中填写各自的 Key，并由前端直接请求 API。

## 数据与安全

- API Key、画布、素材、提示词和生成记录默认保存在用户浏览器本地。
- 前端直接请求 AnyAIGC API，请仅在可信设备和浏览器中输入自己的 API Key。
- WebDAV 为可选功能，连接信息由用户自行填写和管理。
- 项目不提供云同步，也不会将用户内容或 API Key 上传至项目自有服务。

## 文档

- [文档索引](docs/index.md)
- [快速开始与部署说明](docs/content/docs/overview/quick-start.mdx)
- [待人工验证事项](docs/content/docs/progress/pending-test.mdx)

## 关于 AnyAIGC

AnyAIGC [API 中转站](https://anyaigc.com) 提供多模型 AI API 与控制台服务。你可以在 [API Key 管理页](https://anyaigc.com/console/token) 创建自己的 Key，在 [控制台](https://anyaigc.com/console) 查看和管理账户信息。本项目使用用户自有 Key 接入 AnyAIGC 的模型能力。

## 上游项目与许可证

AnyAIGC Canvas 的上游项目是 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)。本项目保留上游项目的署名与许可信息，并以 [AGPL-3.0](LICENSE) 继续发布。使用、修改、部署或通过网络向用户提供本项目时，请遵守许可证条款，尤其是 AGPL-3.0 对网络服务源码提供的要求。
