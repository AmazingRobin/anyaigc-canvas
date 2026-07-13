"use client";

import { useState } from "react";
import { Button, Modal } from "antd";

import { canvasText } from "@/lib/i18n-canvas";
import { recordDeletedSyncIds } from "@/services/app-sync";
import { useLanguageStore } from "@/stores/use-language-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { useCanvasStore } from "../stores/use-canvas-store";
import { useCanvasUiStore } from "../stores/use-canvas-ui-store";

export function CanvasDeleteProjectsDialog() {
    const language = useLanguageStore((state) => state.language);
    const [deleting, setDeleting] = useState(false);
    const ids = useCanvasUiStore((state) => state.deleteProjectIds);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const removeSelectedIds = useCanvasUiStore((state) => state.removeSelectedProjectIds);
    const deleteProjects = useCanvasStore((state) => state.deleteProjects);
    const cleanupImages = useAssetStore((state) => state.cleanupImages);
    const confirm = async () => {
        if (!ids.length || deleting) return;
        setDeleting(true);
        try {
            await recordDeletedSyncIds("canvas", ids);
            deleteProjects(ids);
            cleanupImages();
            removeSelectedIds(ids);
            setDeleteIds([]);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Modal
            title="删除画布？"
            open={ids.length > 0}
            centered
            onCancel={() => {
                if (!deleting) setDeleteIds([]);
            }}
            footer={
                <>
                    <Button disabled={deleting} onClick={() => setDeleteIds([])}>
                        取消
                    </Button>
                    <Button danger type="primary" loading={deleting} onClick={() => void confirm()}>
                        删除
                    </Button>
                </>
            }
        >
            <p className="text-sm text-stone-500">{canvasText(`将删除 ${ids.length} 个画布，里面的节点和连线也会一起移除。`, `${ids.length} ${ids.length === 1 ? "canvas" : "canvases"} and all of their nodes and connections will be deleted.`, language)}</p>
        </Modal>
    );
}
