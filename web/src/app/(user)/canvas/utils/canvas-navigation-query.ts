const CANVAS_AGENT_MODES = new Set(["new", "recent", "choose"]);

type SearchParamsLike = {
    get: (name: string) => string | null;
    has: (name: string) => boolean;
};

export function isCanvasAgentMode(mode?: string | null) {
    return CANVAS_AGENT_MODES.has(mode || "");
}

export function hasCanvasAgentCredentials(searchParams: SearchParamsLike) {
    return searchParams.has("agentUrl") && searchParams.has("agentToken");
}

export function canvasAgentQuerySuffix(searchParams: SearchParamsLike) {
    if (!hasCanvasAgentCredentials(searchParams)) return "";
    const params = new URLSearchParams();
    const mode = searchParams.get("mode");
    if (isCanvasAgentMode(mode)) params.set("mode", mode || "");
    const agentUrl = searchParams.get("agentUrl");
    const agentToken = searchParams.get("agentToken");
    if (agentUrl) params.set("agentUrl", agentUrl);
    if (agentToken) params.set("agentToken", agentToken);
    const query = params.toString();
    return query ? `?${query}` : "";
}
