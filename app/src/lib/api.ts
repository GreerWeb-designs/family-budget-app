// src/lib/api.ts

type QueryValue = string | number | boolean | undefined | null;

type ApiInit = RequestInit & {
  query?: Record<string, QueryValue>;
};

const DEFAULT_PROD_API_BASE = "https://family-budget-api.bob-31b.workers.dev";

/**
 * Decide where API calls go:
 * - If VITE_API_BASE is set, use it (prod/staging)
 * - Otherwise:
 *   - Local dev: use same-origin "/api" and rely on Vite proxy
 *   - Non-local: fall back to your workers.dev domain
 */
export function getApiBase(): string {
  const envBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (envBase) return envBase.replace(/\/+$/, ""); // strip trailing /

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  if (isLocal) return ""; // same-origin; Vite proxy handles /api
  return DEFAULT_PROD_API_BASE;
}

function ensureLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildUrl(path: string, query?: ApiInit["query"]) {
  const base = getApiBase();
  const normalizedPath = ensureLeadingSlash(path);

  // If base is empty, URL() needs an origin; use current origin.
  const url = new URL(base ? `${base}${normalizedPath}` : normalizedPath, window.location.origin);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
}

function isJson(contentType: string | null) {
  if (!contentType) return false;
  return contentType.includes("application/json") || contentType.includes("+json");
}

async function readBody(res: Response) {
  const ct = res.headers.get("content-type");
  const text = await res.text();
  return { ct, text };
}

function truncate(s: string, n = 400) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(path: string, init: ApiInit = {}): Promise<T> {
  const { query, headers, ...rest } = init;

  const url = buildUrl(path, query);

  const res = await fetch(url, {
    credentials: "include", // cookie-based session
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const { ct, text } = await readBody(res);

  if (!res.ok) {
    if (isJson(ct)) {
      try {
        const data = JSON.parse(text);
        const msg = data?.error || data?.message || `HTTP ${res.status}`;
        throw new ApiError(msg, res.status, data?.code);
      } catch (inner) {
        if (inner instanceof ApiError) throw inner;
      }
    }
    throw new ApiError(`HTTP ${res.status} ${res.statusText}: ${truncate(text)}`, res.status);
  }

  if (!text) return undefined as T;

  // Prefer content-type for parsing
  if (isJson(ct)) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Expected JSON but got invalid JSON: ${truncate(text)}`);
    }
  }

  // If server forgot header but body is JSON, try anyway
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
