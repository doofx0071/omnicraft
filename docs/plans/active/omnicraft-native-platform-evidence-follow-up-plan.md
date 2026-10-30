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

- [x] Each new scenario generates through its existing official generator and production OmniCraft
      layers, then installs and performs the target-platform build and launch/process verification.
- [x] Android-emulator, Tauri macOS, and Tauri Windows scenarios run as explicit hosted CI matrix
      entries with bounded timeouts and cleanup; the strict release gate still rejects missing, skipped,
      cancelled, or failed required jobs.
- [x] Relevant local unit/type/build/support-evidence checks pass; hosted exact-head CI and the release
      gate pass on implementation commit `983c5164bf9989adbe19712b13cc4e8659ef5bda`.
- [x] The support matrix records only observed platform-specific evidence and keeps Expo and Tauri
      `Scaffold-verified`; physical-device coverage remains explicitly unverified.
- [x] The PR is open against the current PR #51 head and remains unmerged.
- [x] This plan remains active until physical-device evidence is available; close it only after that
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

Hosted attempt [#41083129801](https://github.com/doofx0071/omnicraft/actions/runs/41083129801) on
`d3e23a99ea1a3664cf6de7174b4bc4b61b28f46a` failed before generated-project execution because the
hosted image's Android `sdkmanager` directory was not on `PATH`. The obsolete run was cancelled after
that required setup failure; it is not platform evidence. The workflow now discovers `sdkmanager`
under the runner's Android SDK, adds its tools to the current and following steps, and bounds package
installation.

Hosted attempt [#41083572039](https://github.com/doofx0071/omnicraft/actions/runs/41083572039)
on `fcecbc57d590291cc921a4a574e7fb8f7054d582` confirmed that SDK installation and the isolated
Android system image setup succeed. Android project generation, dependency installation, and
prebuild also completed, but emulator startup failed because the AVD profile was not discoverable
under the runner's default Android home. The Tauri macOS/Windows jobs had not completed at the time
of this update. This attempt is not Android platform evidence.

The Android scenario now gives `avdmanager` and the emulator the same per-run `ANDROID_USER_HOME`
and `ANDROID_AVD_HOME`, passes an explicit AVD path, and checks `emulator -list-avds` before startup.
A fresh exact-head workflow and strict release gate are still required.

Hosted attempt [#41084528633](https://github.com/doofx0071/omnicraft/actions/runs/41084528633)
on `0242756ba29b2ad782b8384bd49bd98b55b73ced` confirmed that the explicit AVD path is discoverable;
Expo generation, dependency installation, and Android prebuild completed. Emulator startup then
failed because the runner user lacked permission to use `/dev/kvm`. This is not Android runtime
evidence. The Android-only hosted setup now grants the ephemeral job access to `/dev/kvm` and runs
`emulator -accel-check` before the generated-project scenario. The exact-head CI and strict release
gate must run again.

Cancellation was requested for the remaining jobs in both unsuccessful runs after the Android
setup failure; neither run is full hosted platform evidence or a release-gate pass. A new exact-head
run is required for the current KVM setup change.

Hosted attempt [#41085265586](https://github.com/doofx0071/omnicraft/actions/runs/41085265586)
on `3b677a918998ffa60ac40232a67752602988dde3` passed the existing Expo iOS simulator and Tauri
Linux checks, plus the new Tauri macOS and Windows generated-project build/launch checks. Expo Android
generated the project, created and booted the Android 36 emulator, built and installed the Debug APK,
and accepted the launch command. Its final assertion failed because the headless emulator did not
report the package as its focused window. The run therefore failed and is not Android runtime evidence;
the strict release gate rejected the failed required platform job. The Android assertion now polls
`adb shell pidof <application-id>` twice consecutively, checking that the launched app process stays
alive, which matches the plan's process-verification requirement for a headless emulator.

Hosted attempt [#41089689628](https://github.com/doofx0071/omnicraft/actions/runs/41089689628) on
`983c5164bf9989adbe19712b13cc4e8659ef5bda` passed every required check on its final attempt. The exact
Expo Android emulator job built and installed the Debug APK, launched it, and observed the application
process remain alive. Expo iOS simulator and Tauri Linux, macOS, and Windows jobs also passed; the support
matrix and testing strategy now record those scenario-specific results without changing either matrix
row from `Scaffold-verified`. The first attempt's macOS Node 20 check was cancelled because a hosted
arm64 runner was unavailable; the targeted rerun passed, followed by the strict release gate.

Physical Android and iOS device evidence remains unavailable, so this plan stays Active and those
hardware paths remain Selectable — unverified. Native app behavior beyond build and launch is also not
covered by these scenarios.
