# {{projectName}}

Full-stack app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer   | Tech                          |
| ------- | ----------------------------- |
| Client  | React + Vite + TypeScript     |
| Server  | {{backendFramework}} + TypeScript |
| Database| PostgreSQL + {{orm}}           |

## Getting started

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Create the tables from the schema
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
├── server/                  # {{backendFramework}} API
│   └── src/
│       ├── db/              # {{orm}} client, schema and seed script
│       ├── routes/          # /health and /users — add new routes here
│       └── env.ts           # environment variable validation (zod)
└── docker-compose.yml       # local PostgreSQL
```

## Environment

`server/.env` (already created from `server/.env.example`):

```
DATABASE_URL=postgres://omnicraft:omnicraft@localhost:5432/{{databaseName}}
```

## API

| Method | Path               | Description            |
| ------ | ------------------ | ---------------------- |
| GET    | /api/health        | Liveness check         |
| GET    | /api/users         | List users             |
| POST   | /api/users         | Create a user          |
| DELETE | /api/users/:id     | Delete a user          |

## Useful commands

| Command            | What it does                              |
| ------------------ | ----------------------------------------- |
| `npm run dev`      | Run client and server together            |
| `npm run build`    | Build client and server                   |
| `npm run db:push`  | Push schema changes to the database       |
| `npm run db:migrate` | Create/apply a migration                |
| `npm run db:seed`  | Insert sample data                        |
| `npm run db:studio`| Open the database GUI                     |

Crafted with OmniCraft — add more routes in `server/src/routes`, register them in `routes/index.ts`, and extend the schema in `server/src/db/schema.ts` (or `prisma/schema.prisma`).
