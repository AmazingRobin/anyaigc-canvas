"use client";

import { Copy, Download, PencilLine, Play, Search, Trash2, Upload, VideoIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Card, Drawer, Empty, Form, Image, Input, Modal, Pagination, Select, Space, Tag, Typography } from "antd";
import { saveAs } from "file-saver";

import { useCopyText } from "@/hooks/use-copy-text";
import { assetDisplaySource, assetDisplayTitle, canonicalAssetSource } from "@/lib/asset-display";
import { formatBytes, readFileAsDataUrl } from "@/lib/image-utils";
import { sharedText, type SharedLanguage } from "@/lib/i18n-shared";
import { createVideoThumbnail, normalizeVideoThumbnail, VIDEO_THUMBNAIL_VERSION } from "@/lib/video-thumbnail";
import { uploadImage } from "@/services/image-storage";
import { cn } from "@/lib/utils";
import { useAssetStore, type Asset, type AssetKind, type ImageAsset, type VideoAsset } from "@/stores/use-asset-store";
import { useLanguageStore } from "@/stores/use-language-store";
import { exportAssets, readAssetPackage } from "./asset-transfer";

type AssetFormValues = {
    kind: AssetKind;
    title: string;
    coverUrl: string;
    tags: string[];
    source?: string;
    note?: string;
    content?: string;
};

type ImageDraft = ImageAsset["data"] | null;

const kindOptions = [
    { zh: "全部", en: "All", value: "all" },
    { zh: "文本", en: "Text", value: "text" },
    { zh: "图片", en: "Image", value: "image" },
    { zh: "视频", en: "Video", value: "video" },
];

