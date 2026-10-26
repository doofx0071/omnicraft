# {{projectName}}

Full-stack app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                        |
| -------- | --------------------------- |
| Client   | React + Vite + TypeScript   |
| Server   | PHP — Laravel 12 + Eloquent |
| Database | PostgreSQL                  |

## Getting started

Requires PHP 8.4+ and Composer ([download](https://getcomposer.org/download/)) — always use the latest patched PHP release.

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Run the migrations
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
└── server/                  # Laravel 12 (created with composer create-project)
    ├── app/Http/Controllers/UserController.php
    ├── routes/api.php       # /api/users routes
    ├── database/migrations/
    └── bootstrap/app.php    # registers the api routes
```

## Environment

`server/.env` (already configured for PostgreSQL by OmniCraft):

```
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE={{databaseName}}
DB_USERNAME=omnicraft
DB_PASSWORD=omnicraft
```

## API

| Method | Path           | Description   |
| ------ | -------------- | ------------- |
| GET    | /api/users     | List users    |
| POST   | /api/users     | Create a user |
| DELETE | /api/users/:id | Delete a user |

## Troubleshooting

| Symptom                                            | Fix                                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| API returns `Database unavailable`                 | PostgreSQL isn't running — start it with `docker compose up -d`                                       |
| `SQLSTATE[08006]` in the Laravel logs              | Wrong database credentials in `server/.env`, or the database container is down                        |
| `port 5432 is already in use` when starting Docker | Another PostgreSQL owns the port — change the host port in `docker-compose.yml` **and** `server/.env` |
| `php: command not found`                           | Install PHP 8.4+ and Composer                                                                         |

## Useful commands

| Command           | What it does                   |
| ----------------- | ------------------------------ |
| `npm run dev`     | Run client and server together |
| `npm run build`   | Build the client               |
| `npm run db:push` | Run the migrations             |
| `npm run db:seed` | Insert sample data             |

Crafted with OmniCraft — add more controllers in `server/app/Http/Controllers` and register routes in `server/routes/api.php`.
