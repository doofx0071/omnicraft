import assert from "node:assert/strict";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { runCommand, startCommand, type StartedCommand } from "../src/exec.js";

const CLI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_BINARY = join(CLI_DIR, "dist", "index.js");
const CHILD_TIMEOUT_MS = 25 * 60 * 1000;
const HTTP_TIMEOUT_MS = 10_000;
const REDACTED = "[REDACTED]";
const secrets: string[] = [];
const privilegedSecrets: string[] = [];

function redact(value: string): string {
  let result = value
    .replace(
      /\b(PUBLISHABLE_KEY|SECRET_KEY|ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|DB_URL|DATABASE_URL|SUPABASE_ACCESS_TOKEN)\s*=\s*["']?[^"'\r\n\s"']+/gi,
      (_match, key: string) => key + "=" + REDACTED,
    )
    .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, REDACTED)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]");
  for (const secret of secrets) {
    if (secret.length >= 5) result = result.replaceAll(secret, REDACTED);
  }
  return result;
}

function isolatedEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^SUPABASE_/i.test(key) ||
      /^VITE_SUPABASE_/i.test(key) ||
      /^(DATABASE_URL|DB_URL|DB_PASSWORD|PGPASSWORD)$/i.test(key)
    ) {
      delete env[key];
    }
  }
  return { ...env, CI: "1", NO_UPDATE_NOTIFIER: "1", SUPABASE_DISABLE_TELEMETRY: "1" };
}

function runRequired(label: string, command: string, args: string[], cwd: string): string {
  console.log("[supabase-auth] " + label);
  const result = runCommand(command, args, cwd, {
    env: isolatedEnvironment(),
    timeoutMs: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!result.ok) {
    throw new Error(
      label +
        " failed (exit " +
        (result.exitCode ?? "unknown") +
        "):\n" +
        redact(result.output).slice(-12_000),
    );
  }
  return result.output;
}

function parseEnv(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)\s*$/.exec(line);
    if (!match) continue;
    const name = match[1] ?? "";
    let value = match[2] ?? "";
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value) as string;
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values[name] = value;
    if (/(KEY|TOKEN|SECRET|PASSWORD|JWT)/i.test(name) && value) secrets.push(value);
    if (
      /(SECRET_KEY|SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN|JWT_SECRET|DB_URL|DATABASE_URL)/i.test(
        name,
      ) &&
      value.length >= 8
    ) {
      privilegedSecrets.push(value);
    }
  }
  return values;
}

function memoryStorage(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
} {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePort);
  });
  const address = server.address();
  assert(address && typeof address === "object", "The OS did not assign a preview port.");
  const { port } = address;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return port;
}

async function waitForPreview(origin: string, child: StartedCommand): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)]);
    if (exited)
      throw new Error("Generated Vite preview exited early: " + redact(exited.output).slice(-5000));
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return await response.text();
    } catch {
      // Keep waiting until the bounded preview startup deadline.
    }
    await delay(250);
  }
  throw new Error(
    "Generated Vite preview did not become ready: " + redact(child.output).slice(-5000),
  );
}

