# Example scenario reference: "Beneath a Metal Sky"

Source: _Beneath a Metal Sky_, an official example Dread scenario.
<https://www.tiltingatwindmills.net/wp-content/uploads/2014/10/metal-sky-intro.pdf>

Used here as a concrete example of what a real, published scenario + set of
character questionnaires actually looks like, to check this app's
`Scenario` and `CharacterSheet` components against real practice rather than
assumption.

## Scenario structure

A sci-fi horror one-shot: a crew docks with a derelict, minimal-power space
hulk and finds it infested by symbiote-possessed former crew. Structured as:

- **Premise** — one-paragraph hook.
- **Deception** — the twist the host should conceal from players at first (here: "it's not one lone madman, it's a hive of symbiotes").
- **The Beginning** — how the session opens.
- **Location** — physical layout/setting details the host needs on hand.
- **Important Characters** — key NPCs (here: a stranded survivor, and "the creatures").
- **Act I / Act II / Act III** — a beat-by-beat outline, each beat naming _when a pull is called for and why_ (e.g. "this will necessitate a pull on the part of the pilot," "the characters should each pull to keep from being injured," "give them a fight, make them pull a few times").

The app's `Scenario` component (`title`, `description`, `setting`,
`characters`, `goals`, `threats`, `rules` fields) covers a reasonable subset
of this shape (premise/description ≈ Premise, setting ≈ Location, threats ≈
the antagonist writeup) but has no place for act-by-act beats or explicit
"pull here" call-outs — that level of detail is left entirely to host
improvisation during play in this app, which is fine (scenario-writing
structure isn't a _rule_, just GM craft advice) but worth knowing when
comparing feature scope.

## Character questionnaires — the important part for compliance

The scenario ships **6 distinct questionnaires**, one per character role
(technician, captain, medic, navigator, non-human crew member, researcher).
Each is genuinely unique to that character, not a shared template:

| Character      | Question count | Sample question themes                                                                                                                                                                                                                                                   |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Technician | 11             | Left someone behind, drive specialty, cybernetic prosthetic, stimulant addiction, sister's death, family, worst stim-related decision, childhood fear, filth threshold, funding source, **name**                                                                         |
| 2 — Captain    | 11             | Management style, ship's namesake, what they saved from their last ship, academy class, disliked food, phobia, cybernetic replacement, hidden past, envy of another character, quarters decor, why they're here, **name**                                                |
| 3 — Medic      | 11             | Medical training, chain of command, a moral compromise, unique skill, strangest thing witnessed, chess rival, romantic interest, headache remedy, loneliest moment, mysterious possession, shady past, **name**                                                          |
| 4 — Navigator  | 11             | Why assigned to this ship, scar origin, age discomfort, family estrangement, smuggled contraband, loneliest moment, distrust of a crewmate, inventory duty, hobby, feared disease, last shore leave, **name**                                                            |
| 5 — Non-human  | 11             | Tell-tale non-human clue, self-perceived value to crew, stress-triggered habit, first pet's death, training gaps, hidden talent, how crewmates treat them, dream job, shame, "big month," how they got this assignment, **name**                                         |
| 6 — Researcher | 11             | Who recommended them, specialty's use to the ship, awakened psychic power, military discharge reason, hidden possession, pride, last vacation, a quarantine death they covered up, useful childhood lesson, recurring dream, shipmate annoyance, unusual hobby, **name** |

Every single questionnaire ends with **"What is your name?"** as the final
question — matching the quick reference's "don't forget to ask for the
character's name."

Observed pattern, consistent with the quick reference's guidance:

- Each questionnaire is built entirely around _that_ character's specific
  role, backstory hooks, and secrets — there is no overlap or shared
  question bank between characters.
- Every questionnaire mixes capability questions (specialty, training),
  flaw/weakness questions (addiction, phobia, shady past), relationship
  questions (family, romance, distrust of a crewmate), and at least one
  plot-hook question tying the character into _why they're on this ship at
  all_ — echoing "every character questionnaire must address why the
  character participates in the story."
- Question counts across the 6 examples cluster around **11**, not the
  quick reference's suggested baker's-dozen (13) — a reminder that the "13"
  figure is a starting suggestion, not a hard rule.
