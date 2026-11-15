import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { campaignLabel, makeCampaign, type Campaign } from "../campaign";
import { saveCampaign, type AppWorkspace } from "../workspace";
import type { SaveWorkspace } from "./Characters";

export function Campaigns({
  workspace,
  save,
  onDirty,
}: {
  workspace: AppWorkspace;
  save: SaveWorkspace;
  onDirty: (dirty: boolean) => void;
}) {
  const [editing, setEditing] = useState<{
    initial: Campaign;
    existing: boolean;
  } | null>(null);
  return (
    <section className="panel campaigns" aria-labelledby="campaigns-title">
      <div className="campaign-heading">
        <h2 id="campaigns-title">Кампании и ваншоты</h2>
        {!editing && (
          <button
            onClick={() =>
              setEditing({
                initial: makeCampaign(crypto.randomUUID(), ""),
                existing: false,
              })
            }
          >
            <Plus size={16} /> Новая кампания
          </button>
        )}
      </div>
      {editing ? (
        <CampaignEditor
          key={editing.initial.id}
          initial={editing.initial}
          existing={editing.existing}
          save={save}
          onDirty={onDirty}
          onClose={() => setEditing(null)}
        />
      ) : (
        <>
          <p className="hint">
            Профиль хранит договорённости о правилах. Выберите кампанию, чтобы
            изменить название и настройки.
          </p>
          <div className="campaign-list">
            {workspace.campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() =>
                  setEditing({ initial: campaign, existing: true })
                }
              >
                {campaignLabel(campaign, workspace.campaigns)}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CampaignEditor({
  initial,
  existing,
  save,
  onDirty,
  onClose,
}: {
  initial: Campaign;
  existing: boolean;
  save: SaveWorkspace;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(initial) !== JSON.stringify(value);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  return (
    <form
      className="campaign-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !value.name.trim()) return;
        setPending(true);
        void save(
          (s) =>
            saveCampaign(
              s,
              { ...value, name: value.name.trim() },
              existing ? initial : undefined,
            ),
          "Профиль кампании сохранён",
        ).then((ok) => {
          setPending(false);
          if (ok) {
            onDirty(false);
            onClose();
          }
        });
      }}
    >
      <fieldset disabled={pending}>
        <legend>
          {existing ? "Редактирование кампании" : "Новая кампания"}
        </legend>
        <div className="campaign-fields">
          <label>
            Название кампании
            <input
              autoFocus
              required
              maxLength={100}
              value={value.name}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
            />
          </label>
          <label>
            Тип приключения
            <select
              value={value.kind}
              onChange={(e) =>
                setValue({ ...value, kind: e.target.value as Campaign["kind"] })
              }
            >
              <option value="campaign">Кампания</option>
              <option value="one-shot">Ваншот</option>
            </select>
          </label>
        </div>
        <label>
          Описание кампании
          <textarea
            rows={3}
            maxLength={10000}
            value={value.description}
            onChange={(e) =>
              setValue({ ...value, description: e.target.value })
            }
          />
        </label>
        <p>
          Редакция правил: <strong>D&D 2014</strong>
        </p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.rules.extraFeat}
            onChange={(e) =>
              setValue({
                ...value,
                rules: { ...value.rules, extraFeat: e.target.checked },
              })
            }
          />
          Одна дополнительная черта от мастера
        </label>
        <fieldset>
          <legend>Разрешённые источники</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={value.rules.sources.official2014}
              onChange={(e) =>
                setValue({
                  ...value,
                  rules: {
                    ...value.rules,
                    sources: {
                      ...value.rules.sources,
                      official2014: e.target.checked,
                    },
                  },
                })
              }
            />
            Официальные материалы, совместимые с 2014
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={value.rules.sources.homebrew}
              onChange={(e) =>
                setValue({
                  ...value,
                  rules: {
                    ...value.rules,
                    sources: {
                      ...value.rules.sources,
                      homebrew: e.target.checked,
                    },
                  },
                })
              }
            />
            Homebrew
          </label>
          <label>
            Уточнения по источникам
            <textarea
              rows={3}
              maxLength={10000}
              value={value.rules.sourceNotes}
              placeholder="Разрешённые книги, авторы, версии и исключения мастера…"
              onChange={(e) =>
                setValue({
                  ...value,
                  rules: { ...value.rules, sourceNotes: e.target.value },
                })
              }
            />
          </label>
        </fieldset>
        <p className="hint">
          Настройки применяются к основе сборки связанных черновиков:
          официальные материалы 2014 и дополнительная черта мастера. Выбор книг
          из каталога и полная проверка персонажа ещё впереди.
        </p>
        <div className="card-actions">
          <button
            className="primary"
            type="submit"
            disabled={!value.name.trim()}
          >
            <Save size={16} /> Сохранить кампанию
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                !dirty ||
                confirm("Отменить несохранённые изменения кампании?")
              )
                onClose();
            }}
          >
            Отмена
          </button>
        </div>
      </fieldset>
    </form>
  );
}
