import Link from "next/link";
import { ArrowUpRight, BookOpen, Rocket } from "lucide-react";
import { appName, gitConfig } from "@/lib/shared";

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
const canvasUrl = "https://canvas.anyaigc.com/canvas?mode=new";

const showcaseImages = [
  {
    src: "/showcase/prompt-001.webp",
    title: "电影感人像",
    caption: "人物、光线和氛围参考可以直接沉淀进工作流。",
  },
  {
    src: "/showcase/prompt-012.webp",
    title: "产品细节",
    caption: "适合产品视觉、材质探索和电商主图方向。",
  },
  {
    src: "/showcase/prompt-021.webp",
    title: "建筑场景",
    caption: "把空间、参考图和生成结果放在同一张画布上比较。",
  },
  {
    src: "/showcase/prompt-035.webp",
    title: "自然风景",
    caption: "用节点串联不同风格版本，保留每一步灵感。",
  },
  {
    src: "/showcase/prompt-051.webp",
    title: "3D 概念",
    caption: "从概念草案到精修提示词，连续迭代更顺手。",
  },
  {
    src: "/showcase/prompt-091.webp",
    title: "海报主视觉",
    caption: "适合活动海报、社媒主视觉和风格板整理。",
  },
];

const capabilities = [
  ["画布编排", "用节点组织提示词、参考图、生成结果和后续改写。"],
  ["图片生成", "对接 AnyAIGC 媒体接口，支持生成、编辑和素材沉淀。"],
  ["Agent 辅助", "文本模型理解画布状态，再通过工具调用执行画布操作。"],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <section className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-10 md:px-10 md:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
            <Rocket className="size-3.5 text-emerald-300" />
            AnyAIGC AI 视觉工作台
          </div>
          <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl [font-family:var(--font-display)]">
            {appName}
            <span className="block text-zinc-400">
              从提示词到成片的连续画布
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400">
            把图片生成、参考图编辑、提示词库、素材管理和 Agent
            操作放在同一个空间里。适合用来探索视觉方案、沉淀高质量提示词，并把好结果继续复用。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={canvasUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
              进入画布
              <ArrowUpRight className="size-4" />
            </a>
            <Link
              href="/docs/overview/quick-start"
              className="inline-flex items-center justify-center gap-2 border border-white/16 px-5 py-3 text-sm font-medium text-zinc-100 transition hover:border-white/36 hover:bg-white/[0.06]"
            >
              <BookOpen className="size-4" />
              使用说明
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 grid-rows-2 gap-2 overflow-hidden border border-white/10 bg-white/[0.03] p-2">
          {showcaseImages.map((item, index) => (
            <figure
              key={item.src}
              className={
                index === 0
                  ? "group relative col-span-2 row-span-2 overflow-hidden bg-zinc-900"
                  : "group relative overflow-hidden bg-zinc-900"
              }
            >
              <img
                src={item.src}
                alt={`${item.title}示例`}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full min-h-36 w-full object-cover opacity-95 transition duration-700 group-hover:scale-[1.03]"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <span className="text-xs font-medium text-white">
                  {item.title}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-6 md:grid-cols-3 md:px-10">
          {capabilities.map(([title, description]) => (
            <article
              key={title}
              className="border border-white/10 bg-black/20 p-4"
            >
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:px-10 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Showcase
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            本地提示词库示例
          </h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            这些示例来自 AnyAIGC
            定制提示词库，图片资源随项目本地发布，避免上线后依赖第三方图床。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {showcaseImages.slice(1).map((item) => (
            <article
              key={item.src}
              className="grid grid-cols-[104px_1fr] gap-3 border border-white/10 bg-white/[0.03] p-2"
            >
              <img
                src={item.src}
                alt={`${item.title}示例`}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
              <div className="min-w-0 py-1 pr-2">
                <h3 className="truncate text-sm font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-400">
                  {item.caption}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-white/10 px-5 py-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between md:px-10">
        <p>
          基于 Infinite Canvas 二次开发，遵循
          AGPL-3.0。保留原项目来源和许可证信息。
        </p>
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex w-fit items-center gap-2 text-zinc-300 transition hover:text-white"
        >
          <img src="/github.svg" alt="" className="size-4 invert" />
          原项目 GitHub
          <ArrowUpRight className="size-4" />
        </a>
      </section>
    </main>
  );
}
