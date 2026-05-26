# Changelog

## 0.3.0

- Added configurable `retryAttempts`.
- Added total-operation `deadlineMs` alongside per-attempt `timeoutMs`.
- Added retry progress events with cumulative `elapsedMs`.
- Documented timeout budget math for long-running image jobs.

## 0.2.0

- Added stable `ImageErrorCode` metadata for library errors.
- Added `getModelsSupporting()` for UI capability discovery.
- Added mask validation/preparation helpers for inpaint workflows.
- Added best-effort progress callbacks for long-running image operations.
- Expanded hosted docs for BYOK, long-running jobs, masks, usage, model discovery, environment variables, and edit/inpaint options.

## 0.1.0

- Initial project scaffold from `PRD.txt`.
