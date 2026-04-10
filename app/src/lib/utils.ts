import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function moneyCompact(n: number | null | undefined) {
  const value = Math.abs(Number(n ?? 0));
  const sign = Number(n ?? 0) < 0 ? "-" : "";
  if (value >= 1000) return `${sign}$${(value / 1000).toFixed(1)}k`;
  return `${sign}$${value.toFixed(2)}`;
}
