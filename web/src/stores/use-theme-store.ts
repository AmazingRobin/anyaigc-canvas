import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark";

type ThemeStore = {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
};

function readInitialTheme(): ThemeName {
    if (typeof window === "undefined") return "light";
    if (document.documentElement.classList.contains("dark")) return "dark";
    try {
        const params = new URLSearchParams(window.location.search);
        const queryTheme = params.get("theme");
        if (queryTheme === "light" || queryTheme === "dark") return queryTheme;
        const saved = JSON.parse(localStorage.getItem("infinite-canvas:theme_store") || "{}")?.state?.theme;
        if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "light";
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: readInitialTheme(),
            setTheme: (theme) => set({ theme }),
        }),
        { name: "infinite-canvas:theme_store" },
    ),
);
