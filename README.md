# Cyberpunk Diary

A local-first personal planner for Android, Windows, macOS and Linux. Orbitron typography, four switchable themes and a compact calendar/task workspace.

## Features
- Week / month / day views; undated task lists.
- Notes, tasks and checklists, with local SQLite persistence.
- Theme changes are live (no app restart): Cyberpunk Red (default), Cyberpunk, Matrix and Soul Killer.
- Desktop + Android Flutter app.
- Optional device-to-device sync through the companion Go sync host. Data remains usable offline.

## Sync model
The PC (or another always-on machine) runs `sync-host`. Devices connect to it over the local network or over a private encrypted network such as Tailscale. Tailscale uses WireGuard encryption and provides LAN/direct or internet connectivity without exposing the sync host publicly. The app sync protocol uses bearer-token authentication, incremental change exchange, per-item timestamps and tombstones. This is a practical Syncthing-inspired device sync workflow, not Syncthing's block-level folder replication.

1. Run the host: `cd sync-host && SYNC_TOKEN='use-a-long-random-secret' SYNC_ADDR=':8787' go run .`
2. On the phone, enter the host URL (for example `http://192.168.1.20:8787` on a trusted LAN, or the HTTPS/Tailscale Serve URL when away) and the same token in Settings → Sync.
3. Keep the host running. For internet access, install Tailscale on both devices and use the PC's Tailscale address; use Tailscale Serve for HTTPS.

Do not expose plain HTTP sync over the public internet. Use Tailscale or a reverse proxy with HTTPS.

## Build
Install Flutter stable and run:
- Windows: `flutter config --enable-windows-desktop && flutter run -d windows`
- Android: `flutter run -d android`
- APK: `flutter build apk --release`

GitHub Actions builds Android APK and Windows ZIP on pushes/tags. The workflow is the build gate; releases should only be called stable after the CI run and device testing pass.

## Current scope
The first rebuilt baseline focuses on stable local CRUD, theme switching and calendar navigation. Sync host/client are included as an opt-in layer. Conflict policy is last-write-wins by item timestamp; deleted items are retained as tombstones to propagate deletions. Back up the host database before upgrades.