async function verifyGeneratedAuthClient(
  projectRoot: string,
  apiUrl: string,
  publishableKey: string,
): Promise<void> {
  const requireFromProject = createRequire(join(projectRoot, "package.json"));
  const sdk = requireFromProject("@supabase/supabase-js") as {
    createClient: (...args: unknown[]) => any;
  };
  const makeClient = (storage: ReturnType<typeof memoryStorage>) =>
    sdk.createClient(apiUrl, publishableKey, {
      auth: { storage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    });
  const password = "OmniCraft-local-test-" + Math.random().toString(36).slice(2, 12) + "!";
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const emailA = "omnicraft-a-" + suffix + "@example.com";
  const emailB = "omnicraft-b-" + suffix + "@example.com";
  const storageA = memoryStorage();
  const storageB = memoryStorage();
  const firstA = makeClient(storageA);
  const firstB = makeClient(storageB);

  const signupA = await firstA.auth.signUp({ email: emailA, password });
  assert.equal(signupA.error, null, "User A signup should succeed in the local stack.");
  assert(signupA.data.user?.id, "User A signup should return a user id.");
  const userAId = signupA.data.user.id as string;
  assert(
    signupA.data.session,
    "Local email confirmation is disabled, so signup should establish a session.",
  );

  const signupB = await firstB.auth.signUp({ email: emailB, password });
  assert.equal(signupB.error, null, "User B signup should succeed in the local stack.");
  assert(signupB.data.user?.id, "User B signup should return a user id.");
  const userBId = signupB.data.user.id as string;
  assert(signupB.data.session, "User B signup should establish a session.");

  const signoutA = await firstA.auth.signOut({ scope: "local" });
  assert.equal(signoutA.error, null, "Local signout should clear the initial signup session.");
  const clientA = makeClient(storageA);
  const loginA = await clientA.auth.signInWithPassword({ email: emailA, password });
  assert.equal(loginA.error, null, "User A email/password sign-in should succeed.");
  assert(loginA.data.session?.access_token, "Sign-in should produce a user JWT.");
  const accessToken = loginA.data.session.access_token as string;

  const restoredA = makeClient(storageA);
  const restoredSession = await restoredA.auth.getSession();
  assert.equal(restoredSession.error, null, "Restoring the local browser session should succeed.");
  assert.equal(
    restoredSession.data.session?.access_token,
    accessToken,
    "A recreated client should restore the saved session.",
  );
  const verifiedUser = await restoredA.auth.getUser();
  assert.equal(verifiedUser.data.user?.id, userAId, "The restored session should identify User A.");

  const ownInsert = await restoredA.from("notes").insert({ content: "User A private note" });
  assert.equal(ownInsert.error, null, "An authenticated owner should insert a note.");
  const ownRead = await restoredA.from("notes").select("id, owner_id, content");
  assert.equal(ownRead.error, null, "An authenticated owner should list notes.");
  assert.equal(ownRead.data.length, 1);
  const noteId = ownRead.data[0].id as string;
  assert.equal(ownRead.data[0].owner_id, userAId);

  const ownUpdate = await restoredA
    .from("notes")
    .update({ content: "User A updated private note" })
    .eq("id", noteId)
    .select("owner_id, content");
  assert.equal(ownUpdate.error, null, "An authenticated owner should update its own note.");
  assert.equal(ownUpdate.data.length, 1);
  assert.equal(ownUpdate.data[0].content, "User A updated private note");

  const userB = makeClient(storageB);
  const bReadA = await userB.from("notes").select("id, owner_id, content");
  assert.equal(bReadA.error, null, "User B should be able to read its own visible rows.");
  assert.deepEqual(bReadA.data, [], "RLS must hide User A's note from User B.");
  const bSpoofInsert = await userB
    .from("notes")
    .insert({ owner_id: userAId, content: "User B cannot assign User A as owner" });
  assert(bSpoofInsert.error, "RLS must reject an insert that assigns another user's owner id.");
  const bSpoofUpdate = await userB
    .from("notes")
    .update({ content: "User B cannot update User A's note" })
    .eq("id", noteId)
    .select("id");
  assert.equal(bSpoofUpdate.error, null);
  assert.deepEqual(bSpoofUpdate.data, [], "RLS must hide another user's row from update requests.");

  const ownBInsert = await userB.from("notes").insert({ content: "User B private note" });
  assert.equal(ownBInsert.error, null, "User B should insert its own note.");
  const aReadAfterB = await restoredA.from("notes").select("id, owner_id, content");
  assert.equal(aReadAfterB.error, null);
  assert.equal(aReadAfterB.data.length, 1, "User A must not see User B's row.");
  assert.equal(aReadAfterB.data[0].owner_id, userAId);
  assert.equal(aReadAfterB.data[0].content, "User A updated private note");

  const anon = sdk.createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const anonRead = await anon.from("notes").select("id");
  assert(anonRead.error, "The anon role must not have table access.");

  const signoutFinal = await restoredA.auth.signOut({ scope: "local" });
  assert.equal(signoutFinal.error, null, "Local signout should clear User A's session.");
  const afterSignout = await restoredA.auth.getSession();
  assert.equal(
    afterSignout.data.session,
    null,
    "Local signout must clear persisted browser state.",
  );
  const signedOutRead = await restoredA.from("notes").select("id");
  assert(
    signedOutRead.error,
    "After local signout, the anonymous browser request must remain denied.",
  );

  const bNotes = await userB.from("notes").select("id, owner_id");
  assert.equal(bNotes.error, null);
  assert.equal(bNotes.data.length, 1);
  assert.equal(bNotes.data[0].owner_id, userBId);
  const bDelete = await userB.from("notes").delete().eq("id", noteId).select("id");
  assert.equal(bDelete.error, null);
  assert.deepEqual(
    bDelete.data,
    [],
    "RLS must prevent another user from deleting the owner's note.",
  );
  const signoutB = await userB.auth.signOut({ scope: "local" });
  assert.equal(signoutB.error, null);
}

async function runScenario(): Promise<void> {
  // The production CLI creates the named project under its working directory.
  const workspaceRoot = mkdtempSync(join(tmpdir(), "omnicraft-supabase-auth-"));
  const projectRoot = join(workspaceRoot, "supabase-auth-app");
  let supabaseStartAttempted = false;
  let preview: StartedCommand | undefined;
  let failure: unknown;
  try {
    console.log("[supabase-auth] reject an incompatible API choice before creating its target");
    const rejectedTarget = join(workspaceRoot, "supabase-auth-rejected");
    const rejected = runCommand(
      "node",
      [
        CLI_BINARY,
        "supabase-auth-rejected",
        "--yes",
        "--skip-install",
        "--auth",
        "supabase-auth",
        "--backend",
        "express",
      ],
      workspaceRoot,
      { env: isolatedEnvironment(), timeoutMs: CHILD_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(rejected.ok, false, "Supabase Auth must reject a separate API stack.");
    assert.match(
      redact(rejected.output),
      /requires a TypeScript React\/Vite frontend-only project/,
    );
    assert.equal(
      existsSync(rejectedTarget),
      false,
      "Incompatible flags must reject before target writes.",
    );

    console.log("[supabase-auth] generate the exact React/Vite TypeScript frontend-only project");
    const scaffold = runCommand(
      "node",
      [
        CLI_BINARY,
        "supabase-auth-app",
        "--yes",
        "--skip-install",
        "--auth",
        "supabase-auth",
        "--extras",
        "none",
      ],
      workspaceRoot,
      { env: isolatedEnvironment(), timeoutMs: CHILD_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
    );
    if (!scaffold.ok)
      throw new Error("Production CLI scaffold failed: " + redact(scaffold.output).slice(-8000));

    const manifest = JSON.parse(
      readFileSync(join(projectRoot, ".omnicraft", "project.json"), "utf8"),
    ) as {
      authentication: string;
      modules: string[];
      stack: { architecture: { kind: string }; database: string | null };
    };
    assert.equal(manifest.authentication, "supabase-auth");
    assert.deepEqual(
      manifest.modules,
      [],
      "Authentication must remain separate from module history.",
    );
    assert.equal(manifest.stack.architecture.kind, "frontend-only");
    assert.equal(manifest.stack.database, null);

    runRequired(
      "Install generated browser dependencies",
      "npm",
      ["install", "--no-audit", "--no-fund"],
      projectRoot,
    );
    supabaseStartAttempted = true;
    runRequired(
      "Start pinned local Supabase services",
      "npx",
      ["--yes", "supabase@2.122.0", "start", "--yes"],
      projectRoot,
    );
    const statusOutput = runRequired(
      "Read local Supabase endpoints and test-only keys",
      "npx",
      ["--yes", "supabase@2.122.0", "status", "--output", "env"],
      projectRoot,
    );
    const status = parseEnv(statusOutput);
    const apiUrl = status.API_URL;
    const publishableKey = status.PUBLISHABLE_KEY;
    assert(apiUrl?.startsWith("http://"), "The local Supabase API URL must be available.");
    assert(
      publishableKey?.startsWith("sb_publishable_"),
      "The pinned local Supabase CLI must expose a browser-safe publishable key.",
    );
    const envExample = readFileSync(join(projectRoot, ".env.example"), "utf8");
    assert(readFileSync(join(projectRoot, "supabase", ".gitignore"), "utf8").includes("/.temp/"));
    assert(envExample.includes("VITE_SUPABASE_URL=https://your-project-id.supabase.co"));
    assert(envExample.includes("VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-key"));
    assert(!/SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|VITE_.*SECRET/i.test(envExample));
    writeFileSync(
      join(projectRoot, ".env"),
      "VITE_SUPABASE_URL=" + apiUrl + "\nVITE_SUPABASE_PUBLISHABLE_KEY=" + publishableKey + "\n",
    );
    const localEnv = readFileSync(join(projectRoot, ".env"), "utf8");
    assert(!/SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|JWT_SECRET|VITE_.*SECRET/i.test(localEnv));

    runRequired(
      "Apply generated migration to the isolated local database",
      "npx",
      ["--yes", "supabase@2.122.0", "db", "reset", "--local", "--yes"],
      projectRoot,
    );
    const policyCheck = runRequired(
      "Verify the notes table grants and RLS policies in PostgreSQL",
      "npx",
      [
        "--yes",
        "supabase@2.122.0",
        "db",
        "query",
        "--local",
        "select case when c.relrowsecurity and has_table_privilege('authenticated', 'public.notes', 'select') and has_table_privilege('authenticated', 'public.notes', 'insert') and has_table_privilege('authenticated', 'public.notes', 'update') and has_table_privilege('authenticated', 'public.notes', 'delete') and not has_table_privilege('anon', 'public.notes', 'select') and (select count(*) = 4 and bool_and(concat_ws(' ', qual, with_check) like '%auth.uid()%') from pg_policies where schemaname = 'public' and tablename = 'notes') then 'RLS_AND_GRANTS_OK' else 'RLS_AND_GRANTS_FAILED' end as verification from pg_class c where c.oid = 'public.notes'::regclass;",
      ],
      projectRoot,
    );
    assert(
      policyCheck.includes("RLS_AND_GRANTS_OK"),
      "Explicit grants and owner RLS policies must match the contract.",
    );

    runRequired("Build generated React/Vite TypeScript app", "npm", ["run", "build"], projectRoot);
    await verifyGeneratedAuthClient(projectRoot, apiUrl as string, publishableKey as string);

    const port = await reservePort();
    const origin = "http://127.0.0.1:" + port;
    preview = await startCommand(
      "npm",
      ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      projectRoot,
      { env: isolatedEnvironment() },
    );
    const page = await waitForPreview(origin, preview);
    assert(
      page.includes('<div id="root"></div>'),
      "Built application should expose the React mount point.",
    );
    const assetPath = /<script[^>]+src="([^"]+\.js)"/.exec(page)?.[1];
    assert(assetPath, "The generated page should reference a production JavaScript bundle.");
    const assetResponse = await fetch(new URL(assetPath, origin), {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    assert.equal(assetResponse.status, 200);
    const bundle = await assetResponse.text();
    assert(
      bundle.includes("sb_publishable_"),
      "The frontend bundle should include only the local publishable key.",
    );
    assert(
      bundle.includes(publishableKey),
      "The frontend bundle should include the configured local publishable key.",
    );
    // The Supabase SDK itself includes the `sb_secret_` prefix in its key-type
    // detection code. Check actual privileged local values below instead of
    // treating that harmless SDK marker as a leaked secret.
    for (const secret of privilegedSecrets) {
      assert(
        !bundle.includes(secret),
        "The generated frontend bundle exposed a local privileged credential.",
      );
    }

    console.log(
      "[supabase-auth] signup, password sign-in, browser session restore, local sign-out, user A/B RLS isolation, explicit grants, migration, build, and preview passed",
    );
  } catch (error) {
    failure = new Error(
      "[supabase-auth] generated-project scenario failed\n" +
        redact(error instanceof Error ? (error.stack ?? error.message) : String(error)),
      { cause: error },
    );
  } finally {
    if (preview) {
      try {
        await preview.stop();
      } catch {
        // The isolated project is removed below even if Vite already exited.
      }
    }
    if (supabaseStartAttempted) {
      try {
        const stopped = runCommand(
          "npx",
          ["--yes", "supabase@2.122.0", "stop", "--no-backup"],
          projectRoot,
          { env: isolatedEnvironment(), timeoutMs: CHILD_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
        );
        if (!stopped.ok)
          console.error(
            "[supabase-auth] local Supabase stop reported an error: " +
              redact(stopped.output).slice(-3000),
          );
      } catch (error) {
        console.error("[supabase-auth] local Supabase cleanup error: " + redact(String(error)));
      }
    }
    rmSync(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    console.log("[supabase-auth] isolated project and local resources cleaned");
  }
  if (failure) throw failure;
}

runScenario().catch((error: unknown) => {
  console.error(redact(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exitCode = 1;
});
