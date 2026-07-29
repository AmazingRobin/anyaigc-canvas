import type { Metadata } from "next";
import Script from "next/script";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProviders } from "@/components/layout/app-providers";
import "antd/dist/reset.css";
import "./globals.css";
import React from "react";

export const metadata: Metadata = {
    title: "AnyAIGC Canvas",
    description: "AnyAIGC workspace for image, video, prompt, and agent creation.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning className="font-sans">
            <body
                className="bg-background text-foreground antialiased"
                style={{
                    fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
                }}
            >
                <Script
                    id="theme-script"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `try{var p=new URLSearchParams(location.search);var q=p.get("theme");var s={};try{s=JSON.parse(localStorage.getItem("infinite-canvas:theme_store")||"{}")}catch(e){}var saved=s.state&&s.state.theme;var t=q==="light"||q==="dark"?q:saved==="light"||saved==="dark"?saved:"light";localStorage.setItem("infinite-canvas:theme_store",JSON.stringify({state:{theme:t},version:0}));document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t;var lq=p.get("lang")||p.get("language")||p.get("locale");var ls={};try{ls=JSON.parse(localStorage.getItem("anyaigc-canvas:language_store")||"{}")}catch(e){}var savedLang=ls.state&&ls.state.language;var nl=(navigator&&navigator.language)||"";var lang=/^zh|^cn/i.test(lq||"")?"zh":/^en/i.test(lq||"")?"en":savedLang==="zh"||savedLang==="en"?savedLang:/^en/i.test(nl)?"en":"zh";localStorage.setItem("anyaigc-canvas:language_store",JSON.stringify({state:{language:lang},version:0}));document.documentElement.lang=lang==="zh"?"zh-CN":"en";document.documentElement.dataset.lang=lang}catch(e){document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";document.documentElement.lang="zh-CN";document.documentElement.dataset.lang="zh"}`,
                    }}
                />
                <AntdRegistry>
                    <AppProviders>{children}</AppProviders>
                </AntdRegistry>
            </body>
        </html>
    );
}
