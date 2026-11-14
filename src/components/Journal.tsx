import { Plus, ScrollText } from "lucide-react";
import type { AppWorkspace } from "../workspace";
import type { SaveWorkspace } from "./Characters";
import { Empty } from "./Empty";

export function Journal({
  workspace,
  save,
  noteId,
  setNoteId,
}: {
  workspace: AppWorkspace;
  save: SaveWorkspace;
  noteId: string;
  setNoteId: (id: string) => void;
}) {
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
                  campaign: "Без кампании",
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
      {workspace.notes.length === 0 ? (
        <section className="panel">
          <Empty
            title="Первая страница вашей истории"
            text="Создайте заметку сессии. Укажите название кампании или ваншота — записи с одинаковым названием будут собраны вместе."
          />
        </section>
      ) : (
        <div className="journal-grid">
          <aside className="panel note-list">
            {[...new Set(workspace.notes.map((n) => n.campaign))].map((c) => (
              <div key={c}>
                <div className="eyebrow">{c}</div>
                {workspace.notes
                  .filter((n) => n.campaign === c)
                  .map((n) => (
                    <button
                      key={n.id}
                      aria-pressed={activeNote?.id === n.id}
                      className={activeNote?.id === n.id ? "selected" : ""}
                      onClick={() => setNoteId(n.id)}
                    >
                      <ScrollText size={16} />
                      <span>
                        {n.title}
                        <small>
                          {new Intl.DateTimeFormat("ru", {
                            dateStyle: "medium",
                          }).format(new Date(n.date))}
                        </small>
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
                    if (e.target.value.trim())
                      void save((v) => ({
                        ...v,
                        notes: v.notes.map((n) =>
                          n.id === activeNote.id
                            ? { ...n, title: e.target.value.trim() }
                            : n,
                        ),
                      }));
                  }}
                />
              </label>
              <label>
                Кампания или ваншот
                <input
                  autoComplete="off"
                  maxLength={100}
                  defaultValue={activeNote.campaign}
                  onBlur={(e) => {
                    if (e.target.value.trim())
                      void save((v) => ({
                        ...v,
                        notes: v.notes.map((n) =>
                          n.id === activeNote.id
                            ? { ...n, campaign: e.target.value.trim() }
                            : n,
                        ),
                      }));
                  }}
                />
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
