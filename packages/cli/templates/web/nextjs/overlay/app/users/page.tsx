"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

// Same-origin API — Next.js route handlers, no proxy needed.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await request<User[]>("/api/users"));
      setError(null);
    } catch {
      setError(
        "Could not reach the API/database. Run `npm run db:push` first (start PostgreSQL with `docker compose up -d` unless you chose SQLite).",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await request<User>("/api/users", {
        method: "POST",
        body: JSON.stringify({ name, email }),
      });
      setName("");
      setEmail("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function removeUser(id: number) {
    try {
      await request<User>(`/api/users/${id}`, { method: "DELETE" });
      await loadUsers();
    } catch {
      setError("Could not delete the user.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Next.js integrated full-stack — this page and the API live in one app.
      </p>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form className="mt-6 flex flex-wrap gap-2" onSubmit={addUser}>
        <input
          className="border-border bg-background flex-1 rounded-lg border px-3 py-2.5"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border-border bg-background flex-1 rounded-lg border px-3 py-2.5"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 disabled:opacity-50"
          type="submit"
          disabled={!name || !email}
        >
          Add user
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-2">
        {users.map((user) => (
          <li
            key={user.id}
            className="border-border bg-card flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">{user.name}</span>
              <span className="text-muted-foreground text-sm">{user.email}</span>
            </span>
            <button
              className="text-destructive px-2 py-1 text-sm"
              type="button"
              onClick={() => void removeUser(user.id)}
            >
              Delete
            </button>
          </li>
        ))}
        {users.length === 0 && !loading && (
          <li className="text-muted-foreground text-sm">
            No users yet — add one above (it is stored in the database).
          </li>
        )}
      </ul>
    </main>
  );
}
