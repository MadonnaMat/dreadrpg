# AutoGM verification harness

Drives a real AutoGM session in a real browser, plus a token-budget
measurement that needs no browser at all. Both exist because the automated
suites deliberately can't cover this: the Vitest suite mocks `runPrompt`, so
it proves the pipeline wiring and nothing about what the model writes, and
the Playwright suite covers WebRTC only.

See `.claude/skills/verify-autogm/SKILL.md` for what to actually look for in
a run. This README is about getting one going.

## budget.js — no browser needed

```bash
./node_modules/.bin/vite-node scripts/autogm-verify/budget.js
```

Prints what every AutoGM call costs against the window, on a mid-campaign
game. **Run it after changing any prompt or context builder.** The SMALL
tier has 4096 tokens; a call that doesn't fit doesn't degrade, it fails.
`vite-node` rather than `node`, because the app's sources use extensionless
imports.

## run.js — drives a live session

### Why it isn't Playwright

Every model tier is a `q4f16_1` build, which needs WebGPU's `shader-f16`.
Headless Chromium has no `navigator.gpu` at all, and the WSL-side GPU has no
f16 - so this needs the host's own Chrome. Chrome binds its debugging port
to loopback and WSL can't reach Windows loopback, so the half that talks to
Chrome runs on Windows. Node 22+ has a global `WebSocket`, which is all CDP
needs, so `cdp.js` is a small client rather than a Playwright install.

On a machine where Playwright can reach a browser with `shader-f16`, none of
this applies and the suite is a better home.

### Setup (WSL + Windows Chrome)

```bash
npm run dev    # serves http://localhost:5173/dreadrpg/
```

Launch a **throwaway** Chrome profile with debugging on. A debugging port
gives full control of that browser, so don't point it at your real profile:

```powershell
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList @(
  "--remote-debugging-port=9222",
  "--user-data-dir=$env:TEMP\dreadrpg-verify-profile",
  "--no-first-run", "--no-default-browser-check",
  "--enable-unsafe-webgpu", "about:blank")
```

`--enable-unsafe-webgpu` is required; without it `requestAdapter()` returns
null even on a capable GPU. Windows must reach the dev server over
**`localhost`**, not the WSL IP - WebGPU needs a secure context, and the IP
isn't one.

Copy this directory somewhere Windows node can see it, then:

```powershell
node run.js gpu       # shaderF16 false => this machine cannot run AutoGM, stop here
node run.js ai        # opt in to SMALL and start loading
node run.js status    # poll until aiEnabled (first run downloads ~0.9GB)
node run.js setup     # scenario, notes with a pinned fact, a cast, AutoGM on
node run.js send "I force the hatch open."
node run.js stats     # per-turn pacing, context size, regenerations, failures
```

Keep each command short-running and poll `status`/`stats` yourself rather
than waiting inside a script - a turn is several model calls and a wait that
hangs tells you nothing.

### Gotchas

- Editing app source mid-session triggers HMR, which remounts the providers
  and wipes the game. Finish your edits, then set up.
- Editing while the page is open can leave Vite serving a stale optimized
  dependency; the symptom is a blank page or a failed dynamic import, and a
  reload fixes it.
- The chat input is disabled while AutoGM is mid-turn or a pull is pending,
  so `send` can fail with "no field with placeholder" - check `stats` and
  retry.
