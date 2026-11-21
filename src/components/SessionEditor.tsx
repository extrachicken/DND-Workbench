import { useEffect, useState } from "react";
import { campaignLabel, type Campaign } from "../campaign";
import {
  saveSessionNote,
  sessionNoteConflicts,
  type SessionNote,
} from "../workspace";
import type { SaveWorkspace } from "./Characters";

export function SessionEditor({
  initial,
  current,
  campaigns,
  save,
  onDirty,
  onOpen,
}: {
  initial: SessionNote;
  current?: SessionNote;
  campaigns: Campaign[];
  save: SaveWorkspace;
  onDirty: (value: boolean) => void;
  onOpen: (note: SessionNote) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [pending, setPending] = useState<"autosave" | "copy" | null>(null);
  const saving = pending !== null;
  const [failed, setFailed] = useState(false);
  const dirty =
    draft.text !== baseline.text ||
    draft.title !== baseline.title ||
    draft.campaignId !== baseline.campaignId;
  useEffect(() => {
    onDirty(dirty || saving);
    return () => onDirty(false);
  }, [dirty, saving, onDirty]);

  // Only one write runs at a time. Input arriving during that write is
  // compared to its acknowledged baseline on the next pass.
  useEffect(() => {
    if (!dirty || saving || failed || !draft.title.trim()) return;
    const timer = window.setTimeout(async () => {
      setPending("autosave");
      const ok = await save((s) => saveSessionNote(s, baseline, draft));
      if (ok) setBaseline(draft);
      else setFailed(true);
      setPending(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, baseline, dirty, saving, failed, save]);

  const conflict = sessionNoteConflicts(current, baseline, draft);
  async function saveCopy() {
    const note = {
      ...draft,
      id: crypto.randomUUID(),
      title: draft.title.trim().slice(0, 140) + " (вариант)",
      campaignId: campaigns.some((c) => c.id === draft.campaignId)
        ? draft.campaignId
        : null,
    };
    setPending("copy");
    const ok = await save(
      (s) => ({ ...s, notes: [note, ...s.notes] }),
      "Отдельная запись сохранена",
    );
    setPending(null);
    if (ok) onOpen(note);
  }
  return (
    <section className="panel note-editor">
      <h2>Запись сессии</h2>
      <label>
        Название
        <input
          autoComplete="off"
          maxLength={150}
          required
          disabled={pending === "copy"}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label>
        Кампания или ваншот
        <select
          disabled={pending === "copy"}
          value={draft.campaignId ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, campaignId: e.target.value || null })
          }
        >
          <option value="">Без кампании</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {campaignLabel(c, campaigns)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Что произошло
        <textarea
          rows={15}
          maxLength={30000}
          disabled={pending === "copy"}
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          placeholder="События, встречи, добыча, планы на следующую сессию…"
        />
      </label>
      <p className="hint">
        {!draft.title.trim()
          ? "Введите название для сохранения записи."
          : dirty
            ? "Есть несохранённые изменения"
            : "Изменения сохраняются автоматически."}
      </p>
      {failed &&
        (conflict ? (
          <div className="notice">
            <h3>Сохранённый вариант</h3>
            {current ? (
              <>
                <p>
                  {current.title} ·{" "}
                  {campaigns.find((c) => c.id === current.campaignId)?.name ??
                    "Без кампании"}
                </p>
                <label>
                  Сохранённый текст
                  <textarea readOnly rows={5} value={current.text} />
                </label>
              </>
            ) : (
              <p>Исходная запись удалена или заменена при импорте.</p>
            )}
            <p>
              Ваш текст остаётся в редакторе. Вы можете сохранить его отдельной
              записью.
            </p>
            <div className="actions">
              <button
                disabled={saving || !draft.title.trim()}
                onClick={() => void saveCopy()}
              >
                Сохранить отдельной записью
              </button>
              {current && (
                <button
                  disabled={saving}
                  onClick={() => {
                    if (
                      confirm("Заменить текст редактора сохранённым вариантом?")
                    ) {
                      setDraft(current);
                      setBaseline(current);
                      setFailed(false);
                    }
                  }}
                >
                  Принять сохранённый вариант
                </button>
              )}
            </div>
          </div>
        ) : (
          <button disabled={saving} onClick={() => setFailed(false)}>
            Повторить сохранение
          </button>
        ))}
    </section>
  );
}
