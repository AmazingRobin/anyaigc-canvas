"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button, InputNumber, Modal } from "antd";
import { Grid2x2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { readImageMeta } from "@/lib/image-utils";
import type { ImageSplitParams } from "../utils/canvas-image-data";

export type CanvasImageSplitParams = ImageSplitParams;

const maxGridSize = 12;
const defaultParams: CanvasImageSplitParams = { rows: 2, columns: 2, horizontalLines: buildGridLines(2), verticalLines: buildGridLines(2) };

type SplitAxis = "horizontal" | "vertical";
type ActiveLine = { axis: SplitAxis; index: number } | null;

export function CanvasNodeSplitDialog({ dataUrl, open, onClose, onConfirm }: { dataUrl: string; open: boolean; onClose: () => void; onConfirm: (params: CanvasImageSplitParams) => void }) {
    const previewRef = useRef<HTMLDivElement | null>(null);
    const [params, setParams] = useState(defaultParams);
    const [image, setImage] = useState<{ width: number; height: number } | null>(null);
    const [selectedLine, setSelectedLine] = useState<ActiveLine>(null);
    const [dragLine, setDragLine] = useState<ActiveLine>(null);
    const horizontalLines = normalizeSplitLines(params.horizontalLines, params.rows);
    const verticalLines = normalizeSplitLines(params.verticalLines, params.columns);
    const rows = horizontalLines.length + 1;
    const columns = verticalLines.length + 1;
    const total = rows * columns;
    const pieceSize = image ? { width: Math.max(1, Math.floor(image.width / columns)), height: Math.max(1, Math.floor(image.height / rows)) } : null;

    useEffect(() => {
        if (!open) return;
        setParams(defaultParams);
        setImage(null);
        setSelectedLine(null);
        setDragLine(null);
    }, [dataUrl, open]);

    useEffect(() => {
        if (!open) return;
        void readImageMeta(dataUrl).then(setImage);
    }, [dataUrl, open]);

    const updateGridCount = (axis: SplitAxis, value: string | number | null) => {
        const count = clampGrid(value ?? (axis === "horizontal" ? rows : columns));
        setSelectedLine(null);
        setDragLine(null);
        setParams((current) => (axis === "horizontal" ? { ...current, rows: count, horizontalLines: buildGridLines(count) } : { ...current, columns: count, verticalLines: buildGridLines(count) }));
    };

    const addLine = (axis: SplitAxis) => {
        setSelectedLine(null);
        setDragLine(null);
        setParams((current) => {
            const key = axis === "horizontal" ? "horizontalLines" : "verticalLines";
            const count = axis === "horizontal" ? current.rows : current.columns;
            const lines = normalizeSplitLines(current[key], count);
            if (lines.length >= maxGridSize - 1) return current;
            const next = [...lines, findLineSpot(lines)].sort((a, b) => a - b);
            return axis === "horizontal" ? { ...current, rows: next.length + 1, horizontalLines: next } : { ...current, columns: next.length + 1, verticalLines: next };
        });
    };

    const deleteSelectedLine = () => {
        if (!selectedLine) return;
        setParams((current) => {
            const key = selectedLine.axis === "horizontal" ? "horizontalLines" : "verticalLines";
            const count = selectedLine.axis === "horizontal" ? current.rows : current.columns;
            const next = normalizeSplitLines(current[key], count).filter((_, index) => index !== selectedLine.index);
            return selectedLine.axis === "horizontal" ? { ...current, rows: next.length + 1, horizontalLines: next } : { ...current, columns: next.length + 1, verticalLines: next };
        });
        setSelectedLine(null);
        setDragLine(null);
    };

    const resetLines = () => {
        setParams(defaultParams);
        setSelectedLine(null);
        setDragLine(null);
    };

    const setLine = (axis: SplitAxis, index: number, value: number) => {
        setParams((current) => {
            const key = axis === "horizontal" ? "horizontalLines" : "verticalLines";
            const count = axis === "horizontal" ? current.rows : current.columns;
            const lines = normalizeSplitLines(current[key], count);
            if (index < 0 || index >= lines.length) return current;
            const next = lines.map((line, lineIndex) => (lineIndex === index ? clampLine(value, lines, index) : line));
            return axis === "horizontal" ? { ...current, rows: next.length + 1, horizontalLines: next } : { ...current, columns: next.length + 1, verticalLines: next };
        });
    };

    const startDrag = (axis: SplitAxis, index: number, event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const line = { axis, index };
        setSelectedLine(line);
        setDragLine(line);
        previewRef.current?.setPointerCapture?.(event.pointerId);
    };

    const updateDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragLine || !previewRef.current) return;
        const rect = previewRef.current.getBoundingClientRect();
        const value = dragLine.axis === "vertical" ? (event.clientX - rect.left) / Math.max(rect.width, 1) : (event.clientY - rect.top) / Math.max(rect.height, 1);
        setLine(dragLine.axis, dragLine.index, value);
    };

    const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragLine) return;
        try {
            previewRef.current?.releasePointerCapture?.(event.pointerId);
        } catch {}
        setDragLine(null);
    };

    const confirmParams: CanvasImageSplitParams = { rows, columns, horizontalLines, verticalLines };

    return (
        <Modal title={null} open={open && Boolean(dataUrl)} onCancel={onClose} footer={null} width={820} centered destroyOnHidden>
            <div className="space-y-5">
                <div>
                    <h2 className="text-xl font-semibold">切分图片</h2>
                    <p className="mt-1 text-sm opacity-60">拖动分割线微调切块比例，生成 {total} 个图片子节点</p>
                </div>
                <div className="grid gap-6 md:grid-cols-[minmax(280px,1fr)_300px]">
                    <div className="rounded-xl border p-4">
                        <div className="grid min-h-[320px] place-items-center rounded-lg bg-black/5">
                            <div ref={previewRef} className="relative inline-block max-w-full touch-none overflow-hidden rounded-lg bg-black shadow-xl" onPointerMove={updateDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
                                <img src={dataUrl} alt="" className="block max-h-[360px] max-w-full select-none object-contain opacity-95" draggable={false} />
                                <SplitGrid horizontalLines={horizontalLines} verticalLines={verticalLines} selectedLine={selectedLine} onStartDrag={startDrag} />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="opacity-60">原图</span>
                            <span className="font-semibold">{image ? `${image.width} x ${image.height} px` : "读取中"}</span>
                        </div>
                    </div>
                    <div className="space-y-4 py-1">
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="行数" value={rows} onChange={(value) => updateGridCount("horizontal", value)} />
                            <NumberField label="列数" value={columns} onChange={(value) => updateGridCount("vertical", value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button icon={<Plus className="size-4" />} onClick={() => addLine("horizontal")}>
                                加横线
                            </Button>
                            <Button icon={<Plus className="size-4" />} onClick={() => addLine("vertical")}>
                                加竖线
                            </Button>
                            <Button icon={<Trash2 className="size-4" />} disabled={!selectedLine} onClick={deleteSelectedLine}>
                                删除线
                            </Button>
                            <Button icon={<RefreshCw className="size-4" />} onClick={resetLines}>
                                重置
                            </Button>
                        </div>
                        <div className="rounded-xl border px-4 py-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="opacity-60">子节点</span>
                                <span className="font-semibold">{total} 个</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="opacity-60">平均单块</span>
                                <span className="font-semibold">{pieceSize ? `${pieceSize.width} x ${pieceSize.height}` : "未知"}</span>
                            </div>
                        </div>
                        <Button type="primary" size="large" className="w-full" icon={<Grid2x2 className="size-4" />} onClick={() => onConfirm(confirmParams)}>
                            生成子节点
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string | number | null) => void }) {
    return (
        <label className="block space-y-2">
            <span className="font-medium opacity-75">{label}</span>
            <InputNumber className="w-full" min={1} max={maxGridSize} precision={0} value={value} onChange={onChange} />
        </label>
    );
}

function SplitGrid({
    horizontalLines,
    verticalLines,
    selectedLine,
    onStartDrag,
}: {
    horizontalLines: number[];
    verticalLines: number[];
    selectedLine: ActiveLine;
    onStartDrag: (axis: SplitAxis, index: number, event: ReactPointerEvent<HTMLElement>) => void;
}) {
    return (
        <div className="pointer-events-none absolute inset-0">
            {verticalLines.map((line, index) => {
                const selected = selectedLine?.axis === "vertical" && selectedLine.index === index;
                return (
                    <div key={`column-${index}`} className="pointer-events-auto absolute inset-y-0 w-8 -translate-x-1/2 cursor-ew-resize px-[15px]" style={{ left: `${safePercent(line)}%` }} onPointerDown={(event) => onStartDrag("vertical", index, event)}>
                        <div className={`h-full w-0.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,.45)] ${selected ? "bg-emerald-300" : "bg-white/95"}`} />
                    </div>
                );
            })}
            {horizontalLines.map((line, index) => {
                const selected = selectedLine?.axis === "horizontal" && selectedLine.index === index;
                return (
                    <div key={`row-${index}`} className="pointer-events-auto absolute inset-x-0 h-8 -translate-y-1/2 cursor-ns-resize py-[15px]" style={{ top: `${safePercent(line)}%` }} onPointerDown={(event) => onStartDrag("horizontal", index, event)}>
                        <div className={`h-0.5 w-full rounded-full shadow-[0_0_0_1px_rgba(0,0,0,.45)] ${selected ? "bg-emerald-300" : "bg-white/95"}`} />
                    </div>
                );
            })}
        </div>
    );
}

function buildGridLines(count: number) {
    const gridCount = clampGrid(count);
    return Array.from({ length: Math.max(0, gridCount - 1) }, (_, index) => (index + 1) / gridCount);
}

function normalizeSplitLines(lines: number[] | undefined, count: number) {
    const normalized = (lines || []).map((line) => Math.max(0.01, Math.min(0.99, line))).sort((a, b) => a - b);
    return normalized.length === Math.max(0, clampGrid(count) - 1) ? normalized : buildGridLines(count);
}

function findLineSpot(lines: number[]) {
    const edges = [0, ...lines, 1];
    let bestIndex = 0;
    let bestGap = 0;
    for (let index = 0; index < edges.length - 1; index += 1) {
        const gap = edges[index + 1] - edges[index];
        if (gap > bestGap) {
            bestGap = gap;
            bestIndex = index;
        }
    }
    return (edges[bestIndex] + edges[bestIndex + 1]) / 2;
}

function clampLine(value: number, lines: number[], index: number) {
    const previous = index > 0 ? lines[index - 1] + 0.01 : 0.01;
    const next = index < lines.length - 1 ? lines[index + 1] - 0.01 : 0.99;
    return Math.min(next, Math.max(previous, value));
}

function safePercent(value: number) {
    return Math.round(Math.max(0.01, Math.min(0.99, value)) * 10000) / 100;
}

function clampGrid(value: string | number) {
    const numberValue = Number(value);
    return Math.min(maxGridSize, Math.max(1, Math.round(Number.isFinite(numberValue) ? numberValue : 1)));
}
