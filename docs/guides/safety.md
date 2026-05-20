# Safety

Provider safety and moderation controls are explicit. The library never relaxes safety settings automatically.

Safety-blocked requests are not retried. The client also never falls back from a safety-blocked provider unless `fallback.onSafetyError` is explicitly enabled.

Google `OFF` and `BLOCK_NONE` thresholds require `allowLessRestrictiveSafetySettings: true`.
