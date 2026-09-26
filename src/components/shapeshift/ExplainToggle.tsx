"use client";

import { Activity } from "lucide-react";
import { useSyncExternalStore } from "react";

import { explainStore } from "@/lib/explain-store";
import { cn } from "@/lib/utils";

/**
 * Top-right switch for the Jev pipeline explainer. `?explain=1` stays the source
 * of truth, so the view is still shareable and survives a reload.
 */
export function ExplainToggle() {
  const on = useSyncExternalStore(explainStore.subscribe, explainStore.get, () => false);
  return (
    <button
      type="button"
      onClick={explainStore.toggle}
      aria-pressed={on}
      title={on ? "Hide how this answer happened" : "Show how this answer happened"}
      className={cn(
        "group inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] font-medium shadow-xs transition-[color,background-color,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96]",
        on
          ? "border-brand/40 bg-brand/10 text-brand"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Activity
        aria-hidden
        className={cn("size-4 transition-colors duration-150 ease-out", on && "text-brand")}
      />
      Explain
    </button>
  );
}
