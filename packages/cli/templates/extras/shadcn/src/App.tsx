import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Rendered from the template token (see index.html <title> for the same value).
const APP_TITLE = "{{projectName}}";

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api.listUsers());
      setError(null);
    } catch {
      setError(
        "Could not reach the API. In a full-stack project run `docker compose up -d` (or nothing for SQLite), then `npm run db:push`, then start the server with `npm run dev`.",
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
    setBusy(true);
    try {
      await api.createUser({ name, email });
      setName("");
      setEmail("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
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
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <header className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{APP_TITLE}</h1>
        <Badge variant="secondary">shadcn/ui</Badge>
      </header>
      <p className="text-muted-foreground mt-1 text-sm">
        Scaffolded by OmniCraft — this page talks to the users API end-to-end.
      </p>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form className="mt-6 flex flex-wrap gap-2" onSubmit={addUser}>
        <Input
          className="min-w-36 flex-1"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          className="min-w-36 flex-1"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" disabled={!name || !email || busy}>
          {busy ? "Adding…" : "Add user"}
        </Button>
      </form>

      <Separator className="my-6" />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading users…</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Stored in the database via the API</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {users.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-muted-foreground text-sm">{user.email}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => void removeUser(user.id)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
              {users.length === 0 && (
                <li className="text-muted-foreground text-sm">
                  No users yet — add one above (it is stored in the database).
                </li>
              )}
            </ul>
          </CardContent>
          <CardFooter className="text-muted-foreground text-xs">
            {users.length} user(s) · served by the API
          </CardFooter>
        </Card>
      )}
    </main>
  );
}
