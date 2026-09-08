# NABA 1.9.0 — Architecture + Operations Workspace

## Goal
Reduce cognitive/UI density without deleting any existing engine or data, and start gradual modularization with zero migration of the embedded data-bundle.

## Implemented
- External module boundary: `src/modules/naba-workspace.js`.
- External workspace stylesheet: `src/styles/naba-workspace.css`.
- Simplified 7-space navigation while preserving every legacy module behind “كل الوحدات”.
- Universal Ctrl+K command palette: pages + vehicles + drivers + local NABA question route.
- Daily Action Center injected into dashboard using existing alerts/tasks.
- Context Intelligence panel for selected vehicles/drivers, including Vehicle 360 confidence when available.
- Existing pages, engines, storage keys and data-bundle remain unchanged.

## Deliberate non-goals
- No framework rewrite.
- No migration of the one-line data-bundle.
- No deletion of legacy pages.
- No claim of Windows/Tauri runtime validation until built on target runner.
