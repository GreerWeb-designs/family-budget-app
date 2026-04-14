import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface PageHeaderProps {
  title: string;
  /** Lucide icon or any node to the left of the title */
  icon?: ReactNode;
  /** Avatar, button, or any node pinned to the right */
  accessoryRight?: ReactNode;
  className?: string;
}

/**
 * Top-of-page header.
 * Title uses Fraunces (font-display) for warmth.
 * Separated from content by a 1px cream-200 line — no heavy box shadow.
 */
export function PageHeader({ title, icon, accessoryRight, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-2.5 px-4 py-3",
        "bg-cream-50/95 backdrop-blur-sm",
        "border-b border-cream-200",
        className
      )}
    >
      {icon && (
        <span className="flex-shrink-0 text-teal-500" aria-hidden>
          {icon}
        </span>
      )}

      <h1
        className="flex-1 text-xl font-medium text-ink-900 leading-tight"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        {title}
      </h1>

      {accessoryRight && (
        <div className="flex-shrink-0">{accessoryRight}</div>
      )}
    </header>
  );
}
