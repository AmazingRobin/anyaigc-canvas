import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LanguageName = "zh" | "en";

type LanguageStore = {
    language: LanguageName;
    setLanguage: (language: LanguageName) => void;
};

export const LANGUAGE_STORE_NAME = "anyaigc-canvas:language_store";

export function normalizeLanguage(value: string | null | undefined): LanguageName | undefined {
    if (!value) return undefined;
    const language = value.toLowerCase();
    if (language.startsWith("zh") || language === "cn") return "zh";
    if (language.startsWith("en")) return "en";
    return undefined;
}

export const useLanguageStore = create<LanguageStore>()(
    persist(
        (set) => ({
            language: "zh",
            setLanguage: (language) => set({ language }),
        }),
        { name: LANGUAGE_STORE_NAME, skipHydration: true },
    ),
);
