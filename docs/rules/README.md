# Dread RPG rules reference

This folder is a reference for the _actual, published_ rules of the tabletop
horror RPG **Dread**, so the dreadrpg app's game-mechanic code (the wheel,
character questionnaires, GM/host responsibilities) can be checked against
something concrete instead of guesswork or half-remembered summaries.

**Check this folder before changing any game-mechanic code** — the wheel
(`src/providers/WheelProvider.jsx`, `src/helpers/index.js`,
`src/components/WheelGraphics.jsx`), character sheets/questionnaires
(`src/components/CharacterSheet.jsx` and `src/components/character-sheet/`),
or anything touching character removal, spins, or GM controls.

## Sources

- **Dread Quick Reference** (© 2004 The Impossible Dream) —
  <https://www.tiltingatwindmills.net/wp-content/uploads/2014/10/dread_quickstart_letter.pdf>
  — the official quickstart rules. Summarized/paraphrased in
  [`quick-reference.md`](./quick-reference.md).
- **"Beneath a Metal Sky"** —
  <https://www.tiltingatwindmills.net/wp-content/uploads/2014/10/metal-sky-intro.pdf>
  — an official example scenario with 6 example character questionnaires.
  Summarized in [`example-scenario-metal-sky.md`](./example-scenario-metal-sky.md).

Both are copyrighted works published by The Impossible Dream / Tiltingatwindmills.net.
The notes here are paraphrased for internal engineering reference (checking
this app's mechanics against the real game) — they are not a republication of
the rulebook, and app-facing UI text should not copy the rulebook's own
flavor text verbatim (see the compliance doc's note on "Ways to Remove a
Character"). For the full rules, buy them at
<https://www.tiltingatwindmills.net/>.

## Files in this folder

| File                                                               | Purpose                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`quick-reference.md`](./quick-reference.md)                       | The core rules: pulling, character removal, questionnaires, GM responsibilities.                                                                                                                        |
| [`example-scenario-metal-sky.md`](./example-scenario-metal-sky.md) | What a real scenario + real per-character questionnaires look like in practice.                                                                                                                         |
| [`dreadrpg-app-compliance.md`](./dreadrpg-app-compliance.md)       | The actual audit: how this app's code maps to (or deviates from) the rules above, with file references and verdicts. **Start here** if you just want the answer to "does the app match the real rules?" |
