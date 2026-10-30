# OmniCraft native platform evidence follow-up

**Status:** Active  
**Base:** PR #51 head `b3a33216145d2ef8727ca19f7ed6a9aa509084a2`  
**Scope:** Existing Expo SDK 58 + TypeScript and Tauri 2 + React/TypeScript selectable paths.

## Goal

Extend the existing hosted native integration job to check the Expo Android emulator and Tauri
macOS/Windows desktop paths using the production generators, production composition layers, and the
current templates. Record those platform-specific results without promoting either cross-platform
matrix row. A hosted simulator/emulator is not a physical device.

No active plan owned these remaining platform checks when this follow-up began. The completed runtime
evidence plan records iOS simulator evidence for Expo and Linux desktop evidence for Tauri; it leaves
Android, physical devices, macOS desktop, and Windows desktop untested.

## In scope

- Generate Expo from the existing SDK 58 official template, apply the production Expo layer, install,
  prebuild Android, build/install on a hosted Android emulator, launch, and verify the app process.
- Generate Tauri from the existing React/TypeScript official template, apply the production Tauri
  layer, install, build the Vite frontend and native executable, launch it, and verify the native
  window/process on hosted macOS and Windows runners.
- Register each automated scenario in the current native integration script and hosted CI matrix;
  preserve the strict release gate's exact-success requirement for the native job.
- Record exact hosted scenario links and commit in the support matrix while retaining the existing
  `Scaffold-verified` status for Expo and Tauri.
- Keep logs redacted, use isolated synthetic environments, bound commands and launch waits, and clean
  generated projects, emulators, and child processes in `finally` paths.

## Out of scope and evidence boundaries

- Physical Android or iOS device installation/launch: no physical-device runner or attached device is
  configured in the current hosted workflow. Keep these hardware checks pending and do not describe an
  emulator/simulator result as physical-device evidence.
- New templates, frameworks, providers, stack combinations, capability choices, or support claims.
- Changes to the completed runtime plans, unrelated master/auth plans, or release-gate semantics.
- CI path filtering or any other optimization that skips a required release-gate job.

## Definition of done

- [ ] Each new scenario generates through its existing official generator and production OmniCraft
      layers, then installs and performs the target-platform build and launch/process verification.
- [ ] Android-emulator, Tauri macOS, and Tauri Windows scenarios run as explicit hosted CI matrix
      entries with bounded timeouts and cleanup; the strict release gate still rejects missing, skipped,
      cancelled, or failed required jobs.
- [ ] Relevant local unit/type/build/support-evidence checks pass; hosted exact-head CI and the release
      gate pass on the final PR commit.
- [ ] The support matrix records only observed platform-specific evidence and keeps Expo and Tauri
      `Scaffold-verified`; physical-device coverage remains explicitly unverified.
- [ ] The PR is opened against the current PR #51 head and remains unmerged.
- [ ] This plan remains active until physical-device evidence is available; close it only after that
      pending scope has evidence or is explicitly split into a separately owned follow-up.

## Results

Local validation before hosted execution:

- `npm ci` completed successfully (263 packages added; zero reported vulnerabilities).
- `npm test --workspace=create-omnicraft` passed 153 tests in 14 files.
- `npx tsc --noEmit`, `npx tsup`, and
  `npm run check:support-matrix --workspace=create-omnicraft` passed; the checker found 40 Supported
  rows.
- `git diff --check` passed. The Windows PowerShell window-query command ran through `cmd.exe` and
  returned current window titles.
- The local Windows checkout has no Android SDK or Rust/Cargo, so native generated-project execution
  is deferred to the hosted platform runners.

Hosted generated-project and release-gate results are pending.
