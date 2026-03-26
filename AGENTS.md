# Agent Preferences

- After code changes, run `pnpm run format` by default.
- Do not run `pnpm run lint` unless the user explicitly requests linting.
- In Vue SFCs and composables, do not manually import auto-imported APIs from `vue`, `vue-router`, and `pinia` (for example: `ref`, `computed`, `watch`, `useRoute`, `useRouter`, `defineStore`, `storeToRefs`).
- `ElementPlusResolver` + auto-import globals are enabled; do not manually import APIs already declared in `.eslintrc-auto-import.json` (for example: `ElMessage`, `ElMessageBox`).
