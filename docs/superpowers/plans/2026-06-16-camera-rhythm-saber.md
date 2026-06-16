# Camera Rhythm Saber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable H5 front-camera rhythm saber game described in `docs/superpowers/specs/2026-06-16-camera-rhythm-saber-design.md`.

**Architecture:** Create a Vite TypeScript single-page app. Pure gameplay modules handle pose-derived motion, chart timing, scoring, and state transitions; browser modules handle camera/MediaPipe, Three.js rendering, debug overlay, audio clock, and UI flow.

**Tech Stack:** Vite, TypeScript, Vitest, Three.js, MediaPipe Tasks Vision, Web Audio, Canvas 2D, browser `getUserMedia`.

---

## File Structure

- Create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, and `src/vite-env.d.ts` for the Vite app and test runner.
- Create `src/domain/types.ts` for shared chart, pose, motion, score, and app-state types.
- Create `src/domain/motionAnalyzer.ts` and `src/domain/motionAnalyzer.test.ts` for converting pose keypoints into hand/body inputs.
- Create `src/domain/chart.ts` and `src/domain/chart.test.ts` for the built-in rhythm chart and event-window queries.
- Create `src/domain/gameEngine.ts` and `src/domain/gameEngine.test.ts` for scoring, combo, health, hit detection, obstacle detection, and soft tracking-loss behavior.
- Create `src/infrastructure/cameraPose.ts` for `getUserMedia` and MediaPipe PoseLandmarker integration with a deterministic simulated fallback.
- Create `src/infrastructure/audioClock.ts` for song timing with a generated test tone when no asset is present.
- Create `src/rendering/GameRenderer.ts` for Three.js stage, targets, obstacles, energy hands, and visual feedback.
- Create `src/rendering/DebugOverlay.ts` for mirrored video, skeleton, keypoints, trails, and recognition metrics in calibration/debug mode.
- Create `src/app/App.ts` for state flow, DOM wiring, fullscreen, calibration, countdown, play loop, pause, results, and quality settings.
- Create `src/main.ts` and `src/styles.css` for app bootstrap and TV-friendly responsive styling.

## Tasks

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/vite-env.d.ts`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] **Step 1: Add Vite, TypeScript, Vitest, Three.js, and MediaPipe dependencies.**

- [ ] **Step 2: Add baseline app entry that mounts into `#app`.**

- [ ] **Step 3: Run `npm install`.**

- [ ] **Step 4: Run `npm test -- --run` and confirm the empty test baseline succeeds.**

- [ ] **Step 5: Commit with `git commit -m "chore: scaffold h5 rhythm game"`.**

### Task 2: Motion Analyzer TDD

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/motionAnalyzer.test.ts`
- Create: `src/domain/motionAnalyzer.ts`

- [ ] **Step 1: Write tests proving neutral body calibration, hand velocity, swing direction, lean, crouch, and poor tracking quality.**

- [ ] **Step 2: Run `npm test -- --run src/domain/motionAnalyzer.test.ts` and confirm tests fail because the module is missing.**

- [ ] **Step 3: Implement the minimal analyzer with smoothing and confidence filtering.**

- [ ] **Step 4: Re-run the motion analyzer tests and confirm they pass.**

- [ ] **Step 5: Commit with `git commit -m "feat: analyze pose motion input"`.**

### Task 3: Chart And Game Engine TDD

**Files:**
- Create: `src/domain/chart.test.ts`
- Create: `src/domain/chart.ts`
- Create: `src/domain/gameEngine.test.ts`
- Create: `src/domain/gameEngine.ts`

- [ ] **Step 1: Write chart tests for active target/obstacle windows and sorted built-in events.**

- [ ] **Step 2: Run chart tests and confirm they fail because the module is missing.**

- [ ] **Step 3: Implement chart helpers and a short built-in song chart.**

- [ ] **Step 4: Write game engine tests for matching-hand hits, direction bonus, missed targets, obstacle collisions, and tracking-loss soft pause.**

- [ ] **Step 5: Run game engine tests and confirm they fail because the module is missing.**

- [ ] **Step 6: Implement the pure game engine.**

- [ ] **Step 7: Run all domain tests and confirm they pass.**

- [ ] **Step 8: Commit with `git commit -m "feat: add chart and scoring engine"`.**

### Task 4: Browser Infrastructure

**Files:**
- Create: `src/infrastructure/cameraPose.ts`
- Create: `src/infrastructure/audioClock.ts`

- [ ] **Step 1: Implement camera permission flow with `facingMode: "user"`, MediaPipe loading, pose callbacks, and simulated fallback when the camera/model is unavailable.**

- [ ] **Step 2: Implement an audio clock that uses a generated Web Audio tone pattern when no song file is available.**

- [ ] **Step 3: Run `npm run typecheck` and `npm test -- --run`.**

- [ ] **Step 4: Commit with `git commit -m "feat: add camera pose and audio infrastructure"`.**

### Task 5: Three.js Renderer And Debug Overlay

**Files:**
- Create: `src/rendering/GameRenderer.ts`
- Create: `src/rendering/DebugOverlay.ts`

- [ ] **Step 1: Implement the Three.js scene with neon tunnel, targets, obstacle walls, energy hands, lighting, particles, and resize handling.**

- [ ] **Step 2: Implement the debug overlay with mirrored video, skeleton lines, keypoints, hand trails, body center, hit-zone guide, FPS, and confidence metrics.**

- [ ] **Step 3: Run `npm run typecheck` and `npm test -- --run`.**

- [ ] **Step 4: Commit with `git commit -m "feat: render rhythm saber playfield"`.**

### Task 6: App Flow And UI

**Files:**
- Create: `src/app/App.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Wire boot, permission, model loading, calibration/debug, countdown, playing, tracking-lost pause, results, and error recovery screens.**

- [ ] **Step 2: Ensure formal play hides camera video and skeleton while calibration/debug shows them.**

- [ ] **Step 3: Add fullscreen, landscape guidance, quality mode, retry, recalibrate, pause/resume, and restart controls.**

- [ ] **Step 4: Run `npm run typecheck`, `npm test -- --run`, and `npm run build`.**

- [ ] **Step 5: Commit with `git commit -m "feat: build playable camera rhythm saber app"`.**

### Task 7: Runtime Verification

**Files:**
- Modify only if verification finds defects.

- [ ] **Step 1: Start the dev server with `npm run dev -- --host 127.0.0.1`.**

- [ ] **Step 2: Open the app in a browser and verify a nonblank Three.js scene renders.**

- [ ] **Step 3: Verify calibration/debug mode can show simulated pose data without a real camera, and formal play hides skeleton/camera layers.**

- [ ] **Step 4: Verify build output succeeds and the app reports recoverable camera/model errors.**

- [ ] **Step 5: Commit any verification fixes with a focused message.**

## Self-Review

- Spec coverage: all spec goals map to tasks 2-7. Non-goals are preserved by keeping a single local H5 page and one built-in chart.
- Placeholder scan: no TBD/TODO placeholders remain in this plan.
- Type consistency: domain types are introduced before browser modules consume them.
