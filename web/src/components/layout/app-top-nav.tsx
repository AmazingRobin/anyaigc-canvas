"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { RELAYBASES_HOME_URL, relayBasesLinks } from "@/constant/relaybases-links";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { sharedText } from "@/lib/i18n-shared";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/stores/use-language-store";
import { useState } from "react";

export function AppTopNav() {
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const language = useLanguageStore((state) => state.language);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 shrink-0 border-b border-stone-200 bg-background/90 backdrop-blur-xl dark:border-stone-800">
                    <div className="mx-auto flex h-16 w-full max-w-[1800px] items-stretch justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 flex-1 items-center">
                            <a
                                href={RELAYBASES_HOME_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-full shrink-0 items-center gap-2 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300"
                            >
                                <span
                                    className="size-6 shrink-0 bg-current"
                                    style={{
                                        mask: "url(/relaybases-mark.svg) center / contain no-repeat",
                                        WebkitMask: "url(/relaybases-mark.svg) center / contain no-repeat",
                                    }}
                                />
                                <span className="text-base font-semibold">RelayBases</span>
                            </a>
                            <span className="mx-3 hidden h-5 w-px shrink-0 bg-stone-200 sm:block dark:bg-stone-800" />
                            <Link href="/" className="hidden h-full shrink-0 items-center px-1 text-[13px] font-medium leading-none tracking-tight text-stone-500 transition hover:text-stone-950 sm:flex dark:text-stone-400 dark:hover:text-stone-100">
                                <span>{sharedText("无限画布", "Infinite Canvas", language)}</span>
                            </Link>

                            <nav className="hide-scrollbar ml-6 hidden h-16 min-w-0 items-center gap-5 overflow-x-auto lg:gap-6 md:flex xl:ml-8 xl:gap-7">
                                {navigationTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            href={`/${tool.slug}`}
                                            className={cn(
                                                "relative flex h-16 shrink-0 items-center gap-2 text-sm leading-6 transition after:absolute after:inset-x-0 after:bottom-0 after:h-px",
                                                active
                                                    ? "font-medium text-stone-950 after:bg-stone-950 dark:text-stone-100 dark:after:bg-stone-100"
                                                    : "text-stone-500 after:bg-transparent hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                            )}
                                        >
                                            <Icon className="size-4 shrink-0" />
                                            <span className="whitespace-nowrap">{sharedText(tool.label, undefined, language)}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 shrink-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap">
                            <button
                                type="button"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white/80 text-stone-900 shadow-sm transition hover:border-stone-300 hover:bg-white md:hidden dark:border-stone-800 dark:bg-stone-950/70 dark:text-stone-100 dark:hover:border-stone-700 dark:hover:bg-stone-900"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label={sharedText("打开导航菜单", "Open navigation", language)}
                                title={sharedText("导航菜单", "Navigation", language)}
                            >
                                <Menu className="size-5" />
                            </button>
                            <nav className="mr-1 hidden items-center gap-1 2xl:flex" aria-label={sharedText("RelayBases 主站导航", "RelayBases main site navigation", language)}>
                                {relayBasesLinks.map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                            "rounded-full px-3 py-1.5 text-sm leading-none transition",
                                            "primary" in link && link.primary
                                                ? "bg-stone-950 text-white hover:bg-stone-800 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200"
                                                : "text-stone-500 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100",
                                        )}
                                    >
                                        {sharedText(link.label, undefined, language)}
                                    </a>
                                ))}
                            </nav>
                            <UserStatusActions />
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            <AppConfigModal />
        </>
    );
}
