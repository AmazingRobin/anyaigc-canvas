"use client";

import { useEffect } from "react";

import { translateLooseText } from "@/lib/i18n";
import { useLanguageStore } from "@/stores/use-language-store";

const SKIP_SUBTREE_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE"]);
const SKIP_TEXT_TAGS = new Set(["TEXTAREA", "INPUT"]);
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "title", "placeholder", "alt"];
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function shouldSkipSubtree(element: Element | null): boolean {
    if (!element) return false;
    if (SKIP_SUBTREE_TAGS.has(element.tagName)) return true;
    if (element.closest("[contenteditable='true']")) return true;
    return false;
}

function shouldSkipText(element: Element | null): boolean {
    if (shouldSkipSubtree(element)) return true;
    return Boolean(element?.closest(`${[...SKIP_TEXT_TAGS].join(",")},[data-no-i18n]`));
}

function shouldSkipAttributes(element: Element): boolean {
    return shouldSkipSubtree(element) || element.matches("[data-no-i18n]");
}

function translateTextNode(node: Text, language: "zh" | "en") {
    if (shouldSkipText(node.parentElement)) return;
    if (language === "zh") {
        const value = originalText.get(node);
        if (value !== undefined) {
            originalText.delete(node);
            const current = node.nodeValue ?? "";
            // React may have already rendered a new Chinese value before the
            // language effect runs. Keep that newer source value instead of
            // restoring the previous English render's stale snapshot.
            const hasNewSourceValue = current !== value && translateLooseText(current, "en") !== current;
            if (!hasNewSourceValue && value !== current) node.nodeValue = value;
        }
        return;
    }
    const value = node.nodeValue ?? "";
    const nextValue = translateLooseText(value, language);
    if (nextValue !== value) originalText.set(node, value);
    else {
        const original = originalText.get(node);
        if (original !== undefined && translateLooseText(original, "en") !== value) originalText.delete(node);
    }
    if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
}

function translateAttributes(element: Element, language: "zh" | "en") {
    if (shouldSkipAttributes(element)) return;
    const originals = originalAttributes.get(element) ?? new Map<string, string>();
    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (language === "zh") {
            const original = originals.get(attribute);
            if (original !== undefined) {
                originals.delete(attribute);
                const hasNewSourceValue = value !== null && value !== original && translateLooseText(value, "en") !== value;
                if (value !== null && !hasNewSourceValue && original !== value) element.setAttribute(attribute, original);
            }
            continue;
        }
        if (!value) {
            originals.delete(attribute);
            continue;
        }
        const nextValue = translateLooseText(value, language);
        if (nextValue !== value) {
            originals.set(attribute, value);
            element.setAttribute(attribute, nextValue);
        } else {
            const original = originals.get(attribute);
            if (original !== undefined && translateLooseText(original, "en") !== value) originals.delete(attribute);
        }
    }
    if (originals.size) originalAttributes.set(element, originals);
    else originalAttributes.delete(element);
}

function translateSubtree(root: Node, language: "zh" | "en") {
    if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root as Text, language);
        return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    const element = root.nodeType === Node.ELEMENT_NODE ? (root as Element) : null;
    if (shouldSkipSubtree(element)) return;
    if (element) translateAttributes(element, language);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                return shouldSkipSubtree(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
            return shouldSkipText(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        },
    });

    let node = walker.nextNode();
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, language);
        if (node.nodeType === Node.ELEMENT_NODE) translateAttributes(node as Element, language);
        node = walker.nextNode();
    }
}

export function LanguageDomTranslator() {
    const language = useLanguageStore((state) => state.language);

    useEffect(() => {
        document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
        document.documentElement.dataset.lang = language;
        translateSubtree(document.body, language);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "characterData") {
                    translateSubtree(mutation.target, language);
                    continue;
                }
                if (mutation.type === "attributes") {
                    translateSubtree(mutation.target, language);
                    continue;
                }
                mutation.addedNodes.forEach((node) => translateSubtree(node, language));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: TRANSLATABLE_ATTRIBUTES,
        });

        return () => observer.disconnect();
    }, [language]);

    return null;
}
