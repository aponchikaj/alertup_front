/**
 * Minimal HTTP client built on the native fetch API.
 *
 * Replaces axios. It reproduces the three axios behaviours the app relied on:
 *   1. cookies are sent cross-origin (`withCredentials` -> `credentials: 'include'`)
 *   2. a Bearer token from localStorage is attached (the Safari/iOS fallback
 *      that used to live in an axios request interceptor in main.tsx)
 *   3. non-2xx responses reject rather than resolve, so existing
 *      try/catch call sites keep working
 *
 * It also does something axios was not doing here: it preserves the server's
 * error message, so callers can show why a request failed instead of a
 * blanket "Something went wrong."
 */

import { getApiBaseUrl } from './env';

/** Backend origin, with any trailing slash removed. */
export const API_BASE_URL: string = getApiBaseUrl();

/** Backend origin including the `/api` prefix every route lives under. */
export const API_URL = `${API_BASE_URL}/api`;

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * The response envelope most of this API returns.
 *
 * `Message` is deliberately loose: depending on the endpoint it is either a
 * human-readable string or the actual payload (a building, a list of logs, a
 * settings object). Narrowing it would mean re-typing every call site, so it
 * stays permissive and the index signature keeps the extra top-level fields
 * some routes add (Owner, token, user, ...) accessible.
 */
export interface ApiResponse {
  Success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Message: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Envelope used by the password-reset routes, which use lowercase keys. */
export interface ApiResponseLower {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Plain object (sent as JSON) or FormData (sent as multipart). */
  body?: unknown;
  headers?: Record<string, string>;
  /** Query string parameters; undefined/null values are skipped. */
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  /** Set false to omit cookies and the Bearer token. Defaults to true. */
  withCredentials?: boolean;
  signal?: AbortSignal;
}

const buildUrl = (path: string, params?: RequestOptions['params']): string => {
  const base = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  if (!params) return base;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value));
    }
  }

  const qs = search.toString();
  if (!qs) return base;
  return base.includes('?') ? `${base}&${qs}` : `${base}?${qs}`;
};

/** Pull a human-readable message out of whatever shape the backend returned. */
const extractMessage = (data: unknown, fallback: string): string => {
  if (typeof data === 'string' && data.trim()) {
    // A proxy returning an HTML error page would otherwise have its entire
    // source rendered to the user as the error message.
    if (/^\s*<(!doctype|html)/i.test(data)) return fallback;
    return data;
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    // The API is inconsistent: some routes return { Message }, others { message }.
    // `Message` is sometimes a payload object rather than text, so only strings count.
    for (const key of ['Message', 'message', 'error'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }

  return fallback;
};

const parseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text || null;
};

export const request = async <T = unknown>(path: string, options: RequestOptions = {}): Promise<T> => {
  const {
    method = 'GET',
    body,
    headers = {},
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    withCredentials = true,
    signal,
  } = options;

  const url = buildUrl(path, params);
  const finalHeaders: Record<string, string> = { ...headers };
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    // Deliberately no Content-Type: the browser must set the multipart
    // boundary itself, and setting it manually breaks the upload.
    payload = body;
  } else if (body !== undefined && body !== null) {
    payload = JSON.stringify(body);
    if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
  }

  if (withCredentials) {
    const token = localStorage.getItem('userToken');
    if (token && !finalHeaders['Authorization']) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // Timeout, plus support for a caller-supplied abort signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
      credentials: withCredentials ? 'include' : 'same-origin',
      signal: controller.signal,
    });
  } catch (err) {
    // A caller-initiated cancel is distinguished from a timeout — reporting an
    // intentional abort as "Request timed out" would surface a spurious error
    // to a component that merely unmounted.
    if (signal?.aborted) {
      throw new ApiError('Request cancelled.', 0, null);
    }
    if (controller.signal.aborted) {
      throw new ApiError('Request timed out — the server is not responding.', 0, null);
    }
    throw new ApiError('Network error — unable to reach the server.', 0, err);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(
      extractMessage(data, `Request failed with status ${response.status}`),
      response.status,
      data,
    );
  }

  return data as T;
};

export const get = <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...options, method: 'GET' });

export const post = <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...options, method: 'POST', body });

export const put = <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...options, method: 'PUT', body });

export const del = <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...options, method: 'DELETE' });

/**
 * Fetch a URL as a Blob (file downloads). Kept separate because the JSON
 * parsing in `request` does not apply.
 */
export const getBlob = async (path: string, options: RequestOptions = {}): Promise<Blob> => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, withCredentials = true, headers = {}, params } = options;
  const url = buildUrl(path, params);
  const finalHeaders: Record<string, string> = { ...headers };

  if (withCredentials) {
    const token = localStorage.getItem('userToken');
    if (token && !finalHeaders['Authorization']) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: finalHeaders,
      credentials: withCredentials ? 'include' : 'same-origin',
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await parseBody(response);
      throw new ApiError(extractMessage(data, 'Download failed'), response.status, data);
    }

    return await response.blob();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (controller.signal.aborted) throw new ApiError('Request timed out.', 0, null);
    throw new ApiError('Network error — unable to reach the server.', 0, err);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Normalise any thrown value into a user-facing message.
 * Used by the API wrappers that return `{ Success, Message }` envelopes.
 */
export const errorMessage = (err: unknown, fallback = 'Something went wrong.'): string => {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};
