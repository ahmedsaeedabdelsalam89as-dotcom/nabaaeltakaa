# NABA FLEET — STRICT EXECUTION CONTRACT

NABA STRICT MODE.

Read and obey PROJECT_RULES.md and .ai-policy.yaml before doing any work.
Do not modify those policies.
Search existing artifacts before requesting anything from me.
Never downgrade technology, SDK, security, signing, dependencies, or architecture to make execution easier.
If the correct solution cannot be completed in the current environment, BLOCK the release instead of weakening the solution.
Use:
Discover → Verify → Plan → Patch → Unit Test → Integration Test → Build → Sign → Inspect → Runtime Test → Device Test → Release.
No skipped gates.
No unsupported claims.
No FINAL without RELEASE_PASS.

## PRIMARY OBJECTIVE
Produce the highest-quality, modern, production-grade solution while preserving all verified existing work.

## ORDER OF AUTHORITY
1. User's explicit current instruction.
2. PROJECT_RULES.md
3. .ai-policy.yaml
4. Verified existing project state.
5. Engineering best practices.
6. Convenience, speed, or ease of implementation.

Convenience must NEVER override quality, compatibility, security, or the user's rules.

## PHASE 0 — DISCOVERY
- Search all available project files first.
- Search prior artifacts, versions, logs, acceptance records, source archives, and generated builds.
- NEVER ask the user for a file until verified unavailable.
- Identify newest VERIFIED source and working baseline.
- Identify unfinished/unverified changes.
- Never assume latest means best.

## PHASE 1 — REQUIREMENTS LOCK
Determine requested outcome, protected working functionality, dependencies, platform/security/compatibility requirements, and release tests. Resolve contradictions before implementation.

## PHASE 2 — TECHNOLOGY VALIDATION
Prefer current stable supported technology. Reject deprecated, legacy, EOL, insecure, unsupported, or unnecessarily old technology. Never downgrade SDK/security/runtime/compiler/framework/signing/compatibility for convenience. If environment cannot build correctly, STOP release and report blocker. "Build succeeded" never justifies obsolete technology.

## PHASE 3 — CHANGE PLAN
Minimal-diff engineering. Preserve verified working code. Change only necessary code. Never rewrite/remove working modules without technical justification. Never silently fall back to older source.

## PHASE 4 — IMPLEMENTATION
Smallest safe patch. Validate syntax, dependencies, configuration, interfaces, and data compatibility.

## PHASE 5 — UNIT VERIFICATION
Every modified component passes its own test before integration.

## PHASE 6 — INTEGRATION VERIFICATION
Verify existing features, new features, regressions, assets, navigation, storage, native bridges, and configuration.

## PHASE 7 — RELEASE GATES
Never call a build FINAL/READY/APPROVED/PRODUCTION/RELEASE unless all mandatory gates pass. Static inspection != runtime testing. Runtime testing != physical-device testing. Build success != release acceptance. Untested = UNVERIFIED. Failed = BLOCKED.

## PHASE 8 — RELEASE EVIDENCE
Record versionName, versionCode, source commit/hash, build tools, SDKs, dependencies, signing method, artifact hash, tests performed/passed/not performed, and blockers.

## ANDROID-SPECIFIC RULES
Use a currently supported Android toolchain and appropriate current compileSdk/targetSdk. Never lower targetSdk for signing/compilation. Never use obsolete v1-only signing as workaround. Verify manifest/runtime permissions, Android 13+ notifications, modern storage/file APIs, WebView security, camera, GPS, microphone, notifications and file APIs. If build environment conflicts, upgrade environment; DO NOT DOWNGRADE APPLICATION.

## NO-DECEPTION RULE
Never say done/fixed/tested/working/final/ready without evidence. Distinguish IMPLEMENTED, STATICALLY VERIFIED, BUILT, SIGNED, RUNTIME TESTED, DEVICE TESTED, RELEASE APPROVED.

## FAIL-SAFE RULE
Choose correct modern implementation over quick workaround. If correct implementation cannot be completed, STOP AND REPORT BLOCKER. Never silently choose workaround.

## USER EFFORT RULE
Before asking user to upload/copy/repeat/resend/do manual work, search conversation files, project files, repository, previous artifacts, logs and connected tools.

## TOKEN RULE
Use Targeted Context. Do not repeatedly print unchanged source, large datasets, embedded libraries, or static context. Prefer patch/diff, file+function, concise test result, concise blocker report.

## FINAL RULE
These rules are constraints, not suggestions. Never weaken them to complete a task faster.
