/**
 * API client for the Tauri desktop app.
 *
 * In development the React UI runs in a browser context (vite) — point
 * `VITE_API_URL` at your backend and allow the origin in the backend's CORS
 * config. In production the app runs from `tauri://localhost` (or
 * `https://tauri.localhost` on Windows) — set the same origin as an allowed
 * CORS origin in your backend, or use Tauri's HTTP plugin to bypass CORS.
 *
 * Works with any backend; pair it with an OmniCraft web full-stack project
 * (`npm create omnicraft@latest` → Web App → full-stack) for a ready-made
 * users API with the same response shapes used here.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface User {
  id: number
  name: string
  email: string
  createdAt: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null
    throw new Error(
      typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`,
    )
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  listUsers: () => request<User[]>('/api/users'),
  createUser: (data: { name: string; email: string }) =>
    request<User>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<User>(`/api/users/${id}`, { method: 'DELETE' }),
}
