# OmniCraft desktop notes

This Tauri 2 app was scaffolded by OmniCraft (`npm create omnicraft@latest` → Desktop App,
React + TypeScript UI).

## Prerequisites for building the desktop shell

- **Rust toolchain** (`rustup` — https://rustup.rs). Check with `cargo --version`.
- Platform specifics (Linux needs webkit2gtk system packages — see
  https://tauri.app/start/prerequisites/).

## Commands

| Command                    | What it does                                        |
| -------------------------- | --------------------------------------------------- |
| `npm install`              | Install UI dependencies                             |
| `npm run tauri dev`        | Run the desktop app with hot reload                 |
| `npm run tauri build`      | Produce the installable bundle (needs Rust)         |
| `npm run dev`              | Run only the web UI in a browser (fast UI work)     |

## Pairing with a backend

The UI ships `src/lib/api.ts` — a typed client pointing at `VITE_API_URL`
(default `http://localhost:3000`).

- **Development:** the UI runs at a vite origin — allow it in your backend's
  CORS config, or call `http://localhost:3000` directly from the same machine.
- **Production:** the app origin becomes `tauri://localhost`
  (`https://tauri.localhost` on Windows). Add that origin to your backend's
  CORS allow-list, or use Tauri's HTTP plugin for out-of-webview requests.

To get a ready-made backend with the users API this client expects:

```bash
npm create omnicraft@latest my-backend -- --yes --platform web
# choose full-stack; the /api/health and /api/users endpoints match api.ts
```

## Security

`src-tauri/tauri.conf.json` declares capabilities and the bundle identifier
(OmniCraft sets `com.omnicraft.<app>`). Review
https://tauri.app/security/ before shipping — the default allow-list is
deliberately minimal.
