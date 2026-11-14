import { useMemo } from "react";
import { Plus, ScrollText } from "lucide-react";
import type { AppWorkspace } from "../workspace";
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
  const activeNote =
    workspace.notes.find((n) => n.id === noteId) || workspace.notes[0];
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
            const id = crypto.randomUUID();
            void save((v) => ({
              ...v,
              notes: [
                {
                  id,
                  title: `Сессия ${v.notes.length + 1}`,
                  campaignId: activeNote?.campaignId ?? null,
                  date: new Date().toISOString(),
                  text: "",
                },
                ...v.notes,
              ],
            })).then((ok) => {
              if (ok) setNoteId(id);
            });
          }}
        >
          <Plus size={16} />
          Новая сессия
        </button>
      </div>
      <Campaigns workspace={workspace} save={save} onDirty={onDirty} />
      {workspace.notes.length === 0 ? (
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
                    onClick={() => setNoteId(n.id)}
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
          {activeNote && (
            <section className="panel note-editor" key={activeNote.id}>
              <div className="eyebrow">ЗАПИСЬ СЕССИИ</div>
              <label>
                Название
                <input
                  autoComplete="off"
                  maxLength={150}
                  defaultValue={activeNote.title}
                  onBlur={(e) => {
                    const text = e.target.value.trim();
                    if (text)
                      void save((v) => ({
                        ...v,
                        notes: v.notes.map((n) =>
                          n.id === activeNote.id ? { ...n, title: text } : n,
                        ),
                      }));
                  }}
                />
              </label>
              <label>
                Кампания или ваншот
                <select
                  value={activeNote.campaignId ?? ""}
                  onChange={(e) => {
                    const campaignId = e.target.value || null;
                    void save((v) => ({
                      ...v,
                      notes: v.notes.map((n) =>
                        n.id === activeNote.id ? { ...n, campaignId } : n,
                      ),
                    }));
                  }}
                >
                  <option value="">Без кампании</option>
                  {workspace.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaignLabel(campaign, workspace.campaigns)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Что произошло
                <textarea
                  rows={15}
                  maxLength={30000}
                  defaultValue={activeNote.text}
                  placeholder="События, встречи, добыча, планы на следующую сессию…"
                  onChange={(e) => {
                    const text = e.target.value;
                    void save((v) => ({
                      ...v,
                      notes: v.notes.map((n) =>
                        n.id === activeNote.id ? { ...n, text } : n,
                      ),
                    }));
                  }}
                />
              </label>
              <p className="hint">
                Текст сохраняется автоматически; названия — при выходе из поля.
              </p>
            </section>
          )}
        </div>
      )}
    </>
  );
}
