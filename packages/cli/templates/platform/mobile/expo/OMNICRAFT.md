# OmniCraft mobile notes

This Expo app was scaffolded by OmniCraft (`npm create omnicraft@latest` → Mobile App).

## What's inside

- `src/lib/api.ts` — typed API client pointing at `EXPO_PUBLIC_API_URL`
  (defaults to `http://localhost:3000`).

## Pairing with a backend

Mobile devices are separate computers — `localhost` inside the app refers to
the device, not your development PC:

| Target              | Base URL                      |
| ------------------- | ----------------------------- |
| Android emulator    | `http://10.0.2.2:3000`        |
| iOS simulator       | `http://localhost:3000`       |
| Physical device     | your PC's LAN IP (`ipconfig` / `ifconfig`) — same Wi-Fi network |

Set `EXPO_PUBLIC_API_URL` in `.env` before `npx expo start`.

To get a ready-made backend with the users API this client expects:

```bash
npm create omnicraft@latest my-backend -- --yes --platform web
# choose full-stack; the /api/health and /api/users endpoints match api.ts
```

## Commands

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npx expo start`       | Dev server (press `a` / `i` for Android / iOS) |
| `npx expo start --tunnel` | Reachable without same Wi-Fi (uses a tunnel) |
| `npx expo --version`   | Show the Expo CLI version           |
