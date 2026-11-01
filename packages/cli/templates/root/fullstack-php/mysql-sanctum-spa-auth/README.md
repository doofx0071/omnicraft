# {{projectName}}

Full-stack app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer    | Tech                                        |
| -------- | ------------------------------------------- |
| Client   | React + Vite + TypeScript                   |
| Server   | PHP — Laravel 12 + Sanctum SPA sessions     |
| Database | MySQL                                       |
| Auth     | Laravel session guard + first-party cookies |

## Start the app

Requires PHP 8.2+, Composer, Node.js, npm, and a running MySQL server. The generated Docker Compose
service starts a local MySQL instance:

```bash
# 1. Start MySQL
docker compose up -d

# 2. Apply the migrations
npm run db:push

# 3. Start the client and API
npm run dev
```

Open http://localhost:5173 to register or sign in. The browser session stays in Laravel's cookie
session; the client initializes CSRF protection through `/sanctum/csrf-cookie` and sends the decoded
`X-XSRF-TOKEN` header on mutations. MySQL stores users and application records. Laravel's generated
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

Each account can list, create, and delete only its own sample users. The Laravel 12 API scaffold
with `--auth none` remains public. This mode does not issue personal access tokens or add another
provider-based identity layer.

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

This path is limited to React/Vite + TypeScript, Laravel 12 API, and MySQL. It is separate from
the integrated Laravel 13 Livewire and Inertia React applications.
