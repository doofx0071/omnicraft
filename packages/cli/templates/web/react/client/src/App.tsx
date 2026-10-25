import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./lib/api";
import type { User } from "./lib/api";

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api.listUsers());
      setError(null);
    } catch {
      setError(
        "Could not reach the API. In a full-stack project run `docker compose up -d` and `npm run db:push`, then start the server with `npm run dev`.",
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
      await api.createUser({ name, email });
      setName("");
      setEmail("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function removeUser(id: number) {
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch {
      setError("Could not delete the user.");
    }
  }

  return (
    <main className="app">
      <h1>⚡ {{ projectName }}</h1>
      <p className="subtitle">
        Scaffolded by OmniCraft — this page talks to the users API end-to-end.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <form className="form" onSubmit={addUser}>
        <input
          className="input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn" type="submit" disabled={!name || !email}>
          Add user
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading users…</p>
      ) : (
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.id} className="user-row">
              <span>
                <strong>{user.name}</strong> <span className="muted">{user.email}</span>
              </span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void removeUser(user.id)}
              >
                Delete
              </button>
            </li>
          ))}
          {users.length === 0 && (
            <li className="muted">No users yet — add one above (it is stored in PostgreSQL).</li>
          )}
        </ul>
      )}
    </main>
  );
}
