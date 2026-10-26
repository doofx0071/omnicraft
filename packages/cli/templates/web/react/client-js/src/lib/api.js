// Thin typed-free wrapper around fetch. All API paths hit the Vite dev
// proxy, which forwards /api to the backend server.
export async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(
      typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`,
    )
  }
  return res.json()
}

export const api = {
  listUsers: () => request('/api/users'),
  createUser: (data) => request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
}
