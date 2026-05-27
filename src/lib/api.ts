import "server-only";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!INTERNAL_TOKEN) {
    throw new Error("INTERNAL_API_TOKEN is not configured");
  }

  const headers = new Headers(init.headers);
  headers.set("x-internal-token", INTERNAL_TOKEN);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}
