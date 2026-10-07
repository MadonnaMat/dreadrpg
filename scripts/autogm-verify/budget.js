// Measures what each AutoGM model call costs against the tier's context
// window, using the real context builders on a mid-campaign game (notes at
// the 8x8 cap, four characters, a long summary). Run it after changing a
// prompt or a context builder - a call that does not fit simply fails, and
// the small tiers only have 4096 tokens.
//
//   ./node_modules/.bin/vite-node scripts/autogm-verify/budget.js
//
// vite-node rather than node: the app's sources use extensionless imports.
import {
  buildAutoGmTurnContext,
  buildAutoGmSelfCheckContext,
  buildAutoGmScenePacingContext,
  buildAutoGmPullCheckContext,
  buildAutoGmCampaignNotesConsolidationContext,
} from "../../src/ai/promptContexts.js";
import {
  selectRelevantCampaignNotes,
  buildRelevanceQuery,
} from "../../src/helpers/contextRelevance.js";
import { scopeNotesForConsolidation } from "../../src/helpers/campaignNotes.js";
import { latest } from "../../src/prompts/index.js";
import { autoGmTurnSchema } from "../../src/ai/schemas/autoGmTurnSchema.js";

const tok = (s) => Math.round(String(s || "").length / 4);
const scenario = {
  title: "The Foundry",
  description:
    "A decommissioned iron foundry on the edge of town. The night watchman stopped answering his radio three days ago and nobody official seems interested in finding out why.",
  setting:
    "Rust belt, late autumn, after dark. No power to the building, rain on the roof, and the only light is what you brought.",
  characters:
    "Urban explorers who talked each other into coming, each with a reason to want the others to think well of them.",
  goals:
    "Find out what happened to the night watchman and get back out through the fence before dawn.",
  threats:
    "Something still moves in the casting hall when the lights go out. The sub-level is flooded and the pumps have no power.",
  rules:
    "Pulls are called for forcing, climbing, or anything done under pressure.",
};
const characters = Object.fromEntries(
  ["The Drifter", "The Archivist", "The Electrician", "The Nurse"].map(
    (n, i) => [
      `c${i}`,
      { name: n, assignedTo: ["Alice", "Bob", "Cara", "Dan"][i], alive: true },
    ]
  )
);
const presence = Object.fromEntries(
  ["Alice", "Bob", "Cara", "Dan"].map((n) => [n, { connected: true }])
);
const mk = (t, d, e = {}) => ({
  text: t,
  description: d,
  seenBy: [],
  takenBy: null,
  pinned: false,
  pinnedSource: null,
  ...e,
});
const campaignNotes = Array.from({ length: 8 }, (_, s) => ({
  id: `n${s}`,
  name: `Section ${s}`,
  items: Array.from({ length: 8 }, (_, i) =>
    mk(
      `Item ${s}-${i}`,
      "A reasonably detailed description of this thing, where it sits and why it matters to the scene.",
      i === 0 && s === 0 ? { pinned: true, pinnedSource: "gm" } : {}
    )
  ),
}));
const storySummary =
  "The group cut through the loading yard fence after dark and reached the casting hall. ".repeat(
    6
  );
const rawHistory = Array.from({ length: 20 }, (_, i) => ({
  from: ["Alice", "Bob", "GM"][i % 3],
  text: "A fairly typical line of table chat that runs about this long in practice.",
}));
const trigger = {
  fromIdentity: "Alice",
  text: "I pry open the hatch over the sub-level and look down.",
};

const notes = selectRelevantCampaignNotes({
  campaignNotes,
  query: buildRelevanceQuery({ trigger, rawHistory }),
});
const base = {
  scenario,
  characters,
  storySummary,
  rawHistory,
  dangerProbability: 0.42,
  awaitingReset: false,
  designatedSpinner: null,
  presence,
  pullJustCalled: null,
};

const turnUser = buildAutoGmTurnContext({ ...base, campaignNotes: notes });
const turnSys = latest("autogmTurn").text;
const schemaTok = tok(JSON.stringify(autoGmTurnSchema));

console.log("TURN CALL (budget 4096)");
console.log(`  system prompt        ~${tok(turnSys)}`);
console.log(`  user context         ~${tok(turnUser)}`);
console.log(`  json schema grammar  ~${schemaTok}`);
console.log(
  `  = input              ~${tok(turnSys) + tok(turnUser) + schemaTok}   leaves ~${4096 - tok(turnSys) - tok(turnUser) - schemaTok} to generate\n`
);

// Which blocks dominate the user context?
const blocks = {
  scenario: buildAutoGmTurnContext({
    ...base,
    campaignNotes: [],
    storySummary: "",
    rawHistory: [],
    characters: {},
  }),
  "+roster": buildAutoGmTurnContext({
    ...base,
    campaignNotes: [],
    storySummary: "",
    rawHistory: [],
  }),
  "+notes(filtered)": buildAutoGmTurnContext({
    ...base,
    campaignNotes: notes,
    storySummary: "",
    rawHistory: [],
  }),
  "+summary": buildAutoGmTurnContext({
    ...base,
    campaignNotes: notes,
    rawHistory: [],
  }),
  "+history(20)": turnUser,
};
let prev = 0;
console.log("  user-context blocks, cumulative:");
for (const [k, v] of Object.entries(blocks)) {
  console.log(`    ${k.padEnd(20)} ~${tok(v)}  (+${tok(v) - prev})`);
  prev = tok(v);
}

const unfilteredUser = buildAutoGmTurnContext({ ...base, campaignNotes });
console.log(
  `\n  notes unfiltered would be ~${tok(unfilteredUser)} user tokens (filtering saves ~${tok(unfilteredUser) - tok(turnUser)})`
);

console.log("\nOTHER CALLS IN A TURN");
for (const [name, sys, user] of [
  [
    "pull-check",
    latest("autogmPullCheck").text,
    buildAutoGmPullCheckContext({
      actionText: trigger.text,
      actorName: "The Drifter",
      scenario,
    }),
  ],
  [
    "scene-pacing",
    latest("autogmScenePacing").text,
    buildAutoGmScenePacingContext({
      storySummary,
      rawHistory,
      dangerProbability: 0.42,
      awaitingReset: false,
    }),
  ],
  [
    "self-check",
    latest("autogmSelfCheck").text,
    buildAutoGmSelfCheckContext({
      draftNarration: "The hatch gives way.",
      storySummary,
      rawHistory,
      campaignNotes,
      detailedNotes: notes,
      characters,
      dangerProbability: 0.42,
      awaitingReset: false,
    }),
  ],
  [
    "notes-consolidation",
    latest("autogmCampaignNotesConsolidation").text,
    buildAutoGmCampaignNotesConsolidationContext({
      campaignNotes: scopeNotesForConsolidation(campaignNotes, [
        { sectionName: "Section 0" },
      ]).scoped,
      campaignNoteUpdates: [
        {
          sectionName: "Items",
          itemText: "Hatch",
          description: "",
          seenByCharacter: "",
          takenByCharacter: "",
        },
      ],
    }),
  ],
])
  console.log(
    `  ${name.padEnd(21)} sys ~${String(tok(sys)).padStart(4)} + user ~${String(tok(user)).padStart(4)} = ~${tok(sys) + tok(user)}${tok(sys) + tok(user) > 4096 ? "   <-- OVER BUDGET" : ""}`
  );
