# Campaign notes generation

You are helping a Game Master prepare a campaign-tracking page for a
one-shot horror scenario in the Dread tabletop RPG. This page is made of
named sections, each holding a short list of entries the GM wants to keep
track of during play.

Given the scenario context (and optionally some extra direction from the
GM), draft a starter set of sections as a single JSON array. Each array
element is an object with exactly these fields:

- "name": a short section title.
- "items": an array of 3-8 entry objects for that section. Each entry
  object has exactly these fields:
  - "text": a short label for the entry, drawn from specifics in the
    scenario (names, places, objects, threats), never a generic
    placeholder like "Item 1" or "A monster".
  - "description": one or two sentences of concrete, usable detail about
    that entry. This field is REQUIRED for every single entry, with no
    exceptions - never leave it blank, and never just restate "text" in
    different words.

The kind of detail "description" needs depends on the section, and you MUST
follow these rules exactly - do not skip any of them:

- Every entry in "Monster Types" MUST state, explicitly, how the group can
  defeat, escape, contain, or otherwise neutralize that threat (its
  weakness, a required tool/ritual/condition, or an escape method) - a
  description that only describes what the monster is or does, without
  saying how to survive it, is incomplete and not acceptable. Also mention
  where it's typically encountered when the scenario supports that.
  Example of an acceptable entry:
  `{"text": "The Drowned Sailor", "description": "Haunts the flooded cargo hold at night. Vulnerable to fire - a lit flare or torch drives it off. Cannot cross the salt line painted around the captain's quarters."}`
- Every entry in "Items" MUST state where it's located or how it's found,
  and why it matters.
- Every entry in "Locations" MUST state what it connects to (other
  locations, routes, hazards) and what's notable about it.
- For "Win Scenarios" and any other section, "description" should still be
  the concrete, table-usable detail that actually helps the GM run it (the
  specific steps to win, who an NPC is and what they want, what a clue
  reveals, etc).

Always include these four sections when the scenario gives you anything to
populate them with:

- "Items" - notable objects, tools, or evidence that matter to the story.
- "Monster Types" - the antagonist(s)/threat(s) and their traits, weaknesses,
  or tells.
- "Locations" - key places the scenario visits or could visit.
- "Win Scenarios" - the concrete ways the group could survive or "win" this
  one-shot.

Beyond those four, add any extra sections the scenario specifically calls
for (for example "Cult Members", "Clues", "NPCs", "Timeline") when the
scenario's content supports them - don't force sections that don't fit.

Before responding, check every "Monster Types" entry specifically: if any
of them doesn't say how to beat, escape, or stop it, rewrite it so it does.

Respond with ONLY the JSON array - no markdown fences, no commentary before
or after it.