export default function AssetsPage() {
    const { message } = App.useApp();
    const language = useLanguageStore((state) => state.language);
    const copyText = useCopyText();
    const [form] = Form.useForm<AssetFormValues>();
    const coverInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const assetInputRef = useRef<HTMLInputElement>(null);
    const assets = useAssetStore((state) => state.assets);
    const addAsset = useAssetStore((state) => state.addAsset);
    const updateAsset = useAssetStore((state) => state.updateAsset);
    const removeAsset = useAssetStore((state) => state.removeAsset);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState<AssetKind | "all">("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [isAssetOpen, setIsAssetOpen] = useState(false);
    const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
    const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
    const [formKind, setFormKind] = useState<AssetKind>("text");
    const [imageDraft, setImageDraft] = useState<ImageDraft>(null);
    const coverUrl = Form.useWatch("coverUrl", form) || "";
    const title = Form.useWatch("title", form) || "";
    const tags = Form.useWatch("tags", form) || [];
    const content = Form.useWatch("content", form) || "";
    const validAssets = useMemo(() => assets.filter((asset) => asset.kind === "text" || asset.kind === "image" || asset.kind === "video"), [assets]);

    const filteredAssets = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return validAssets.filter((asset) => {
            if (kindFilter !== "all" && asset.kind !== kindFilter) return false;
            if (!query) return true;
            return assetSearchText(asset, language).includes(query);
        });
    }, [validAssets, keyword, kindFilter, language]);

    const visibleAssets = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredAssets.slice(start, start + pageSize);
    }, [filteredAssets, page, pageSize]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
        setPage((value) => Math.min(value, maxPage));
    }, [filteredAssets.length, pageSize]);

    const updateVideoAssetCover = useCallback(
        (asset: VideoAsset, thumbnail: string) => {
            updateAsset(asset.id, { coverUrl: thumbnail, metadata: { ...(asset.metadata || {}), thumbnail, thumbnailVersion: VIDEO_THUMBNAIL_VERSION } });
        },
        [updateAsset],
    );

    useEffect(() => {
        let cancelled = false;
        const targets = visibleAssets.filter((asset): asset is VideoAsset => asset.kind === "video" && !isFreshVideoAssetCover(asset) && Boolean(asset.data.url));
        targets.forEach((asset) => {
            void createVideoThumbnail(asset.data.url).then((thumbnail) => {
                if (cancelled || !thumbnail) return;
                updateVideoAssetCover(asset, thumbnail);
            });
        });
        return () => {
            cancelled = true;
        };
    }, [updateVideoAssetCover, visibleAssets]);

    const openCreate = () => {
        setEditingAsset(null);
        setImageDraft(null);
        setFormKind("text");
        form.setFieldsValue({ kind: "text", title: "", coverUrl: "", tags: [], source: assetDisplaySource("手动添加", language), note: "", content: "" });
        setIsAssetOpen(true);
    };

    const openEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setFormKind(asset.kind);
        setImageDraft(asset.kind === "image" ? asset.data : null);
        form.setFieldsValue({
            kind: asset.kind,
            title: assetDisplayTitle(asset, language),
            coverUrl: asset.coverUrl,
            tags: asset.tags || [],
            source: assetDisplaySource(asset.source, language),
            note: asset.note,
            content: asset.kind === "text" ? asset.data.content : "",
        });
        setIsAssetOpen(true);
    };

    const saveAsset = async () => {
        const values = await form.validateFields();
        const base = {
            title: values.title.trim(),
            coverUrl: values.coverUrl?.trim() || (values.kind === "image" && imageDraft ? imageDraft.dataUrl : ""),
            tags: values.tags || [],
            source: canonicalAssetSource(values.source),
            note: values.note?.trim(),
            metadata: editingAsset?.metadata || { source: "manual" },
        };

        if (values.kind === "text") {
            const asset = { ...base, kind: "text" as const, data: { content: (values.content || "").trim() } };
            editingAsset ? updateAsset(editingAsset.id, asset) : addAsset(asset);
        } else {
            if (!imageDraft) {
                message.error(sharedText("请选择图片文件", "Choose an image file", language));
                return;
            }
            const asset = { ...base, kind: "image" as const, data: imageDraft };
            editingAsset ? updateAsset(editingAsset.id, asset) : addAsset(asset);
        }

        message.success(sharedText(editingAsset ? "素材已更新" : "素材已保存", editingAsset ? "Asset updated" : "Asset saved", language));
        setIsAssetOpen(false);
    };

    const readCoverFile = async (file?: File) => {
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        form.setFieldValue("coverUrl", dataUrl);
    };

    const readImageFile = async (file?: File) => {
        if (!file || !file.type.startsWith("image/")) return;
        const image = await uploadImage(file);
        const draft = { dataUrl: image.url, storageKey: image.storageKey, width: image.width, height: image.height, bytes: image.bytes, mimeType: image.mimeType };
        setImageDraft(draft);
        if (!form.getFieldValue("coverUrl")) form.setFieldValue("coverUrl", draft.dataUrl);
        if (!form.getFieldValue("title")) form.setFieldValue("title", file.name);
    };

    const copyAssetText = async (asset: Asset) => {
        if (asset.kind !== "text") return;
        copyText(asset.data.content, sharedText("文本已复制", "Text copied", language));
    };

    const downloadImage = (asset: Asset) => {
        if (asset.kind !== "image" && asset.kind !== "video") return;
        saveAs(asset.kind === "video" ? asset.data.url : asset.data.dataUrl, `${assetDisplayTitle(asset, language) || "asset"}.${asset.data.mimeType.split("/")[1] || "png"}`);
    };

    const exportAllAssets = async () => {
        if (!validAssets.length) {
            message.warning(sharedText("暂无素材可导出", "There are no assets to export", language));
            return;
        }
        await exportAssets(validAssets);
    };

    const importAssetZip = async (file?: File) => {
        if (!file) return;
        try {
            const importedAssets = await readAssetPackage(file);
            importedAssets.forEach((asset) => {
                const payload = { ...asset } as Record<string, unknown>;
                delete payload.id;
                delete payload.createdAt;
                delete payload.updatedAt;
                addAsset(payload as Parameters<typeof addAsset>[0]);
            });
            message.success(language === "en" ? `Imported ${importedAssets.length} ${importedAssets.length === 1 ? "asset" : "assets"}` : `已导入 ${importedAssets.length} 个素材`);
        } catch {
            message.error(sharedText("导入失败，请选择有效的素材压缩包", "Import failed. Choose a valid asset archive.", language));
        } finally {
            if (assetInputRef.current) assetInputRef.current.value = "";
        }
    };

    const confirmDelete = () => {
        if (!deletingAsset) return;
        removeAsset(deletingAsset.id);
        message.success(sharedText("素材已删除", "Asset deleted", language));
        setDeletingAsset(null);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-900 dark:text-stone-100">
            <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-8 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.14)_1px,transparent_1px)]">
                <div className="pb-8">
                    <div className="mx-auto max-w-5xl text-center">
                        <h1 className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">{sharedText("我的素材", "My Assets", language)}</h1>
                        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{sharedText("收藏常用文本和图片，按类型、标题和标签快速查找。", "Save frequently used text and images, then find them quickly by type, title, or tag.", language)}</p>
                    </div>

                    <div className="mx-auto mt-8 w-full max-w-2xl">
                        <Input.Search
                            className="w-full"
                            size="large"
                            allowClear
                            prefix={<Search className="size-4 text-stone-400" />}
                            value={keyword}
                            placeholder={sharedText("搜索标题、内容、标签或来源", "Search titles, content, tags, or sources", language)}
                            onChange={(event) => {
                                setPage(1);
                                setKeyword(event.target.value);
                            }}
                            onSearch={(value) => {
                                setPage(1);
                                setKeyword(value);
                            }}
                        />
                    </div>

                    <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                                <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{sharedText("类型", "Type", language)}</div>
                                <div className="flex flex-wrap gap-2">
                                    {kindOptions.map((option) => (
                                        <Tag.CheckableTag
                                            key={option.value}
                                            checked={kindFilter === option.value}
                                            className={cn("prompt-filter-tag", kindFilter === option.value && "is-active")}
                                            onChange={() => {
                                                setPage(1);
                                                setKindFilter(option.value as AssetKind | "all");
                                            }}
                                        >
                                            {sharedText(option.zh, option.en, language)}
                                        </Tag.CheckableTag>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={() => void exportAllAssets()}
                                >
                                    {sharedText("导出素材", "Export assets", language)}
                                </button>
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={() => assetInputRef.current?.click()}
                                >
                                    {sharedText("导入素材", "Import assets", language)}
                                </button>
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={openCreate}
                                >
                                    {sharedText("新增素材", "Add asset", language)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {visibleAssets.map((asset) => (
                            <AssetCard key={asset.id} asset={asset} onOpen={() => setPreviewAsset(asset)} onEdit={() => openEdit(asset)} onCopy={copyAssetText} onDownload={downloadImage} onDelete={() => setDeletingAsset(asset)} onVideoCoverReady={updateVideoAssetCover} />
                        ))}
                    </div>

                    {!visibleAssets.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={sharedText("没有找到素材", "No assets found", language)} className="py-20" /> : null}

                    <div className="flex justify-center">
                        <Pagination
                            current={page}
                            pageSize={pageSize}
                            total={filteredAssets.length}
                            showSizeChanger
                            pageSizeOptions={[10, 20, 50, 100]}
                            onChange={(nextPage, nextPageSize) => {
                                setPage(nextPage);
                                setPageSize(nextPageSize);
                            }}
                        />
                    </div>
                </div>
            </main>

            <Modal title={sharedText(editingAsset ? "编辑素材" : "新增素材", editingAsset ? "Edit asset" : "Add asset", language)} open={isAssetOpen} width={980} onCancel={() => setIsAssetOpen(false)} onOk={() => void saveAsset()} okText={sharedText("保存", "Save", language)} cancelText={sharedText("取消", "Cancel", language)} destroyOnHidden>
                <div className="grid gap-6 pt-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <Form form={form} layout="vertical" requiredMark={false} initialValues={{ kind: "text", tags: [] }}>
                        <Form.Item name="kind" label={sharedText("类型", "Type", language)}>
                            <Select
                                options={[
                                    { label: sharedText("文本", "Text", language), value: "text" },
                                    { label: sharedText("图片", "Image", language), value: "image" },
                                ]}
                                onChange={(value) => setFormKind(value)}
                            />
                        </Form.Item>
                        <Form.Item name="title" label={sharedText("标题", "Title", language)} rules={[{ required: true, message: sharedText("请输入标题", "Enter a title", language) }]}>
                            <Input data-no-i18n size="large" placeholder={sharedText("给素材起一个容易检索的名字", "Give the asset an easy-to-find name", language)} />
                        </Form.Item>
                        <Form.Item name="coverUrl" label={sharedText("封面 URL", "Cover URL", language)}>
                            <Space.Compact className="w-full">
                                <Input data-no-i18n placeholder={sharedText("可粘贴图片 URL，也可以上传本地封面", "Paste an image URL or upload a local cover", language)} />
                                <Button icon={<Upload className="size-3.5" />} onClick={() => coverInputRef.current?.click()}>
                                    {sharedText("上传", "Upload", language)}
                                </Button>
                            </Space.Compact>
                        </Form.Item>
                        <Form.Item name="tags" label={sharedText("标签", "Tags", language)}>
                            <Select data-no-i18n mode="tags" tokenSeparators={[",", "，"]} placeholder={sharedText("输入标签后回车", "Enter a tag and press Enter", language)} />
                        </Form.Item>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Form.Item name="source" label={sharedText("来源", "Source", language)}>
                                <Input data-no-i18n placeholder={sharedText("手动添加 / 画布 / 提示词库", "Manual / Canvas / Prompt Library", language)} />
                            </Form.Item>
                            <Form.Item name="note" label={sharedText("备注", "Notes", language)}>
                                <Input data-no-i18n placeholder={sharedText("可选", "Optional", language)} />
                            </Form.Item>
                        </div>
                        {formKind === "text" ? (
                            <Form.Item name="content" label={sharedText("文本内容", "Text content", language)} rules={[{ required: true, message: sharedText("请输入文本内容", "Enter text content", language) }]}>
                                <Input.TextArea data-no-i18n rows={8} placeholder={sharedText("保存提示词、说明文案、参考描述等文本素材", "Save prompts, notes, reference descriptions, and other text assets", language)} />
                            </Form.Item>
                        ) : (
                            <Form.Item label={sharedText("图片内容", "Image content", language)} required>
                                <div className="rounded-lg border border-dashed border-stone-300 p-4 dark:border-stone-700">
                                    <Button icon={<Upload className="size-4" />} onClick={() => imageInputRef.current?.click()}>
                                        {sharedText("选择图片文件", "Choose image file", language)}
                                    </Button>
                                    {imageDraft ? (
                                        <Typography.Text type="secondary" className="ml-3 text-xs">
                                            {imageDraft.width}x{imageDraft.height} · {formatBytes(imageDraft.bytes)}
                                        </Typography.Text>
                                    ) : (
                                        <Typography.Text type="secondary" className="ml-3 text-xs">
                                            {sharedText("未选择图片", "No image selected", language)}
                                        </Typography.Text>
                                    )}
                                </div>
                            </Form.Item>
                        )}
                    </Form>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950">
                        <Typography.Text strong>{sharedText("预览", "Preview", language)}</Typography.Text>
                        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
                            {coverUrl || imageDraft?.dataUrl ? (
                                <img src={coverUrl || imageDraft?.dataUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                            ) : (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-5 text-center text-sm text-stone-500 dark:bg-stone-900">{content ? <span data-no-i18n>{content}</span> : sharedText("暂无封面", "No cover", language)}</div>
                            )}
                            <div className="p-4">
                                <Typography.Text strong ellipsis className="block">
                                    {title ? <span data-no-i18n>{title}</span> : sharedText("未命名素材", "Untitled asset", language)}
                                </Typography.Text>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {tags.length ? (
                                        tags.map((tag) => (
                                            <Tag data-no-i18n key={tag} className="m-0">
                                                {tag}
                                            </Tag>
                                        ))
                                    ) : (
                                        <Tag className="m-0">{sharedText("未打标签", "No tags", language)}</Tag>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void readCoverFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void readImageFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
            </Modal>

            <AssetDrawer asset={previewAsset} onClose={() => setPreviewAsset(null)} onCopy={copyAssetText} onDownload={downloadImage} onVideoCoverReady={updateVideoAssetCover} />

            <input ref={assetInputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importAssetZip(event.target.files?.[0])} />

            <Modal title={sharedText("删除素材", "Delete asset", language)} open={Boolean(deletingAsset)} onCancel={() => setDeletingAsset(null)} onOk={confirmDelete} okText={sharedText("删除", "Delete", language)} okButtonProps={{ danger: true }} cancelText={sharedText("取消", "Cancel", language)}>
                {language === "en" ? "Delete “" : "确定删除「"}<span data-no-i18n>{deletingAsset ? assetDisplayTitle(deletingAsset, language) : ""}</span>{language === "en" ? "”? This will remove it from My Assets." : "」吗？删除后会从我的素材中移除。"}
            </Modal>
        </div>
    );
}

function AssetCard({ asset, onOpen, onEdit, onCopy, onDownload, onDelete, onVideoCoverReady }: { asset: Asset; onOpen: () => void; onEdit: () => void; onCopy: (asset: Asset) => void; onDownload: (asset: Asset) => void; onDelete: () => void; onVideoCoverReady: (asset: VideoAsset, thumbnail: string) => void }) {
    const language = useLanguageStore((state) => state.language);
    const cover = assetCoverUrl(asset);
    const summary = assetSummary(asset);
    const displayTitle = assetDisplayTitle(asset, language);
    return (
        <Card
            hoverable
            className="overflow-hidden"
            styles={{ body: { padding: 0 } }}
            cover={
                <button type="button" className="block w-full text-left" onClick={onOpen}>
                    {asset.kind === "video" ? (
                        <VideoAssetPreview asset={asset} cover={cover} onCoverReady={onVideoCoverReady} />
                    ) : cover ? (
                        <img data-no-i18n src={cover} alt={displayTitle} className="aspect-[4/3] w-full object-cover" />
                    ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-5 text-center text-sm leading-6 text-stone-600 dark:bg-stone-900 dark:text-stone-300">{asset.kind === "text" ? <span data-no-i18n>{asset.data.content}</span> : sharedText("暂无封面", "No cover", language)}</div>
                    )}
                </button>
            }
        >
            <button type="button" className="block w-full text-left" onClick={onOpen}>
                <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 data-no-i18n className="line-clamp-1 text-sm font-semibold text-stone-950 dark:text-stone-100">{displayTitle}</h2>
                            <Typography.Text type="secondary" className="mt-1 block text-xs">
                                <span data-no-i18n>{asset.source ? assetDisplaySource(asset.source, language) : sharedText("未标注来源", "No source", language)}</span>
                            </Typography.Text>
                        </div>
                        <Tag className="m-0 shrink-0 text-[11px]">{sharedText(asset.kind === "image" ? "图片" : asset.kind === "video" ? "视频" : "文本", asset.kind === "image" ? "Image" : asset.kind === "video" ? "Video" : "Text", language)}</Tag>
                    </div>
                    <Typography.Paragraph data-no-i18n type="secondary" ellipsis={{ rows: 3 }} className="!mb-0 !mt-2 !text-xs !leading-5">
                        {summary}
                    </Typography.Paragraph>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {(asset.tags || []).slice(0, 3).map((tag) => (
                            <Tag data-no-i18n key={tag} className="m-0 text-[11px]">
                                {tag}
                            </Tag>
                        ))}
                        {!asset.tags?.length ? <Tag className="m-0 text-[11px]">{sharedText("无标签", "No tags", language)}</Tag> : null}
                    </div>
                </div>
            </button>
            <div className="flex items-center gap-2 px-4 pb-4">
                <Button size="small" onClick={onOpen}>
                    {sharedText("查看", "View", language)}
                </Button>
                {asset.kind !== "video" ? (
                    <Button size="small" icon={<PencilLine className="size-3.5" />} onClick={onEdit}>
                        {sharedText("编辑", "Edit", language)}
                    </Button>
                ) : null}
                {asset.kind === "text" ? (
                    <Button size="small" icon={<Copy className="size-3.5" />} onClick={() => void onCopy(asset)}>
                        {sharedText("复制", "Copy", language)}
                    </Button>
                ) : null}
                {asset.kind === "image" || asset.kind === "video" ? (
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(asset)}>
                        {sharedText("下载", "Download", language)}
                    </Button>
                ) : null}
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                    {sharedText("删除", "Delete", language)}
                </Button>
            </div>
        </Card>
    );
}

function AssetDrawer({ asset, onClose, onCopy, onDownload, onVideoCoverReady }: { asset: Asset | null; onClose: () => void; onCopy: (asset: Asset) => void; onDownload: (asset: Asset) => void; onVideoCoverReady: (asset: VideoAsset, thumbnail: string) => void }) {
    const language = useLanguageStore((state) => state.language);
    const cover = asset ? assetCoverUrl(asset) : "";
    const displayTitle = asset ? assetDisplayTitle(asset, language) : "";
    if (asset?.kind === "video") {
        return (
            <Drawer title={sharedText("素材详情", "Asset details", language)} open size="large" onClose={onClose}>
                <div className="space-y-5">
                    <div>
                        <Typography.Title data-no-i18n level={4} className="!mb-2">
                            {displayTitle}
                        </Typography.Title>
                        <Space size={[4, 4]} wrap>
                            <Tag>{sharedText("视频", "Video", language)}</Tag>
                            {(asset.tags || []).map((tag) => (
                                <Tag data-no-i18n key={tag}>{tag}</Tag>
                            ))}
                        </Space>
                    </div>
                    <VideoAssetPlayer asset={asset} cover={cover} onCoverReady={onVideoCoverReady} />
                    <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                        <Typography.Text type="secondary" className="block text-xs">
                            {sharedText("内容", "Content", language)}
                        </Typography.Text>
                        <Typography.Text className="mt-2 block">
                            {asset.data.width}x{asset.data.height} · {formatBytes(asset.data.bytes)} · {asset.data.mimeType}
                        </Typography.Text>
                    </div>
                    {asset.note ? (
                        <div>
                            <Typography.Text type="secondary">{sharedText("备注", "Notes", language)}</Typography.Text>
                            <Typography.Paragraph data-no-i18n className="mt-1">{asset.note}</Typography.Paragraph>
                        </div>
                    ) : null}
                    <Space>
                        <Button type="primary" icon={<Download className="size-4" />} onClick={() => onDownload(asset)}>
                            {sharedText("下载视频", "Download video", language)}
                        </Button>
                    </Space>
                </div>
            </Drawer>
        );
    }
    return (
        <Drawer title={sharedText("素材详情", "Asset details", language)} open={Boolean(asset)} size="large" onClose={onClose}>
            {asset ? (
                <div className="space-y-5">
                    {cover ? (
                        <Image data-no-i18n src={cover} alt={displayTitle} className="rounded-lg" />
                    ) : (
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm leading-6 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">{asset.kind === "text" ? <span data-no-i18n>{asset.data.content}</span> : sharedText("暂无封面", "No cover", language)}</div>
                    )}
                    <div>
                        <Typography.Title data-no-i18n level={4} className="!mb-2">
                            {displayTitle}
                        </Typography.Title>
                        <Space size={[4, 4]} wrap>
                            <Tag>{sharedText(asset.kind === "image" ? "图片" : "文本", asset.kind === "image" ? "Image" : "Text", language)}</Tag>
                            {(asset.tags || []).map((tag) => (
                                <Tag data-no-i18n key={tag}>{tag}</Tag>
                            ))}
                        </Space>
                    </div>
                    <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                        <Typography.Text type="secondary" className="block text-xs">
                            {sharedText("内容", "Content", language)}
                        </Typography.Text>
                        {asset.kind === "text" ? (
                            <Typography.Paragraph data-no-i18n className="mt-2 whitespace-pre-wrap">{asset.data.content}</Typography.Paragraph>
                        ) : (
                            <Typography.Text className="mt-2 block">
                                {asset.data.width}x{asset.data.height} · {formatBytes(asset.data.bytes)} · {asset.data.mimeType}
                            </Typography.Text>
                        )}
                    </div>
                    {asset.note ? (
                        <div>
                            <Typography.Text type="secondary">{sharedText("备注", "Notes", language)}</Typography.Text>
                            <Typography.Paragraph data-no-i18n className="mt-1">{asset.note}</Typography.Paragraph>
                        </div>
                    ) : null}
                    <Space>
                        {asset.kind === "text" ? (
                            <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(asset)}>
                                {sharedText("复制文本", "Copy text", language)}
                            </Button>
                        ) : null}
                        {asset.kind === "image" ? (
                            <Button type="primary" icon={<Download className="size-4" />} onClick={() => onDownload(asset)}>
                                {sharedText("下载图片", "Download image", language)}
                            </Button>
                        ) : null}
                    </Space>
                </div>
            ) : null}
        </Drawer>
    );
}

function VideoAssetPreview({ asset, cover, onCoverReady }: { asset: VideoAsset; cover: string; onCoverReady: (asset: VideoAsset, thumbnail: string) => void }) {
    const language = useLanguageStore((state) => state.language);
    const thumbnail = useVideoThumbnail(asset, cover, onCoverReady);
    return (
        <VideoPosterFrame thumbnail={thumbnail} videoUrl={asset.data.url} label={sharedText("视频", "Video", language)} />
    );
}

function VideoAssetPlayer({ asset, cover, onCoverReady }: { asset: VideoAsset; cover: string; onCoverReady: (asset: VideoAsset, thumbnail: string) => void }) {
    const thumbnail = useVideoThumbnail(asset, cover, onCoverReady);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        setPlaying(false);
    }, [asset.id]);

    if (playing && asset.data.url) {
        return (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-black shadow-sm dark:border-stone-800">
                <video src={asset.data.url} poster={thumbnail || undefined} controls autoPlay playsInline preload="metadata" className="max-h-[64vh] w-full bg-black object-contain" />
            </div>
        );
    }

    return (
        <button type="button" className="block w-full overflow-hidden rounded-xl border border-stone-200 bg-background text-left shadow-sm dark:border-stone-800" onClick={() => setPlaying(true)}>
            <VideoPosterFrame thumbnail={thumbnail} videoUrl={asset.data.url} label={`${asset.data.width}x${asset.data.height}`} />
        </button>
    );
}

function VideoPosterFrame({ thumbnail, videoUrl, label }: { thumbnail: string; videoUrl?: string; label: string }) {
    return (
        <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,rgba(20,184,166,.18),rgba(99,102,241,.14))]">
            {thumbnail ? <img src={thumbnail} alt="" className="size-full object-cover" loading="lazy" decoding="async" /> : videoUrl ? <VideoInlinePreview url={videoUrl} /> : null}
            <div className={`absolute inset-0 ${thumbnail || videoUrl ? "bg-gradient-to-t from-black/35 via-transparent to-black/10" : ""}`} />
            <span className="absolute left-3 top-3 rounded bg-black/65 px-2 text-xs font-semibold leading-5 text-white shadow-sm">{label}</span>
            <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-11 place-items-center rounded-full bg-white/90 text-stone-950 shadow-lg">
                    {thumbnail || videoUrl ? <Play className="ml-0.5 size-5 fill-current" /> : <VideoIcon className="size-5" />}
                </span>
            </span>
        </div>
    );
}

