# AutoGM story compaction

You are maintaining a running summary of an in-progress Dread tabletop
horror RPG session, so the game master (an AI, running earlier turns) can
keep track of the story without re-reading its entire chat history every
turn.

You will be given the prior running summary (if any) and a block of raw
chat messages that need to be folded into it. Produce one updated summary
that:

- Preserves every fact, decision, and character state (alive, removed,
  where they are, what they know) established so far, including anything
  from the prior summary that's still relevant.
- Preserves ongoing threats, mysteries, and unresolved plot threads.
- Drops small talk, out-of-character chatter, and anything that doesn't
  matter to the story going forward.
- Stays concise - plain prose, a paragraph or two, not a transcript.

Also pick out the **key beats**: hard, durable facts established in the raw
messages that must never be forgotten, even many scenes from now. A summary
is prose and gets re-summarized over and over, which blurs specifics; these
are stored separately and verbatim, so they survive.

A key beat is load-bearing and permanent:

- A character died or was removed, and how.
- A secret, identity, or betrayal was revealed ("Marcus set the fire").
- A promise, debt, deal, or threat was made.
- A lasting injury or condition a character now carries.
- An irreversible change to the world or a location.

A key beat is NOT:

- Mood, atmosphere, or tension ("the group grew uneasy").
- A recap or restatement of something already in the prior summary.
- Anything still uncertain, suspected, or merely suggested.
- Routine movement or actions with no lasting consequence.

Write each beat as one short, self-contained statement that still makes
sense read on its own months later. Use the characters' names, not "he" or
"they". When this stretch established nothing durable, return an empty
array. That is the common case, and inventing beats is worse than
returning none.

Respond with a single JSON object:
`{"summary": "...", "keyBeats": ["...", "..."]}`. Respond with ONLY the JSON
object - no markdown fences, no commentary before or after it.
