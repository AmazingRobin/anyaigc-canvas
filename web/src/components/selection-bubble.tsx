"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectionBubbleProps = {
    selected: boolean;
    onSelectedChange: (checked: boolean) => void;
    ariaLabel: string;
    className?: string;
};

export function SelectionBubble({ selected, onSelectedChange, ariaLabel, className }: SelectionBubbleProps) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            aria-pressed={selected}
            className={cn(
                "inline-grid size-7 place-items-center rounded-full border shadow-[0_2px_7px_rgba(15,23,42,0.06)] backdrop-blur-md transition hover:opacity-100",
                selected ? "border-stone-300/60 bg-white/80 text-stone-700 dark:border-stone-600/60 dark:bg-stone-950/75 dark:text-stone-200" : "border-stone-200/60 bg-white/40 text-stone-400 opacity-[0.68] hover:bg-white/70 hover:text-stone-700 dark:border-white/10 dark:bg-stone-950/40 dark:text-stone-500 dark:hover:bg-stone-950/70 dark:hover:text-stone-200",
                className,
            )}
            onClick={(event) => {
                event.stopPropagation();
                onSelectedChange(!selected);
            }}
        >
            <span className={cn("grid size-3.5 place-items-center rounded-[4px] border transition", selected ? "border-stone-400/50 bg-stone-200/70 text-stone-700 dark:border-stone-500/50 dark:bg-stone-700/60 dark:text-stone-100" : "border-current/35 bg-transparent")}>{selected ? <Check className="size-2.5" /> : null}</span>
        </button>
    );
}
