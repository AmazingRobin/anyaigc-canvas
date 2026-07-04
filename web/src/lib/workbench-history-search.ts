function normalizeSearchText(value: string) {
    return value.toLowerCase().replace(/\s+/g, "");
}

export function matchesWorkbenchPromptSearch(prompt: string, query: string) {
    const needle = normalizeSearchText(query.trim());
    if (!needle) return true;

    const haystack = normalizeSearchText(prompt || "");
    if (!haystack) return false;
    if (haystack.includes(needle)) return true;

    let cursor = 0;
    for (const char of needle) {
        const next = haystack.indexOf(char, cursor);
        if (next === -1) return false;
        cursor = next + char.length;
    }
    return needle.length > 1;
}

type WorkbenchHistorySortItem = {
    createdAt?: number;
    pinnedAt?: number;
};

export function sortWorkbenchHistoryItems<T extends WorkbenchHistorySortItem>(items: T[]) {
    return [...items].sort((a, b) => {
        const pinnedDiff = (b.pinnedAt || 0) - (a.pinnedAt || 0);
        if (pinnedDiff) return pinnedDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });
}
