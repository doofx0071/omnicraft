/**
 * `omnicraft add auth` — better-auth email/password boilerplate for
 * express + drizzle stacks (the first supported stack; master plan §9.2).
 *
 * Ships: auth.ts (betterAuth config), drizzle auth schema, a protected
 * /api/me route example, and the client auth helper. Patches index.ts
 * (mount before body parser) and drizzle.config.ts (schema array) via the
 * module system's patch strategy — exact-string find/replace, fails safely
 * if the anchor is missing.
 */
import type { ModuleDefinition } from '../add.js'

const AUTH_TS = (provider: string) => `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db/index.js";
import * as authSchema from "./db/auth-schema.js";
import { env } from "./env.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "${provider}",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [env.CORS_ORIGIN],
});
`

const AUTH_SCHEMA_SQLITE = `import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`)
    .notNull()
    .$onUpdate(() => new Date()),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
`

const AUTH_SCHEMA_POSTGRES = `import { relations } from "drizzle-orm";
import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
`

const AUTH_SCHEMA_MYSQL = `import { relations } from "drizzle-orm";
import { mysqlTable, varchar, text, boolean, timestamp, index } from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const session = mysqlTable(
  "session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = mysqlTable(
  "account",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    accountId: varchar("account_id", { length: 36 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = mysqlTable("verification", {
  id: varchar("id", { length: 36 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
`

const ME_ROUTE = `import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

// Protected-route example: returns the session when logged in, 401 otherwise.
export const meRouter = Router();

meRouter.get("/", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json(session);
});
`

const CLIENT_AUTH = `import { createAuthClient } from "better-auth/react";

// Points at the same origin by default (proxy /api/auth in dev if needed).
export const authClient = createAuthClient();

// Examples:
//   await authClient.signUp.email({ name, email, password });
//   await authClient.signIn.email({ email, password });
//   await authClient.signOut();
//   const { data: session } = await authClient.useSession();
`

const SCHEMA_MIGRATION_SQLITE = `-- Better Auth tables (user, session, account, verification).
-- Managed by the auth module: db:push applies this file plus schema.ts.
`

export const authModule: ModuleDefinition = {
  id: 'auth',
  description: 'better-auth email/password boilerplate (express + drizzle stacks)',
  incompatible(manifest) {
    if (manifest.stack.backendRuntime !== 'node' || manifest.stack.orm !== 'drizzle') {
      return 'the first auth stack is Node.js backends with Drizzle (express). Hono/Fastify wiring is on the roadmap.'
    }
    if (manifest.stack.architecture.kind !== 'separate-frontend-api') {
      return `architecture "${manifest.stack.architecture.kind}" is not covered yet`
    }
    return null
  },
  files(_ctx, manifest) {
    const provider =
      manifest.stack.database === 'mysql'
        ? 'mysql'
        : manifest.stack.database === 'sqlite'
          ? 'sqlite'
          : 'pg'
    const schema =
      manifest.stack.database === 'mysql'
        ? AUTH_SCHEMA_MYSQL
        : manifest.stack.database === 'sqlite'
          ? AUTH_SCHEMA_SQLITE
          : AUTH_SCHEMA_POSTGRES
    const files: Record<string, string> = {
      'server/src/auth.ts': AUTH_TS(provider),
      'server/src/db/auth-schema.ts': schema,
      'server/src/routes/me.ts': ME_ROUTE,
      'client/src/lib/auth-client.ts': CLIENT_AUTH,
    }
    if (manifest.stack.database === 'sqlite') {
      // better-auth has no sql-file migration story for sqlite here — the
      // drizzle-kit push flow covers the auth tables via the config patch.
      files['server/src/db/migrations/002_better_auth.sql'] = SCHEMA_MIGRATION_SQLITE
    }
    return files
  },
  packageJson: {
    dependencies: {
      'better-auth': '^1.7.14',
      '@better-auth/drizzle-adapter': '^1.7.14',
    },
  },
  nextSteps: [
    'npm install',
    'add BETTER_AUTH_SECRET=<a long random string> to server/.env (never commit it)',
    'npm run db:push  (creates the auth tables)',
    'endpoints: POST /api/auth/sign-up/email · POST /api/auth/sign-in/email · GET /api/auth/get-session',
    'example protected route: GET /api/me (see server/src/routes/me.ts)',
  ],
}

// Patches are exported separately — the add runner applies them to EXISTING
// files after the collision check, with exact-string find/replace.
export const authPatches = [
  {
    file: 'server/src/index.ts',
    find: 'import { apiRouter } from "./routes/index.js";',
    replace:
      'import { apiRouter } from "./routes/index.js";\nimport { auth } from "./auth.js";\nimport { toNodeHandler } from "better-auth/node";',
  },
  {
    file: 'server/src/index.ts',
    find: 'app.use(express.json());',
    replace:
      '// better-auth mounts BEFORE the body parser — it needs the raw request stream.\napp.all("/api/auth/*splat", toNodeHandler(auth));\napp.use(express.json());',
  },
  {
    file: 'server/src/routes/index.ts',
    find: 'apiRouter.use("/users", usersRouter);',
    replace: 'apiRouter.use("/users", usersRouter);\napiRouter.use("/me", meRouter);',
  },
  {
    file: 'server/src/routes/index.ts',
    find: 'import { usersRouter } from "./users.js";',
    replace: 'import { usersRouter } from "./users.js";\nimport { meRouter } from "./me.js";',
  },
  {
    file: 'server/drizzle.config.ts',
    find: 'schema: "./src/db/schema.ts",',
    replace: 'schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],',
  },
]
