# NABA Fleet 1.13.11-RC — Trial Gate Evidence — 2026-09-11

## Scope
Candidate prepared for real Windows trial. This report does not claim Windows BUILD/RUNTIME/SIGN/DEVICE success until the one-click gate is executed on Windows.

## Defects fixed in 1.13.11
1. Runtime certification report still claimed version 1.10.3 while candidate was 1.13.10. Fixed to use `APP_VERSION`.
2. Update UI still displayed 1.10.3. Unified to 1.13.11.
3. Windows certification previously did not reject a runtime report for a different application version. It now compares `runtime.version` against `package.json` and fails closed.
4. Build certification previously allowed a Cargo.lock normalization + Guardian snapshot during certification. This could mutate what was being certified. Certification now uses `cargo check --locked` and does not snapshot/mutate the baseline.
5. Added explicit trial data-integrity tests for persistence rollback, backup restore rollback/success, Smart Import save/link/update, and retaining the pending review after persistence failure.
6. Added a one-click Windows Trial Gate that launches the exact built executable only after certification passes.
7. Added a Deep Security GitHub workflow for CodeQL security-extended (JavaScript/TypeScript + Rust), npm audit, cargo-audit/RustSec, locked Cargo check, and full deterministic regression. Workflow is prepared but has not been executed against this exact source in GitHub yet.

## Executed evidence in current environment
- `npm run test:all`: PASS, including the previous 21 gates plus the new Trial Data Integrity gate.
- Static controls: 238 buttons; no raw inline DOM handlers; no javascript: URLs; routes/modules resolve.
- Node/V8 syntax: 29 owned JS/MJS files PASS.
- Guardian: snapshot/verify PASS across 57 critical files.
- npm audit --omit=dev: PASS, 0 known vulnerabilities (0 info/low/moderate/high/critical).
- npm dependency graph unchanged from 1.13.10 except project version/scripts.
- Cargo dependency graph unchanged from 1.13.10 except root project version.
- Data bundle unchanged: Fleet=85, Drivers=43, Fleet Archive=20, duplicate active plates=0.

## Current security/hardening risks kept visible
- CSP still permits remote executable CDN origins and `unsafe-inline`; production hardening remains required.
- Dynamic `innerHTML` surface remains broad; existing XSS regression passes but this is not equivalent to a complete taint proof.
- CodeQL/cargo-audit workflow is ready but not executed against this exact source in GitHub yet.
- Firebase Security Rules/App Check, GPS live, OCR on representative real documents, and remote services still require live target verification.

## Windows one-click trial
Extract the full source ZIP and run:
`NABA_TRIAL_ONE_CLICK.cmd`

The gate executes: dependency install → deterministic tests → Guardian → `cargo check --locked` → Tauri/NSIS build → launches the built app in certification mode → waits for `runtime-self-test.json` → requires exact runtime version match → requires 5/5 NABA core commands → only then launches the exact certified executable for user trial.

If any step fails, trial is blocked and the report is written to:
`project-governance/WINDOWS_CERTIFICATION_LAST.txt`

## Truth status
IMPLEMENTED = YES
STATIC_PASS = YES
BUILD_PASS = UNVERIFIED (exact 1.13.11, Windows)
SIGN_PASS = UNVERIFIED
PACKAGE_PASS = UNVERIFIED
RUNTIME_PASS = UNVERIFIED (exact 1.13.11, Windows/Tauri)
DEVICE_PASS = UNVERIFIED
RELEASE_PASS = NO

A successful one-click Windows trial can supply BUILD/RUNTIME evidence; signing and live-service/device gates remain separate.
