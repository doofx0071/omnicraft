# {{projectName}}

Integrated full-stack Next.js app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                        |
| -------- | --------------------------- |
| App      | Next.js 16 (App Router) + TypeScript |
| Styling  | Tailwind CSS 4              |
| Database | SQLite + raw SQL (parameterized) |

Next.js **is** the server: the users page and its API route handlers live in one app. No separate API process.

## Getting started

No Docker needed — the SQLite database file is created automatically.

```bash
# 1. Create the tables
npm run db:push

# 2. (optional) Insert sample data
npm run db:seed

# 3. Run the app (page + API together)
npm run dev
```

Open http://localhost:5173.

## Layout

```
├── app/
│   ├── api/users/route.ts     # GET (list) + POST — parameterized SQL
│   ├── api/users/[id]/route.ts# DELETE
│   ├── users/page.tsx         # demo page (lists, creates, deletes users)
│   └── db/                    # server-only database code
│       ├── index.ts           # better-sqlite3 + query() helper
│       ├── migrate.ts         # SQL-file migration runner
│       ├── migrations/*.sql   # raw SQL migrations
│       └── seed.ts
└── data/                      # SQLite files (auto-created)
```

## Environment

`.env` (already created from `.env.example`):

```
DATABASE_URL=file:./data/app.db
```

## API

| Method | Path               | Description    |
| ------ | ------------------ | -------------- |
| GET    | /api/users         | List users     |
| POST   | /api/users         | Create a user  |
| DELETE | /api/users/:id     | Delete a user  |

## Troubleshooting

| Symptom                                | Fix                                                          |
| -------------------------------------- | ------------------------------------------------------------ |
| API errors on /api                      | Re-run `npm run db:push`; check `DATABASE_URL` in `.env`      |
| `SQLITE_CANTOPEN`                       | The database path is not writable — fix path or permissions   |

## Useful commands

| Command             | What it does               |
| ------------------- | -------------------------- |
| `npm run dev`       | Run the app (page + API)   |
| `npm run build`     | Production build           |
| `npm run lint`      | ESLint                     |
| `npm run db:push`   | Apply SQL migrations       |
| `npm run db:seed`   | Insert sample data         |

Crafted with OmniCraft — add route handlers under `app/api`, pages under `app`, and SQL migrations in `app/db/migrations`.
