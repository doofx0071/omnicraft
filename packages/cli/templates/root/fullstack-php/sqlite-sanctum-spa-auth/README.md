# {{projectName}}

Full-stack app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                                        |
| -------- | ------------------------------------------- |
| Client   | React + Vite + TypeScript                   |
| Server   | PHP — Laravel 12 + Sanctum SPA sessions     |
| Database | SQLite                                      |
| Auth     | Laravel session guard + first-party cookies |

## Start the app

Requires PHP 8.2+, Composer, Node.js, and npm. Apply the migrations, then start the Vite client and
Laravel API:

```bash
npm run db:push
npm run dev
```

Open http://localhost:5173 to register or sign in. The browser session stays in Laravel's cookie
session; the client initializes CSRF protection through `/sanctum/csrf-cookie` and sends the decoded
`X-XSRF-TOKEN` header on mutations. SQLite stores users and application records. Laravel's generated
session store remains file-based; this scaffold does not configure database-backed or distributed
sessions.

## Authentication API

| Method | Path                 | Access            |
| ------ | -------------------- | ----------------- |
| POST   | `/api/auth/register` | Public            |
| POST   | `/api/auth/login`    | Public            |
| POST   | `/api/auth/logout`   | Signed-in session |
| GET    | `/api/me`            | Signed-in session |
| GET    | `/api/users`         | Signed-in session |
| POST   | `/api/users`         | Signed-in session |
| DELETE | `/api/users/:id`     | Record owner only |

Each account can list, create, and delete only its own sample users. The existing Laravel 12 API
scaffold with `--auth none` remains public. This mode does not issue personal access tokens or add a
second provider-based identity layer.

Registration and sign-in share a Laravel IP-based limit of 10 requests per 15 minutes. Invalid
credentials return a generic 422 response and count toward that limit.

## Browser and production domains

The local Vite config proxies `/api` and `/sanctum` to Laravel. `server/.env` includes
`SANCTUM_STATEFUL_DOMAINS` and `CORS_ALLOWED_ORIGINS` for the local Vite hosts. For a production SPA
and API on separate subdomains, set `SANCTUM_STATEFUL_DOMAINS` to the SPA host, set
`CORS_ALLOWED_ORIGINS` to its full HTTPS origin, and set `SESSION_DOMAIN` to the shared parent domain
(for example, `.example.com`). Enable `SESSION_SECURE_COOKIE` for HTTPS. The generated CORS config
allows credentials and lists explicit origins; do not replace them with a wildcard. No API token,
provider secret, or service-role key is generated.

See the [Laravel 12 Sanctum SPA authentication documentation](https://laravel.com/framework/docs/12.x/sanctum#spa-authentication)
for the framework's cookie, CSRF, stateful-domain, and deployment requirements.

This generated project uses SQLite. The CLI also supports PostgreSQL and MySQL for the same
React/Vite + TypeScript + Laravel 12 API session-auth path; their generated READMEs name the selected
database. Integrated Laravel 13 Livewire and Inertia React applications use separate auth choices and
remain SQLite-only.
