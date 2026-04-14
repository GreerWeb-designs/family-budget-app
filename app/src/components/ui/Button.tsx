import { motion } from "motion/react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-teal-500 text-white hover:bg-teal-600 active:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2",
  secondary:
    "bg-cream-100 text-ink-900 hover:bg-cream-200 active:bg-cream-200 focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2",
  ghost:
    "bg-transparent text-ink-700 hover:bg-cream-100 active:bg-cream-200 focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2",
  danger:
    "bg-danger text-white hover:opacity-90 active:opacity-80 focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8  px-3   text-xs  gap-1.5 rounded-sm",
  md: "h-10 px-4   text-sm  gap-2   rounded-sm",
  lg: "h-12 px-6   text-base gap-2  rounded-md",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className={cn(
        "inline-flex items-center justify-center font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none",
        "disabled:opacity-40 disabled:pointer-events-none",
        "select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...(rest as object)}
    >
      {children}
    </motion.button>
  );
}