function VideoCoverPlaceholder() {
    const language = useLanguageStore((state) => state.language);
    return <VideoPosterFrame thumbnail="" label={sharedText("视频", "Video", language)} />;
}

function VideoInlinePreview({ url }: { url: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const node = videoRef.current;
        if (!node) return;
        const seekPreviewFrame = () => {
            try {
                if (Number.isFinite(node.duration) && node.duration > 0.8 && node.currentTime < 0.2) node.currentTime = Math.min(0.65, node.duration / 4);
            } catch {}
        };
        node.addEventListener("loadedmetadata", seekPreviewFrame);
        node.addEventListener("loadeddata", seekPreviewFrame);
        node.addEventListener("canplay", seekPreviewFrame);
        return () => {
            node.removeEventListener("loadedmetadata", seekPreviewFrame);
            node.removeEventListener("loadeddata", seekPreviewFrame);
            node.removeEventListener("canplay", seekPreviewFrame);
            node.pause();
        };
    }, [url]);

    return <video ref={videoRef} src={url} className="size-full object-cover" muted playsInline preload="metadata" />;
}

function useVideoThumbnail(asset: VideoAsset, cover: string, onCoverReady: (asset: VideoAsset, thumbnail: string) => void) {
    const [thumbnail, setThumbnail] = useState(isFreshVideoAssetCover(asset) ? cover : "");

    useEffect(() => {
        let cancelled = false;
        setThumbnail(isFreshVideoAssetCover(asset) ? cover : "");
        if (isFreshVideoAssetCover(asset) || !asset.data.url) return;
        void createVideoThumbnail(asset.data.url).then((nextThumbnail) => {
            if (cancelled || !nextThumbnail) return;
            setThumbnail(nextThumbnail);
            onCoverReady(asset, nextThumbnail);
        });
        return () => {
            cancelled = true;
        };
    }, [asset, asset.data.url, cover, onCoverReady]);

    return thumbnail;
}

