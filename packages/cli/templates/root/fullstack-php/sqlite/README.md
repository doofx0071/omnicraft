# {{projectName}}

Full-stack app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                        |
| -------- | --------------------------- |
| Client   | React + Vite + TypeScript   |
| Server   | PHP — Laravel 12 + Eloquent |
| Database | SQLite                      |

## Getting started

No Docker needed — SQLite ships with Laravel. Requires PHP 8.4+ and Composer ([download](https://getcomposer.org/download/)) — always use the latest patched PHP release.

```bash
# 1. Run the migrations
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
└── server/                  # Laravel 12 (created with composer create-project)
    ├── app/Http/Controllers/UserController.php
    ├── routes/api.php       # /api/users routes
    ├── database/
    │   ├── database.sqlite  # created on first migrate
    │   └── migrations/
    └── bootstrap/app.php    # registers the api routes
```

## Environment

`server/.env` (already configured for SQLite by OmniCraft):

```
DB_CONNECTION=sqlite
```

## API

| Method | Path           | Description   |
| ------ | -------------- | ------------- |
| GET    | /api/users     | List users    |
| POST   | /api/users     | Create a user |
| DELETE | /api/users/:id | Delete a user |

## Troubleshooting

| Symptom                               | Fix                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------ |
| API returns `Database unavailable`    | Check `DB_CONNECTION` in `server/.env`                                   |
| `SQLSTATE[HY000]` in the Laravel logs | The SQLite database file is not writable — check the path or permissions |
| Schema changed but columns look stale | Re-run `npm run db:push`                                                 |
| `php: command not found`              | Install PHP 8.4+ and Composer                                            |

## Useful commands

| Command           | What it does                   |
| ----------------- | ------------------------------ |
| `npm run dev`     | Run client and server together |
| `npm run build`   | Build the client               |
| `npm run db:push` | Run the migrations             |
| `npm run db:seed` | Insert sample data             |

Crafted with OmniCraft — add more controllers in `server/app/Http/Controllers` and register routes in `server/routes/api.php`.
