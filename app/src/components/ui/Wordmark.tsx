import { BrandMark } from "./BrandMark";
import { cn } from "../../lib/utils";

export interface WordmarkProps {
  size?: "xs" | "sm" | "md" | "xl" | "lg";
  /**
   * "inline" — embeds the otter logo as the O in "NestOtter". Only use on
   *             light backgrounds (cream-50, white) where the transparent logo
   *             reads correctly.
   * "plain"  — renders "NestOtter" as plain Fraunces text with no embedded
   *             logo. Use on any dark background (teal-700, etc.).
   * Defaults to "inline".
   */
  variant?: "inline" | "plain";
  className?: string;
}

const configs = {
  xs: { logoSize: 23, textClass: "text-xl"   },
  sm: { logoSize: 20, textClass: "text-lg"   },
  md: { logoSize: 28, textClass: "text-2xl"  },
  xl: { logoSize: 36, textClass: "text-3xl"  },
  lg: { logoSize: 40, textClass: "text-4xl"  },
};

/**
 * "Nest[logo]tter" wordmark.
 * Use variant="inline" on light backgrounds, variant="plain" on dark.
 */
export function Wordmark({ size = "md", variant = "inline", className }: WordmarkProps) {
  const { logoSize, textClass } = configs[size];

  const baseClass = cn(
    "inline-flex items-baseline gap-0",
    "font-medium text-ink-900 select-none",
    textClass,
    className
  );

  if (variant === "plain") {
    return (
      <span
        className={baseClass}
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        aria-label="NestOtter"
      >
        NestOtter
      </span>
    );
  }

  return (
    <span
      className={baseClass}
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
