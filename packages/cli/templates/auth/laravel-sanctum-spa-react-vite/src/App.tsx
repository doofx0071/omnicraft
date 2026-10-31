import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./lib/api";
import type { ApiUser, AuthUser } from "./lib/api";
import "./auth.css";

type AuthMode = "register" | "login";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [recordName, setRecordName] = useState("");
  const [recordEmail, setRecordEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your sample users.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api
      .me()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user) void loadUsers();
    else setUsers([]);
  }, [loadUsers, user]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        authMode === "register"
          ? await api.register({
              name,
              email,
              password,
              password_confirmation: passwordConfirmation,
            })
          : await api.login({ email, password });
      setUser(result.user);
      setPassword("");
      setPasswordConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await api.logout();
      setUser(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createUser({ name: recordName, email: recordEmail });
      setRecordName("");
      setRecordEmail("");
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the sample user.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: number) {
    setBusy(true);
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the sample user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app auth-app">
      <h1>⚡ {{ projectName }}</h1>
      <p className="subtitle">Laravel native authentication with Sanctum SPA sessions.</p>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Restoring your session…</p>
      ) : user ? (
        <section className="auth-card" aria-labelledby="account-title">
          <div className="auth-heading">
            <div>
              <h2 id="account-title">Welcome, {user.name}</h2>
              <p className="muted">Signed in as {user.email}</p>
            </div>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => void signOut()}
              disabled={busy}
            >
              Sign out
            </button>
          </div>

          <form className="auth-form" onSubmit={addUser}>
            <h3>Your private sample users</h3>
            <label className="auth-field">
              Name
              <input
                className="input"
                value={recordName}
                onChange={(event) => setRecordName(event.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              Email
              <input
                className="input"
                type="email"
                value={recordEmail}
                onChange={(event) => setRecordEmail(event.target.value)}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={busy || !recordName || !recordEmail}>
              Add sample user
            </button>
          </form>

          <ul className="user-list">
            {users.map((item) => (
              <li key={item.id} className="user-row">
                <span>
                  <strong>{item.name}</strong> <span className="muted">{item.email}</span>
                </span>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void removeUser(item.id)}
                  disabled={busy}
                >
                  Delete
                </button>
              </li>
            ))}
            {users.length === 0 && <li className="muted">No sample users yet.</li>}
          </ul>
        </section>
      ) : (
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-heading">
            <div>
              <h2 id="auth-title">{authMode === "register" ? "Create an account" : "Sign in"}</h2>
              <p className="muted">Your session is stored in a Laravel HTTP-only cookie.</p>
            </div>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === "register" && (
              <label className="auth-field">
                Name
                <input
                  className="input"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
            )}
            <label className="auth-field">
              Email
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              Password
              <input
                className="input"
                type="password"
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {authMode === "register" && (
              <label className="auth-field">
                Confirm password
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            className="auth-mode-button"
            type="button"
            onClick={() => {
              setError(null);
              setAuthMode(authMode === "register" ? "login" : "register");
            }}
          >
            {authMode === "register"
              ? "Already have an account? Sign in"
              : "Need an account? Register"}
          </button>
        </section>
      )}
    </main>
  );
}
