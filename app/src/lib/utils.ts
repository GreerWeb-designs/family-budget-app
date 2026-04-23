import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function money(n: number | null | undefined) {
  const cents = Math.round(Number(n ?? 0) * 100);
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function moneyCompact(n: number | null | undefined) {
  const cents = Math.round(Number(n ?? 0) * 100);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}
