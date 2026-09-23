import assert from "node:assert/strict";

import { buildNodeGenerationContext } from "@/app/(user)/canvas/components/canvas-node-generation";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/app/(user)/canvas/types";
import { mediaRequestError, SEEDANCE_2_5_MODEL } from "@/lib/anyaigc-media-models";

const imageNode: CanvasNodeData = {
    id: "image-1",
    type: CanvasNodeType.Image,
    title: "参考图",
    position: { x: 0, y: 0 },
    width: 340,
    height: 240,
    metadata: { content: "https://example.com/frame.png", mimeType: "image/png", status: "success" },
};

const configNode: CanvasNodeData = {
    id: "config-1",
    type: CanvasNodeType.Config,
    title: "生成配置",
    position: { x: 500, y: 0 },
    width: 340,
    height: 240,
    metadata: { generationMode: "video", composerContent: "让这个人跳舞，并且跳的很嗨", videoOperation: "image-to-video" },
};

const textNode: CanvasNodeData = {
    id: "text-1",
    type: CanvasNodeType.Text,
    title: "说明",
    position: { x: 0, y: 300 },
    width: 340,
    height: 240,
    metadata: { content: "保持主体不变", status: "success" },
};

const connections: CanvasConnection[] = [{ id: "edge-1", fromNodeId: "image-1", toNodeId: "config-1" }];

const connectedImageContext = buildNodeGenerationContext("config-1", [imageNode, configNode], connections, "让这个人跳舞，并且跳的很嗨");
assert.equal(connectedImageContext.imageCount, 1, "组装提示词没有 @ 引用时，仍应使用已连接的参考图");
assert.equal(connectedImageContext.referenceImages[0]?.id, "image-1");
assert.equal(mediaRequestError(SEEDANCE_2_5_MODEL, { imageCount: connectedImageContext.imageCount, videoCount: 0, audioCount: 0, operation: "image-to-video" }, "zh"), "");

const mentionedContext = buildNodeGenerationContext("config-1", [imageNode, { ...configNode, metadata: { ...configNode.metadata, composerContent: "参考 @[node:image-1] 让这个人跳舞" } }], connections, "参考 @[node:image-1] 让这个人跳舞");
assert.equal(mentionedContext.imageCount, 1);
assert.match(mentionedContext.prompt, /图片1/);

const mentionedTextOnly = buildNodeGenerationContext(
    "config-1",
    [imageNode, textNode, { ...configNode, metadata: { ...configNode.metadata, composerContent: "按 @[node:text-1] 生成" } }],
    [...connections, { id: "edge-2", fromNodeId: "text-1", toNodeId: "config-1" }],
    "按 @[node:text-1] 生成",
);
assert.equal(mentionedTextOnly.imageCount, 0, "显式 @ 引用时只使用被提到的素材");
assert.equal(mentionedTextOnly.textCount, 1);

const noInputContext = buildNodeGenerationContext("config-1", [configNode], [], "让这个人跳舞，并且跳的很嗨");
assert.equal(noInputContext.imageCount, 0);
assert.equal(mediaRequestError(SEEDANCE_2_5_MODEL, { imageCount: noInputContext.imageCount, videoCount: 0, audioCount: 0, operation: "image-to-video" }, "zh"), "当前视频模型需要 1 个图片参考素材");

console.log("canvas generation context tests passed");
