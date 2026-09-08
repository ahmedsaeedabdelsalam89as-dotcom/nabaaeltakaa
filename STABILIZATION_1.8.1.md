# NABA Fleet 1.8.1 — Stabilization & Security Hardening

## Closed P0 items
- Tracking bridge: exact HTTPS host/path allowlist, port/userinfo validation, redirects disabled.
- Desktop secret storage: Windows DPAPI-backed encrypted files for tracking, phone bridge, Firebase auth/password, WhatsApp token.
- Removed embedded Firebase account password from application source; credentials are now entered by the operator and stored via DPAPI on Windows.
- Legacy localStorage tracking/phone/WhatsApp secrets are migrated out of localStorage when encountered.
- Tauri CSP is no longer null; defensive source restrictions added while retaining compatibility with the existing monolithic inline application.
- Phone Bridge Android: Android Keystore wrapping, requestId replay detection, 30s expiry, request-size checks, bounded worker pool, 20 req/min rate limit, stricter phone validation, FLAG_SECURE.
- Release CI restored: validation, unsigned Windows artifact, signed tag release.

## Executed tests
- npm run preflight: PASS
- npm run test:security: PASS
- npm run test:cognitive: PASS
- npm run test:hybrid: PASS
- node --check on 6 executable inline JS blocks: PASS
- data-bundle SHA256 unchanged: b9171a8aeefb22378ddc67a4c91caadd2b4d016da5cf43e21ab7846bf0271867

## Not executed in this environment
- cargo check / Rust compilation (cargo/rustc unavailable)
- Android Gradle build / APK installation
- Windows NSIS build
- Runtime CSP test inside Tauri WebView
- DPAPI runtime test on Windows

## Required operational action
The Firebase password that existed in older source packages should be rotated before production use because it was previously embedded in application source. Do not reuse the old credential.
