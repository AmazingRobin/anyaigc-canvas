# RelayBases Canvas

RelayBases Canvas 是 RelayBases 基于 [infinite-canvas](https://github.com/basketikun/infinite-canvas) 定制的 AI 创作工作台。它把无限画布、生图工作台、视频创作台、提示词库、素材库、云同步和本地 Agent 编排放在同一套界面中，面向 RelayBases 用户提供更完整的多模态创作流程。

本仓库是修改版源码，遵循 [GNU Affero General Public License v3.0](LICENSE)。原始项目版权与许可信息请见 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)。

## 主要能力

- 无限画布：多画布项目、节点拖拽缩放、连线、小地图、撤销重做、导入导出。
- 生图工作台：支持文生图、参考图、结果管理、素材沉淀、回收站和配置复用。
- 视频创作台：支持参考图/参考视频、结果卡片、统一播放、素材沉淀和生成记录管理。
- 提示词库：沉淀精选提示词，支持在工作台和画布中复用。
- 我的素材：统一管理文本、图片和视频素材，支持导入、导出、编辑、下载和删除。
- RelayBases 云同步：同步画布、素材、生成记录和本地媒体文件，便于跨设备恢复。
- 本地 Agent：通过 Canvas Agent 连接 Codex / Claude Code，让 Agent 通过 MCP 操作当前画布。

## 技术栈

- Next.js
- React
- TypeScript
- Tailwind CSS
- Ant Design
- Zustand
- TanStack Query
- localForage

## 本地开发

```bash
git clone git@github.com:gulullu/relaybases-canvas.git
cd relaybases-canvas/web
bun install
bun run dev
```

默认访问地址：

```text
http://localhost:3000
```

## 构建

```bash
cd web
bun run build
```

项目使用 Next.js standalone 输出，部署时请按当前生产环境的构建和发布流程处理。

## 配置

首次打开后进入右上角配置面板，按实际环境填写：

- 媒体 API Key
- 文本 API Key
- 默认模型
- 推荐分组
- 云同步设置

RelayBases Canvas 默认把用户配置、画布、素材和生成记录保存到浏览器本地；开启云同步后，可同步到 RelayBases 云端存储。

## 目录说明

- `web/`：主站前端与工作台实现。
- `canvas-agent/`：本地 Canvas Agent。
- `plugins/infinite-canvas/`：Codex App 插件。
- `docs/`：项目文档与功能说明。

## 原项目与协议

RelayBases Canvas 基于 [infinite-canvas](https://github.com/basketikun/infinite-canvas) 修改。我们保留原项目署名、原项目链接和 AGPL-3.0 许可声明，并在应用界面 footer 中提供修改版源码、原项目和协议入口。

本项目继续使用 GNU Affero General Public License v3.0。使用、修改、部署或通过网络提供本项目服务时，请遵守 [LICENSE](LICENSE) 中的条款。
