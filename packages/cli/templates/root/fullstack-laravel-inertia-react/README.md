# {{projectName}}

Integrated Laravel + Inertia React app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer          | Tech                                      |
| -------------- | ----------------------------------------- |
| App and UI     | Laravel 13 + Inertia + React + TypeScript |
| Database       | SQLite + Eloquent                         |
| Authentication | {{authSetup}}                             |

## Requirements

- PHP 8.3 or newer and Composer
- Node.js and npm for Vite assets

OmniCraft uses an official Laravel React starter kit pinned to a reviewed upstream commit. Composer
dependencies, the application key, SQLite database, and initial migrations are prepared during
generation. No external auth provider or provider secret is configured.

## Getting started

From the project root:

```bash
cd server
npm install # if frontend dependency setup was skipped
php artisan migrate
composer run dev
```

Open the URL printed by Laravel's development server. To build production assets, run `npm run build`
from the `server/` directory.

## Authentication

The selected setup is **{{authSetup}}**. `Laravel native auth (Fortify)` uses Laravel's session-based
authentication and the official authenticated starter kit. `None` uses the official blank Inertia
React starter kit and does not add login or registration routes. This scaffold configures no account
linking or managed providers.

## Project layout

```text
├── package.json            # OmniCraft convenience scripts
└── server/                 # Integrated Laravel app, Inertia React UI, Eloquent, and SQLite database
```

Add application pages under `server/resources/js/pages` and Laravel routes under `server/routes`.
