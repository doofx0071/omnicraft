# {{projectName}}

Full-stack app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                                    |
| -------- | --------------------------------------- |
| Client   | React + Vite + TypeScript               |
| Server   | Python — FastAPI + SQLAlchemy + Alembic |
| Database | PostgreSQL                              |

## Getting started

This project uses [uv](https://docs.astral.sh/uv/) to manage the Python environment (one-time install: `pip install uv` or `winget install astral-sh.uv`).

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Sync Python dependencies and create the tables
npm run db:push

# 3. (optional) Insert sample data
npm run db:seed

# 4. Run client + server together
npm run dev
```

Open http://localhost:5173 — the demo page lists, creates and deletes users through the real API and database.

## Project layout

```
├── client/                  # React + Vite app (proxies /api to the server)
│   └── src/lib/api.ts       # typed fetch wrapper — add your API calls here
├── server/                  # FastAPI app (managed with uv)
│   ├── alembic/             # migrations — db:migrate autogenerates one
│   └── app/
│       ├── main.py          # FastAPI app, CORS, routers
│       ├── config.py        # settings from server/.env (pydantic-settings)
│       ├── models.py        # SQLAlchemy models
│       ├── database.py      # async engine + session
│       ├── seed.py          # sample data
│       └── routes/          # /api/health and /api/users
└── docker-compose.yml       # local PostgreSQL
```

## Environment

`server/.env` (already created from `server/.env.example`):

```
DATABASE_URL=postgresql+asyncpg://omnicraft:omnicraft@localhost:5432/{{databaseName}}
```

## API

| Method | Path           | Description    |
| ------ | -------------- | -------------- |
| GET    | /api/health    | Liveness check |
| GET    | /api/users     | List users     |
| POST   | /api/users     | Create a user  |
| DELETE | /api/users/:id | Delete a user  |

## Troubleshooting

| Symptom                                            | Fix                                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| API returns `Database unavailable`                 | PostgreSQL isn't running — start it with `docker compose up -d`                                       |
| `ConnectionRefusedError` in the server logs        | Wrong `DATABASE_URL` in `server/.env`, or the database container is down                              |
| `port 5432 is already in use` when starting Docker | Another PostgreSQL owns the port — change the host port in `docker-compose.yml` **and** `server/.env` |
| `uv: command not found`                            | Install uv: `pip install uv` or `winget install astral-sh.uv`                                         |

## Useful commands

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Run client and server together            |
| `npm run build`      | Build the client                          |
| `npm run db:push`    | Apply migrations (`alembic upgrade head`) |
| `npm run db:migrate` | Autogenerate a migration                  |
| `npm run db:seed`    | Insert sample data                        |

Crafted with OmniCraft — add more routes in `server/app/routes`, register them in `app/main.py`, and extend the models in `app/models.py`.
