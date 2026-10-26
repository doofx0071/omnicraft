# {{projectName}}

Full-stack app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                                    |
| -------- | --------------------------------------- |
| Client   | React + Vite + TypeScript               |
| Server   | Python — FastAPI + SQLAlchemy + Alembic |
| Database | SQLite                                  |

## Getting started

No Docker needed — the SQLite database file is created automatically. This project uses [uv](https://docs.astral.sh/uv/) to manage the Python environment (one-time install: `pip install uv` or `winget install astral-sh.uv`).

```bash
# 1. Sync Python dependencies and create the tables
npm run db:push

# 2. (optional) Insert sample data
npm run db:seed

# 3. Run client + server together
npm run dev
```

Open http://localhost:5173 — the demo page lists, creates and deletes users through the real API and database.

## Project layout

```
├── client/                  # React + Vite app (proxies /api to the server)
│   └── src/lib/api.ts       # typed fetch wrapper — add your API calls here
├── server/                  # FastAPI app (managed with uv)
│   ├── alembic/             # migrations — db:migrate autogenerates one
│   ├── data/                # SQLite database file (created on first run)
│   └── app/
│       ├── main.py          # FastAPI app, CORS, routers
│       ├── config.py        # settings from server/.env (pydantic-settings)
│       ├── models.py        # SQLAlchemy models
│       ├── database.py      # async engine + session
│       ├── seed.py          # sample data
│       └── routes/          # /api/health and /api/users
```

## Environment

`server/.env` (already created from `server/.env.example`):

```
DATABASE_URL=sqlite+aiosqlite:///data/app.db
```

## API

| Method | Path           | Description    |
| ------ | -------------- | -------------- |
| GET    | /api/health    | Liveness check |
| GET    | /api/users     | List users     |
| POST   | /api/users     | Create a user  |
| DELETE | /api/users/:id | Delete a user  |

## Troubleshooting

| Symptom                               | Fix                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| API returns `Database unavailable`    | Check `DATABASE_URL` in `server/.env` — the folder is created automatically |
| `unable to open database file`        | The path in `DATABASE_URL` is not writable — fix the path or permissions    |
| Schema changed but columns look stale | Re-run `npm run db:push`, or autogenerate one with `npm run db:migrate`     |
| `uv: command not found`               | Install uv: `pip install uv` or `winget install astral-sh.uv`               |

## Useful commands

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Run client and server together            |
| `npm run build`      | Build the client                          |
| `npm run db:push`    | Apply migrations (`alembic upgrade head`) |
| `npm run db:migrate` | Autogenerate a migration                  |
| `npm run db:seed`    | Insert sample data                        |

Crafted with OmniCraft — add more routes in `server/app/routes`, register them in `app/main.py`, and extend the models in `app/models.py`.

## Switching to PostgreSQL later?

Re-run OmniCraft and choose PostgreSQL — the rest of the stack stays the same.
