import { useEffect, useMemo, useState } from "react";
import { Plus, ScrollText } from "lucide-react";
import { SessionEditor } from "./SessionEditor";
import type { AppWorkspace, SessionNote } from "../workspace";
import type { SaveWorkspace } from "./Characters";
import { Campaigns } from "./Campaigns";
import { campaignLabel } from "../campaign";
import { Empty } from "./Empty";

const noteDate = new Intl.DateTimeFormat("ru", { dateStyle: "medium" });

export function Journal({
  workspace,
  save,
  noteId,
  setNoteId,
  onDirty,
}: {
  workspace: AppWorkspace;
  save: SaveWorkspace;
  noteId: string;
  setNoteId: (id: string) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const groups = useMemo(() => {
    const result = new Map<string | null, AppWorkspace["notes"]>();
    for (const note of workspace.notes) {
      const group = result.get(note.campaignId);
      if (group) group.push(note);
      else result.set(note.campaignId, [note]);
    }
    return [...result.entries()];
  }, [workspace.notes]);
  const [opened, setOpened] = useState<SessionNote | null>(
    () =>
      workspace.notes.find((n) => n.id === noteId) ??
      workspace.notes[0] ??
      null,
  );
  const [campaignDirty, setCampaignDirty] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  useEffect(() => {
    onDirty(noteDirty || campaignDirty);
    return () => onDirty(false);
  }, [noteDirty, campaignDirty, onDirty]);
  const activeNote = workspace.notes.find((n) => n.id === opened?.id);
  useEffect(() => {
    if (!opened && workspace.notes[0]) setOpened(workspace.notes[0]);
  }, [opened, workspace.notes]);
  function openNote(note: SessionNote) {
    setOpened(note);
    setNoteId(note.id);
  }
  function canLeaveNote() {
    return (
      !noteDirty || confirm("Оставить изменения этой записи без сохранения?")
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">НИ ОДНА ЗАЦЕПКА НЕ ПОТЕРЯЕТСЯ</div>
          <h1>Журнал приключений</h1>
        </div>
        <button
          className="primary"
          onClick={() => {
            if (!canLeaveNote()) return;
            let created: SessionNote;
            void save((v) => {
              created = {
                id: crypto.randomUUID(),
                title: `Сессия ${v.notes.length + 1}`,
                campaignId: activeNote?.campaignId ?? null,
                date: new Date().toISOString(),
                text: "",
              };
              return { ...v, notes: [created, ...v.notes] };
            }, "Сессия создана").then((ok) => {
              if (ok) openNote(created);
            });
          }}
        >
          <Plus size={16} />
          Новая сессия
        </button>
      </div>
      <Campaigns workspace={workspace} save={save} onDirty={setCampaignDirty} />
      {!opened && workspace.notes.length === 0 ? (
        <section className="panel">
          <Empty
            title="Первая страница вашей истории"
            text="Создайте заметку сессии и выберите её кампанию или ваншот. Можно вести записи и без кампании."
          />
        </section>
      ) : (
        <div className="journal-grid">
          <aside className="panel note-list">
            {groups.map(([c, notes]) => (
              <div key={JSON.stringify(c)}>
                <div className="eyebrow">
                  {c === null
                    ? "Без кампании"
                    : campaignLabel(
                        workspace.campaigns.find(
                          (campaign) => campaign.id === c,
                        )!,
                        workspace.campaigns,
                      )}
                </div>
                {notes.map((n) => (
                  <button
                    key={n.id}
                    aria-pressed={activeNote?.id === n.id}
                    className={activeNote?.id === n.id ? "selected" : ""}
                    onClick={() => {
                      if (n.id !== opened?.id && canLeaveNote()) openNote(n);
                    }}
                  >
                    <ScrollText size={16} />
                    <span>
                      {n.title}
                      <small>{noteDate.format(new Date(n.date))}</small>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </aside>
          {opened && (
            <SessionEditor
              key={opened.id}
              initial={opened}
              current={activeNote}
              campaigns={workspace.campaigns}
              save={save}
              onDirty={setNoteDirty}
              onOpen={openNote}
            />
          )}
        </div>
      )}
    </>
  );
}
