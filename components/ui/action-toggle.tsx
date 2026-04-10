"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  actionLabel?: string;
}

export function ActionToggle({
  checked,
  onChange,
  disabled = false,
  className,
  actionLabel,
}: ActionToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked
          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
          : "bg-muted/50 text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-all duration-200",
          checked
            ? "border-green-500 bg-green-500"
            : "border-muted-foreground/30 bg-transparent"
        )}
      >
        {checked ? (
          <CheckIcon className="h-2.5 w-2.5 text-white animate-in zoom-in-50 duration-150" />
        ) : null}
      </span>
      <span className="flex items-center gap-1">
        {checked ? (
          <>
            {actionLabel ? (
              <span className="text-green-600">{actionLabel}</span>
            ) : (
              <span className="text-green-600">Yes</span>
            )}
          </>
        ) : (
          <>
            <span>No</span>
          </>
        )}
      </span>
    </button>
  );
}
