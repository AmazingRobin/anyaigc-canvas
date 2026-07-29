"use client";

import { ANYAIGC_PRIVACY_URL } from "@/constant/anyaigc-links";

const ORIGINAL_SOURCE_URL = "https://github.com/basketikun/infinite-canvas";
const LICENSE_URL = `${ORIGINAL_SOURCE_URL}/blob/main/LICENSE`;

export function AppLegalFooter() {
    return (
        <footer className="shrink-0 border-t border-stone-200 bg-background/90 px-4 py-1 text-[10px] leading-4 text-stone-400 backdrop-blur dark:border-stone-800 dark:text-stone-500">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span>AnyAIGC Canvas</span>
                    <span className="hidden text-stone-300 sm:inline dark:text-stone-700">/</span>
                    <a href={ORIGINAL_SOURCE_URL} target="_blank" rel="noreferrer" className="transition hover:text-stone-700 dark:hover:text-stone-300">
                        开源项目
                    </a>
                    <span className="hidden text-stone-300 sm:inline dark:text-stone-700">/</span>
                    <a href={LICENSE_URL} target="_blank" rel="noreferrer" className="transition hover:text-stone-700 dark:hover:text-stone-300">
                        AGPL-3.0
                    </a>
                    <span className="hidden text-stone-300 sm:inline dark:text-stone-700">/</span>
                    <a href={ANYAIGC_PRIVACY_URL} target="_blank" rel="noreferrer" className="transition hover:text-stone-700 dark:hover:text-stone-300">
                        隐私政策
                    </a>
                </div>
            </div>
        </footer>
    );
}
