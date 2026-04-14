import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface StatNumberProps extends HTMLAttributes<HTMLSpanElement> {
  /** hero = 3xl–4xl display; lg = 2xl; md = xl */
  size?: "hero" | "lg" | "md";
}

const sizes: Record<NonNullable<StatNumberProps["size"]>, string> = {
  hero: "text-[2.75rem] leading-none tracking-tight",
  lg:   "text-[2rem]   leading-none tracking-tight",
  md:   "text-[1.5rem] leading-none tracking-snug",
};

/**
 * Fraunces display number — used for bank balance, totals, hero stats.
 * Always tabular-nums so digits don't shift width.
 */
export function StatNumber({ size = "hero", className, children, ...rest }: StatNumberProps) {
  return (
    <span
      className={cn(
        "font-display font-semibold tabular-nums",
        sizes[size],
        className
      )}
      style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      {...rest}
    >
      {children}
    </span>
  );
}
