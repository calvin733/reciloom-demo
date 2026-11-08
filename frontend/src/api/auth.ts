import { apiRequest, ApiError, resetCsrf } from "./http";

export type User = { id: string; displayName: string; email: string };
function user(value: unknown): User {
  const data = value as Partial<User> | null;
  if (!data || typeof data.id !== "string" || typeof data.displayName !== "string" || typeof data.email !== "string") {
    throw new ApiError("ReciLoom received an unexpected account response.", 502);
  }
  return { id: data.id, displayName: data.displayName, email: data.email };
}
export const getMe = async (signal?: AbortSignal) => user(await apiRequest("/api/auth/me", { signal }));
export async function login(email: string, password: string): Promise<User> {
  const result = user(await apiRequest("/api/auth/login", { method: "POST", body: { email, password } }));
  resetCsrf(); // Login meregenerasi session. Mutasi berikutnya mengambil token baru.
  return result;
}
export async function register(displayName: string, email: string, password: string): Promise<User> {
  await apiRequest("/api/auth/register", { method: "POST", body: { displayName, email, password } });
  return login(email, password);
}
export async function logout(): Promise<void> {
  await apiRequest("/api/auth/logout", { method: "POST" });
  resetCsrf();
}
