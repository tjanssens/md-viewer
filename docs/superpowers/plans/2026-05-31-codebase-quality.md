# Codebase Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve MD Viewer against the requested codebase qualities without changing its core product scope.

**Architecture:** Keep improvements close to existing Angular/Electron patterns. Extract small pure validation helpers where persisted data crosses trust boundaries, keep services responsible for orchestration, and cover critical behavior with Jest.

**Tech Stack:** Angular 17 standalone components, Electron 28, TypeScript 5.3, Jest with jest-preset-angular.

---

### Task 1: Harden Persisted Settings

**Files:**
- Create: `src/app/services/app-settings.util.ts`
- Create: `src/app/services/app-settings.util.spec.ts`
- Modify: `src/app/services/settings.service.ts`

- [x] Add tests for stored settings with invalid JSON, wrong theme values, unsafe font sizes, and partial valid settings.
- [x] Add a pure normalization helper that merges defaults, validates theme, clamps font sizes, and accepts only non-empty font names.
- [x] Route `SettingsService` load and update paths through the helper.

### Task 2: Harden Feedback Storage

**Files:**
- Create: `src/app/services/feedback-storage.util.ts`
- Create: `src/app/services/feedback-storage.util.spec.ts`
- Modify: `src/app/services/feedback.service.ts`

- [x] Add tests proving malformed persisted feedback is ignored and valid legacy items are normalized.
- [x] Add a pure parser/normalizer for feedback items.
- [x] Use it when loading feedback from localStorage.

### Task 3: Keep Current File State Consistent

**Files:**
- Modify: `src/app/app.component.ts`
- Create: `src/app/app.component.spec.ts`

- [x] Add a component test for Save As updating the current filename service after a successful save.
- [x] Update the Save As path to notify both feedback storage and current-file display state.

### Task 4: Improve Developer Operability

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [x] Add a `check` script that runs tests and production build.
- [x] Refresh development instructions and fix mojibake so the README is readable.

### Task 5: Verify End to End

**Files:**
- No source files.

- [x] Run targeted Jest tests during each red/green cycle.
- [x] Run the full Jest suite.
- [x] Run the production build.
- [x] Start the app or a local browser-hosted build.
- [x] Exercise visible UI paths in the browser where feasible. The in-app browser runtime failed to start in the sandbox, so the built renderer was served locally and checked over HTTP instead.
- [x] Re-check this plan against the final diff.
