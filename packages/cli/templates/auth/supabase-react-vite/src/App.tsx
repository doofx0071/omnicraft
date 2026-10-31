import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Note = {
  id: string;
  content: string;
  created_at: string;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionReady(true);
      setMessage(null);
      setError(null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setNotes([]);
      return;
    }
    let active = true;
    void supabase
      .from("notes")
      .select("id, content, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        else setNotes(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [session]);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = signingUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signingUp && !result.data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from("notes").insert({ content: note.trim() });
    if (insertError) setError(insertError.message);
    else {
      setNote("");
      const { data, error: queryError } = await supabase
        .from("notes")
        .select("id, content, created_at")
        .order("created_at", { ascending: false });
      if (queryError) setError(queryError.message);
      else setNotes(data ?? []);
    }
    setBusy(false);
  }

  async function deleteNote(id: string) {
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase.from("notes").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else setNotes((current) => current.filter((item) => item.id !== id));
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) setError(signOutError.message);
    setBusy(false);
  }

  return (
    <main className="app">
      <h1>⚡ {{ projectName }}</h1>
      <p className="subtitle">
        Supabase Auth with user-scoped Data API access and row-level security.
      </p>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}

      {!sessionReady ? (
        <p className="muted">Restoring your session…</p>
      ) : session ? (
        <section aria-label="Your account">
          <p>
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
          >
            Sign out
          </button>
          <h2>Your private notes</h2>
          <form className="form" onSubmit={(event) => void addNote(event)}>
            <input
              className="input"
              aria-label="Note"
              placeholder="Write a note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              required
            />
            <button className="btn" type="submit" disabled={busy || !note.trim()}>
              Add note
            </button>
          </form>
          <ul className="user-list">
            {notes.map((item) => (
              <li className="user-row" key={item.id}>
                <span>{item.content}</span>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void deleteNote(item.id)}
                  disabled={busy}
                >
                  Delete
                </button>
              </li>
            ))}
            {notes.length === 0 && <li className="muted">No notes yet.</li>}
          </ul>
        </section>
      ) : (
        <section aria-label="Sign in">
          <h2>{signingUp ? "Create an account" : "Sign in"}</h2>
          <form className="form" onSubmit={(event) => void submitCredentials(event)}>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
            <button className="btn" type="submit" disabled={busy || !email || password.length < 8}>
              {signingUp ? "Create account" : "Sign in"}
            </button>
          </form>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setSigningUp((value) => !value)}
          >
            {signingUp ? "Already registered? Sign in" : "Create an account"}
          </button>
        </section>
      )}
    </main>
  );
}
