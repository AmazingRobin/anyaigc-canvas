"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppLegalFooter } from "@/components/layout/app-legal-footer";
import { AppTopNav } from "@/components/layout/app-top-nav";

export default function UserLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isCanvasWorkspace = /^\/canvas\/[^/]+/.test(pathname);
    const isHomePage = pathname === "/";

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <AppTopNav />
            {isCanvasWorkspace ? (
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="min-h-full">{children}</div>
                    {isHomePage ? <AppLegalFooter /> : null}
                </div>
            )}
        </div>
    );
}
