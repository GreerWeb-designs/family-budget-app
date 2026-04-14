import { BrandMark } from "./BrandMark";
import { cn } from "../../lib/utils";

export interface WordmarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const configs = {
  sm: { logoSize: 20, textClass: "text-lg"   },
  md: { logoSize: 28, textClass: "text-2xl"  },
  lg: { logoSize: 40, textClass: "text-4xl"  },
};

/**
 * "Nest[logo]tter" wordmark.
 * The BrandMark's tail-circle replaces the O in "Otter".
 * Laid out as: Nest + logo (inline) + tter — all baseline-aligned.
 */
export function Wordmark({ size = "md", className }: WordmarkProps) {
  const { logoSize, textClass } = configs[size];

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0",
        "font-medium text-ink-900 select-none",
        textClass,
        className
      )}
      style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      aria-label="NestOtter"
    >
      {/* "Nest" */}
      <span>Nest</span>

      {/* The logo — shift it up slightly so the circle sits on the text baseline */}
      <span
        className="inline-flex items-center"
        style={{ marginBottom: `-${logoSize * 0.08}px` }}
        aria-hidden
      >
        <BrandMark size={logoSize} alt="" />
      </span>

      {/* "tter" — the O was replaced by the logo */}
      <span>tter</span>
    </span>
  );
}
