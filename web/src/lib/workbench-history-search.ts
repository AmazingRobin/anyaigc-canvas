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
