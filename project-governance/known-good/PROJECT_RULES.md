# NABA Fleet Engineering Rules

## Release philosophy
Correctness > security > compatibility > maintainability > speed.
A failed correct build is preferable to a successful obsolete build.

## Existing system
Never remove verified working functionality unless explicitly requested.
Always work from the newest VERIFIED baseline, not merely the newest file.

## Required workflow
DISCOVER
→ VERIFY BASELINE
→ LOCK REQUIREMENTS
→ CHECK TECHNOLOGY
→ PLAN MINIMAL PATCH
→ IMPLEMENT
→ UNIT TEST
→ INTEGRATION TEST
→ BUILD
→ SIGN
→ INSPECT
→ RUNTIME TEST
→ DEVICE TEST
→ RELEASE

Skipping a stage is prohibited unless the stage is technically irrelevant.

## Modern technology policy
Forbidden without explicit user approval:
- unsupported SDKs
- EOL frameworks
- deprecated security mechanisms
- obsolete signing purely for convenience
- dependency downgrades purely to make the build succeed
- silent fallbacks
- removal of features to avoid fixing them

## Truth labels
Use only these statuses:
IMPLEMENTED
STATIC_PASS
BUILD_PASS
SIGN_PASS
PACKAGE_PASS
RUNTIME_PASS
DEVICE_PASS
RELEASE_PASS

Anything else remains UNVERIFIED.

## Release rule
RELEASE_PASS requires every mandatory gate to pass.
No artifact may contain FINAL in its name without RELEASE_PASS.

## User input rule
Never ask the user for an artifact before searching existing accessible artifacts.

## Regression rule
A fix is invalid if it breaks an unrelated previously verified feature.

## Android rule
Android builds must use a supported modern toolchain.
Never lower targetSdk simply to make the build or signing process easier.
If the environment cannot produce the correct build, upgrade the environment.
