# {{projectName}}

Integrated Laravel + Livewire app scaffolded by [OmniCraft](https://github.com/doofx0071/omnicraft) ⚡

| Layer          | Tech                                      |
| -------------- | ----------------------------------------- |
| App and UI     | Laravel 13 + Livewire 4 (PHP-driven UI)   |
| Database       | SQLite + Eloquent                         |
| Authentication | {{authSetup}}                             |

## Requirements

- PHP 8.3 or newer and Composer
- Node.js 22.18+ or 24.11+ and npm for Vite assets (required by the pinned Livewire starter kit's Vite Plus tooling)

OmniCraft uses the official Laravel Livewire starter kit pinned to a reviewed commit. Composer
dependencies and the application key are prepared during generation. No external auth provider or
provider secret is configured.

## Getting started

From the project root:

```bash
cd server
npm install # if frontend dependency setup was skipped
php artisan migrate
composer run dev
```

Open the URL printed by Laravel's development server. To build production assets, run `npm run build`
from the project root.

## Authentication

The selected setup is **{{authSetup}}**. `Laravel native auth (Fortify)` uses Laravel's session-based
authentication and the official authenticated starter kit. `None` uses the official blank Livewire
starter kit and does not add login or registration routes. OmniCraft does not provision provider
accounts or collect credentials.

## Project layout

```text
├── package.json            # OmniCraft convenience scripts
└── server/                 # Laravel application, Livewire UI, Eloquent, and SQLite database
```

Add application pages and Livewire components under `server/resources/views` and
`server/app/Livewire`.
