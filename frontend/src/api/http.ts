export type FieldIssue = { field: string; message: string };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly issues: FieldIssue[] = []) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken: string | null = null;
export function resetCsrf() { csrfToken = null; }

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new ApiError("Could not verify your session. Try again.", response.status);
  const body = await response.json();
  if (typeof body.csrfToken !== "string" || !/^[a-f0-9]{64}$/.test(body.csrfToken)) {
    throw new ApiError("Could not verify your session. Try again.", 502);
  }
  csrfToken = body.csrfToken;
  return csrfToken as string;
}

export async function apiRequest(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}, retryCsrf = true): Promise<unknown> {
  const method = options.method ?? "GET";
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  let response: Response;
  try {
    const token = mutation ? await getCsrf() : null;
    response = await fetch(path, {
      method, signal: options.signal, credentials: "same-origin",
      headers: { Accept: "application/json", ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { "X-CSRF-Token": token } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted || error instanceof ApiError) throw error;
    throw new ApiError("Could not connect to ReciLoom. Try again in a moment.", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (!response.ok) {
    // CSRF ditolak sebelum controller menulis data. Hanya kondisi ini diulang
    // satu kali; error jaringan tidak me-retry operasi create/fork/publish.
    if (mutation && response.status === 403 && retryCsrf && record.message === "Invalid or missing CSRF token.") {
      resetCsrf();
      return apiRequest(path, options, false);
    }
    const issues = Array.isArray(record.errors) ? record.errors : Array.isArray(record.issues) ? record.issues : [];
    const safeIssues = issues.filter((issue): issue is FieldIssue => Boolean(issue) && typeof issue === "object" && typeof issue.field === "string" && typeof issue.message === "string");
    const messages: Record<number, string> = {
      400: "Check the link or the details you entered.", 401: "Log in to continue.",
      403: "Could not verify your session. Try again.", 404: "This recipe may be private or no longer available.",
      409: "This recipe may have changed or already been published.",
      413: "The form is too large to save.", 422: "Complete the required fields before publishing.",
      429: "Too many attempts. Wait a moment before trying again.",
    };
    // Pesan terkontrol dari backend berguna untuk validasi/login; 5xx tetap generik.
    const message = response.status < 500 && typeof record.message === "string"
      ? record.message : messages[response.status] ?? "ReciLoom is temporarily unavailable.";
    throw new ApiError(message, response.status, safeIssues);
  }
  if (!body || typeof body !== "object" || !("data" in body)) {
    // Logout mengembalikan message tanpa envelope data.
    if (path === "/api/auth/logout" && typeof record.message === "string") return null;
    throw new ApiError("ReciLoom received an unexpected response.", 502);
  }
  return record.data;
}
