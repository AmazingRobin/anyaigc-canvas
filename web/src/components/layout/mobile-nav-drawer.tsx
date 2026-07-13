"use client";

import { Drawer } from "antd";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { relayBasesLinks } from "@/constant/relaybases-links";
import { sharedText } from "@/lib/i18n-shared";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/stores/use-language-store";

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const language = useLanguageStore((state) => state.language);
    return (
        <Drawer title={sharedText("导航", "Navigation", language)} placement="left" size={280} open={open} onClose={onClose} className="md:hidden">
            <div className="space-y-1">
                {navigationTools.map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.slug === activeToolSlug;
                    return (
                        <Link
                            key={tool.slug}
                            href={`/${tool.slug}`}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition",
                                active ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                            )}
                        >
                            <Icon className="size-5" />
                            <span>{sharedText(tool.label, undefined, language)}</span>
                        </Link>
                    );
                })}
            </div>
            <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-800">
                <p className="px-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-400">RelayBases</p>
                <div className="mt-2 space-y-1">
                    {relayBasesLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={onClose}
                            className={cn(
                                "flex items-center justify-between rounded-lg px-3 py-3 text-base transition",
                                "primary" in link && link.primary
                                    ? "bg-stone-950 font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
                                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                            )}
                        >
                            <span>{sharedText(link.label, undefined, language)}</span>
                            <ExternalLink className="size-4 opacity-60" />
                        </a>
                    ))}
                </div>
            </div>
        </Drawer>
    );
}
