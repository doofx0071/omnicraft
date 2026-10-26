# {{projectName}}

Integrated full-stack Next.js app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                        |
| -------- | --------------------------- |
| App      | Next.js 16 (App Router) + TypeScript |
| Styling  | Tailwind CSS 4              |
| Database | PostgreSQL + raw SQL (parameterized) |

Next.js **is** the server: the users page and its API route handlers live in one app. No separate API process.

## Getting started

```bash
# 1. Start PostgreSQL (skip if you chose SQLite — the file is auto-created)
docker compose up -d

# 2. Create the tables
npm run db:push

# 3. (optional) Insert sample data
npm run db:seed

# 4. Run the app (page + API together)
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
│       ├── index.ts           # pg pool + query() helper (parameterized)
│       ├── migrate.ts         # SQL-file migration runner
│       ├── migrations/*.sql   # raw SQL migrations
│       └── seed.ts
└── docker-compose.yml         # local PostgreSQL
```

## Environment

`.env` (already created from `.env.example`):

```
DATABASE_URL=postgres://omnicraft:omnicraft@localhost:5432/{{databaseName}}
```

## API

| Method | Path               | Description    |
| ------ | ------------------ | -------------- |
| GET    | /api/users         | List users     |
| POST   | /api/users         | Create a user  |
| DELETE | /api/users/:id     | Delete a user  |

## Troubleshooting

| Symptom                                           | Fix                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| API returns `Database unavailable` / 500 on /api  | PostgreSQL isn't running — `docker compose up -d`, or wrong `DATABASE_URL` in `.env`           |
| `port 5432 is already in use`                      | Change the host port in `docker-compose.yml` **and** `.env`                                    |

## Useful commands

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Run the app (page + API)            |
| `npm run build`     | Production build                    |
| `npm run lint`      | ESLint                              |
| `npm run db:push`   | Apply SQL migrations                |
| `npm run db:migrate`| Same as db:push                     |
| `npm run db:seed`   | Insert sample data                  |

Crafted with OmniCraft — add route handlers under `app/api`, pages under `app`, and SQL migrations in `app/db/migrations`.
