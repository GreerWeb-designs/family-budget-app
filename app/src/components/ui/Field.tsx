import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/**
 * Form field wrapper — label + input slot + optional hint/error message.
 * Inputs inside a Field get teal-500 focus ring at 30% alpha automatically
 * via global input styles in index.css.
 */
export function Field({ label, htmlFor, hint, error, children, className, ...rest }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...rest}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-ink-700"
      >
        {label}
      </label>

      {children}

      {error ? (
        <p className="text-xs text-danger font-medium">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Styled input that matches the NestOtter Field aesthetic.
 * Use as the child of <Field>.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError, className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-sm border px-3 py-2.5 text-sm",
        "border-cream-200 bg-[#FFFDF8] text-ink-900",
        "placeholder:text-ink-300",
        "transition-shadow duration-150",
        "focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/20",
        hasError && "border-danger focus:border-danger focus:ring-danger/20",
        className
      )}
      {...rest}
    />
  );
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function SelectInput({ hasError, className, ...rest }: SelectFieldProps) {
  return (
    <select
      className={cn(
        "w-full rounded-sm border px-3 py-2.5 text-sm",
        "border-cream-200 bg-[#FFFDF8] text-ink-900",
        "transition-shadow duration-150",
        "focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/20",
        hasError && "border-danger",
        className
      )}
      {...rest}
    />
  );
}