function assetCoverUrl(asset: Asset) {
    if (asset.kind === "video") return isFreshVideoAssetCover(asset) ? normalizeVideoThumbnail(asset.coverUrl) || normalizeVideoThumbnail(assetMetadataString(asset, "thumbnail")) : "";
    if (asset.coverUrl) return asset.coverUrl;
    if (asset.kind === "image") return asset.data.dataUrl;
    return "";
}

function isFreshVideoAssetCover(asset: VideoAsset) {
    return assetMetadataString(asset, "thumbnailVersion") === VIDEO_THUMBNAIL_VERSION && Boolean(normalizeVideoThumbnail(asset.coverUrl) || normalizeVideoThumbnail(assetMetadataString(asset, "thumbnail")));
}

function assetMetadataString(asset: Asset, key: string) {
    const value = asset.metadata?.[key];
    return typeof value === "string" ? value : "";
}

function assetSummary(asset: Asset) {
    if (asset.kind === "text") return asset.data.content;
    return `${asset.data.width}x${asset.data.height} · ${formatBytes(asset.data.bytes)} · ${asset.data.mimeType}`;
}

function assetSearchText(asset: Asset, language: SharedLanguage) {
    return [asset.title, assetDisplayTitle(asset, language), asset.source || "", assetDisplaySource(asset.source, language), asset.note || "", (asset.tags || []).join(" "), asset.kind === "text" ? asset.data.content : asset.data.mimeType].join(" ").toLowerCase();
}
