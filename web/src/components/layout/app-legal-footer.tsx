"use client";

const SUPPORT_URL = "https://anyaigc.ai/customersupport";

export function AppLegalFooter() {
    return (
        <footer className="shrink-0 border-t border-stone-200 bg-background/90 px-4 py-1 text-[10px] leading-4 text-stone-400 backdrop-blur dark:border-stone-800 dark:text-stone-500">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span>AnyAIGC Canvas</span>
                    <span className="hidden text-stone-300 sm:inline dark:text-stone-700">/</span>
                    <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="transition hover:text-stone-700 dark:hover:text-stone-300">
                        联系客服
                    </a>
                </div>
            </div>
        </footer>
    );
}
