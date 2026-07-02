"use client";

import { GithubOutlined } from "@ant-design/icons";

import { GitHubLink } from "@/components/layout/github-link";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";

const MODIFIED_SOURCE_URL = "https://github.com/gulullu/relaybases-canvas";
const ORIGINAL_SOURCE_URL = "https://github.com/basketikun/infinite-canvas";
const LICENSE_URL = `${MODIFIED_SOURCE_URL}/blob/main/LICENSE`;

export function AppLegalFooter() {
    return (
        <footer className="shrink-0 border-t border-stone-200 bg-background/90 px-4 py-1 text-[10px] leading-4 text-stone-400 backdrop-blur dark:border-stone-800 dark:text-stone-500">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span>基于 infinite-canvas 定制</span>
                    <span className="hidden text-stone-300 sm:inline dark:text-stone-700">/</span>
                    <a href={MODIFIED_SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition hover:text-stone-700 dark:hover:text-stone-300">
                        <GithubOutlined className="text-xs" />
                        修改版源码
                    </a>
                    <span className="hidden text-stone-300 sm:inline dark:text-stone-700">/</span>
                    <a href={ORIGINAL_SOURCE_URL} target="_blank" rel="noreferrer" className="transition hover:text-stone-700 dark:hover:text-stone-300">
                        原项目
                    </a>
                    <span className="hidden text-stone-300 sm:inline dark:text-stone-700">/</span>
                    <a href={LICENSE_URL} target="_blank" rel="noreferrer" className="transition hover:text-stone-700 dark:hover:text-stone-300">
                        AGPL-3.0
                    </a>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <VersionReleaseModal className="text-[10px] font-medium text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300" />
                    <GitHubLink href={MODIFIED_SOURCE_URL} title="修改版源码" className="size-5 bg-transparent text-xs text-stone-400 hover:bg-transparent hover:text-stone-700 dark:text-stone-500 dark:hover:bg-transparent dark:hover:text-stone-300" />
                </div>
            </div>
        </footer>
    );
}
