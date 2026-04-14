import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  as?: "span" | "p" | "div";
}

/**
 * Uppercase micro-label — used above stat numbers, section titles, card headers.
 * Inter 600 · 11px · tracking-widest · ink-500
 */
export function Eyebrow({ as: Tag = "span", className, children, ...rest }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        "block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
