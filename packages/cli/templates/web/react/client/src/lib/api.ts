// Thin typed wrapper around fetch. All API paths hit the Vite dev proxy,
// which forwards /api to the backend server.
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    // Accept: application/json — backends like Laravel return JSON errors
    // instead of redirects when the client asks for JSON.
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(
      typeof body?.error === "string" ? body.error : `Request failed with status ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export const api = {
  listUsers: () => request<User[]>("/api/users"),
  createUser: (data: { name: string; email: string }) =>
    request<User>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<User>(`/api/users/${id}`, { method: "DELETE" }),
};
