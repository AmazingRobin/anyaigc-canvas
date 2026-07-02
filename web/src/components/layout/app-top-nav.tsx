"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { RELAYBASES_HOME_URL, relayBasesLinks } from "@/constant/relaybases-links";
import { RelayBasesCanvasIcon } from "@/components/brand/relaybases-canvas-icon";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AppTopNav() {
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 h-16 shrink-0 border-b border-stone-200 bg-background/90 backdrop-blur-xl dark:border-stone-800">
                    <div className="mx-auto flex h-full w-full max-w-[1800px] items-stretch justify-between gap-4 px-4 sm:px-6 lg:px-8">
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
                            <Link href="/" className="group flex h-full shrink-0 items-center gap-2.5 rounded-full px-2.5 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:bg-stone-950/[0.04] hover:text-stone-700 dark:text-stone-100 dark:hover:bg-white/[0.07] dark:hover:text-white">
                                <RelayBasesCanvasIcon className="size-8 transition duration-300 group-hover:scale-105" />
                                <span className="text-base font-semibold">无限画布</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label="打开导航菜单"
                                title="导航菜单"
                            >
                                <Menu className="size-5" />
                            </button>

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
                                            <span className="whitespace-nowrap">{tool.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 shrink-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap">
                            <nav className="mr-1 hidden items-center gap-1 2xl:flex" aria-label="RelayBases 主站导航">
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
                                        {link.label}
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
