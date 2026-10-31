export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

function readCookie(name: string): string | null {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

async function initializeCsrf(): Promise<string> {
  const response = await fetch("/sanctum/csrf-cookie", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Could not initialize CSRF protection (${response.status}).`);

  const token = readCookie("XSRF-TOKEN");
  if (!token) throw new Error("Laravel did not return an XSRF-TOKEN cookie.");
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-XSRF-TOKEN", await initializeCsrf());
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    errors?: Record<string, unknown>;
  } | null;
  if (!response.ok) {
    const firstValidationError = body?.errors
      ? Object.values(body.errors).flatMap((value) => (Array.isArray(value) ? value : [value]))[0]
      : null;
    const message =
      typeof firstValidationError === "string"
        ? firstValidationError
        : typeof body?.message === "string"
          ? body.message
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export const api = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) =>
    request<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<AuthUser>("/api/me"),
  listUsers: () => request<ApiUser[]>("/api/users"),
  createUser: (data: { name: string; email: string }) =>
    request<ApiUser>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<ApiUser>(`/api/users/${id}`, { method: "DELETE" }),
};
