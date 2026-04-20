import { motion } from "motion/react";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inner padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  /** Adds hover elevation + tap scale */
  interactive?: boolean;
  as?: "div" | "article" | "section";
}

const paddings: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-5",
  lg:   "p-6",
};

export function Card({
  padding = "md",
  interactive = false,
  as: Tag = "div",
  className,
  children,
  onClick,
  ...rest
}: CardProps) {
  const base = cn(
    "rounded-lg shadow-card",
    "border border-cream-200",
    "transition-shadow duration-200",
    paddings[padding],
    interactive && "cursor-pointer hover:shadow-float",
    className
  );

  const style = {
    background: "linear-gradient(145deg, #FFFDF8 0%, #FAF6EC 100%)",
    ...rest.style,
  };

  if (interactive) {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.12 }}
        className={base}
        onClick={onClick}
        style={style}
        {...(rest as object)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <Tag className={base} onClick={onClick} style={style} {...rest}>
      {children}
    </Tag>
  );
}
