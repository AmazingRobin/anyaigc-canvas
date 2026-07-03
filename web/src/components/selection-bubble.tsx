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
                "inline-grid size-8 place-items-center rounded-full border shadow-sm backdrop-blur transition",
                selected ? "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-white/80 bg-white/75 text-stone-500 hover:bg-white hover:text-stone-900 dark:border-white/10 dark:bg-stone-950/70 dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-white",
                className,
            )}
            onClick={(event) => {
                event.stopPropagation();
                onSelectedChange(!selected);
            }}
        >
            <span className={cn("grid size-4 place-items-center rounded-[5px] border transition", selected ? "border-white/80 bg-white text-stone-950 dark:border-stone-950/70 dark:bg-stone-950 dark:text-white" : "border-current/45 bg-white/40 dark:bg-white/10")}>{selected ? <Check className="size-3" /> : null}</span>
        </button>
    );
}
