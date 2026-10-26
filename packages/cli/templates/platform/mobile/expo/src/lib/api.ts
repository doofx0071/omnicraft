import { Platform } from 'react-native'

/**
 * API client for the mobile app.
 *
 * Mobile devices cannot reach your dev machine's `localhost` — they are
 * separate devices. Point this at a reachable host:
 *
 * - Android emulator:  http://10.0.2.2:3000  (loopback alias to your PC)
 * - iOS simulator:     http://localhost:3000 (shares the Mac's network)
 * - Physical device:   your machine's LAN IP (e.g. http://192.168.1.20:3000)
 *   — set it in `.env` as EXPO_PUBLIC_API_URL (Expo exposes EXPO_PUBLIC_*
 *   vars to the bundle automatically).
 *
 * Works with any backend; pair it with an OmniCraft web full-stack project
 * (`npm create omnicraft@latest` → Web App → full-stack) for a ready-made
 * users API with the same response shapes used here.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export interface User {
  id: number
  name: string
  email: string
  createdAt: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = BASE_URL + path
  if (Platform.OS === 'web') {
    // Expo web build — same-origin requests are fine, keep the path as-is.
  }
  const res = await fetch(BASE_URL === '' ? path : url, {
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
