import { useState } from "react";
import { usePeer } from "../hooks/usePeer";
import { useAi } from "../hooks/useAi";
import { DEFAULT_CAMPAIGN_NOTE_SECTION_NAMES } from "../constants/campaignNotes";
import CampaignNotesAiGenerator from "./campaign-notes/CampaignNotesAiGenerator";
import CampaignNoteItemRow from "./campaign-notes/CampaignNoteItemRow";
import CampaignNoteRow from "./campaign-notes/CampaignNoteRow";

function generateSectionId() {
  return `note-${Math.random().toString(36).slice(2, 10)}`;
}

// GM-only campaign-prep page: freeform named sections, each a list of
// freeform entries. Deliberately local-only (see PeerProvider.jsx) - no
// player ever sees this, so every handler below just commits straight to
// local state, no sendToPeers. Edits are granular/immediate (add/rename/
// delete a section or item applies right away), mirroring
// CharacterSheet.jsx's CRUD handlers rather than Scenario.jsx's
// draft-then-Save flow.
export default function CampaignNotes() {
  const { campaignNotes, setCampaignNotes, scenario } = usePeer();
  const { aiEnabled } = useAi();
  const [newSectionName, setNewSectionName] = useState("");

  const addSection = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const section = { id: generateSectionId(), name: trimmed, items: [] };
    setCampaignNotes((prev) => [...prev, section]);
  };

  const acceptAiSection = ({ name, items }) => {
    const section = {
      id: generateSectionId(),
      name,
      items: items
        .filter((item) => item.text.trim())
        .map((item) => ({
          text: item.text,
          description: item.description || "",
        })),
    };
    setCampaignNotes((prev) => [...prev, section]);
  };

  const renameSection = (id, name) => {
    setCampaignNotes((prev) =>
      prev.map((section) => (section.id === id ? { ...section, name } : section))
    );
  };

  const deleteSection = (id) => {
    setCampaignNotes((prev) => prev.filter((section) => section.id !== id));
  };

  const addItem = (sectionId) => {
    setCampaignNotes((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, { text: "", description: "" }] }
          : section
      )
    );
  };

  const updateItem = (sectionId, itemIndex, patch) => {
    setCampaignNotes((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item, i) =>
                i === itemIndex ? { ...item, ...patch } : item
              ),
            }
          : section
      )
    );
  };

  const removeItem = (sectionId, itemIndex) => {
    setCampaignNotes((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, items: section.items.filter((_, i) => i !== itemIndex) }
          : section
      )
    );
  };

  return (
    <div className="campaign-notes">
      <h2>Campaign Notes</h2>
      <p>
        Track whatever this campaign needs - items, monster types,
        locations, win scenarios, or anything else. Only you can see this
        tab.
      </p>

      {aiEnabled && (
        <CampaignNotesAiGenerator
          scenario={scenario}
          onAcceptSection={acceptAiSection}
        />
      )}

      {(campaignNotes || []).length === 0 && (
        <div className="campaign-notes-empty-state">
          <p>Start with a common section, or add your own below:</p>
          <div className="campaign-notes-quick-add">
            {DEFAULT_CAMPAIGN_NOTE_SECTION_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                className="btn-secondary"
                onClick={() => addSection(name)}
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {(campaignNotes || []).map((section) => (
        <CampaignNoteRow
          key={section.id}
          className="campaign-notes-section"
          title={section.name}
          titlePlaceholder="Section name"
          onTitleChange={(name) => renameSection(section.id, name)}
          onDelete={() => deleteSection(section.id)}
          deleteAriaLabel="Delete section"
          editAriaLabel="Edit section name"
          defaultExpanded
        >
          {section.items.map((item, itemIndex) => (
            <CampaignNoteItemRow
              key={itemIndex}
              item={item}
              textPlaceholder={`Item ${itemIndex + 1}`}
              onTextChange={(text) =>
                updateItem(section.id, itemIndex, { text })
              }
              onDescriptionChange={(description) =>
                updateItem(section.id, itemIndex, { description })
              }
              onRemove={() => removeItem(section.id, itemIndex)}
            />
          ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => addItem(section.id)}
          >
            Add Item
          </button>
        </CampaignNoteRow>
      ))}

      <div className="campaign-notes-add-section">
        <input
          type="text"
          className="pregame-input"
          placeholder="New section name"
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            addSection(newSectionName);
            setNewSectionName("");
          }}
          disabled={!newSectionName.trim()}
        >
          Add Section
        </button>
      </div>
    </div>
  );
}
