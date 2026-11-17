import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Feather,
  Plus,
  RotateCcw,
  Save,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ProgressionEditor } from "./ProgressionEditor";
import { previewProgression } from "../progression";
import type { Campaign } from "../campaign";
import {
  archiveCharacter,
  makeDraft,
  restoreCharacter,
  selectCharacter,
  saveDraftBuild,
  type AppWorkspace,
  type Character,
} from "../workspace";

export type SaveWorkspace = (
  update: (s: AppWorkspace) => AppWorkspace,
  message?: string,
) => Promise<boolean>;
export function Characters({
  workspace,
  save,
}: {
  workspace: AppWorkspace;
  save: SaveWorkspace;
}) {
  const [archived, setArchived] = useState(false);
  const characters = workspace.characters.filter(
    (c) => Boolean(c.archivedAt) === archived,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">КАЖДАЯ ИСТОРИЯ — ВАША</div>
          <h1>Персонажи</h1>
        </div>
        <a className="button primary create-link" href="#create">
          <Plus size={18} />
          <span className="wide-label">Создать персонажа</span>
          <span className="compact-label">Создать</span>
        </a>
      </div>
      <div className="sheet-tabs" role="group" aria-label="Список персонажей">
        <button
          aria-pressed={!archived}
          className={!archived ? "selected" : ""}
          onClick={() => setArchived(false)}
        >
          За столом · {workspace.characters.filter((c) => !c.archivedAt).length}
        </button>
        <button
          aria-pressed={archived}
          className={archived ? "selected" : ""}
          onClick={() => setArchived(true)}
        >
          Архив · {workspace.characters.filter((c) => c.archivedAt).length}
        </button>
      </div>
      {characters.length === 0 ? (
        <section className="panel empty">
          <Users size={36} />
          <h2>{archived ? "Архив пуст" : "Новая история ждёт"}</h2>
          <p>
            {archived
              ? "Архив сохраняет персонажей целиком. Их всегда можно вернуть к игре."
              : "Создайте персонажа или восстановите его из архива."}
          </p>
        </section>
      ) : (
        <div className="character-cards">
          {characters.map((c) => (
            <article
              className={`panel character-card ${c.id === workspace.activeCharacterId ? "is-active" : ""}`}
              key={c.id}
            >
              <div className="inline">
                <div className="avatar tiny">
                  {c.build.portrait ? (
                    <img src={c.build.portrait} width="42" height="48" alt="" />
                  ) : (
                    <Feather size={20} />
                  )}
                </div>
                <span className="tag">
                  {c.kind === "demo" ? "Учебная копия" : "Черновик"}
                </span>
                {c.id === workspace.activeCharacterId && (
                  <span className="active-label">Выбран</span>
                )}
              </div>
              <h2>{c.build.name}</h2>
              <p>
                {c.build.ancestry}
                <br />
                <span className="muted">{c.build.className}</span>
              </p>
              <p className="hint">
                {c.kind === "demo"
                  ? "Игровой лист для проверки интерфейса"
                  : c.build.progression
                    ? "Основа сборки сохранена. Полный игровой лист ещё впереди."
                    : "Образ и история. Можно добавить характеристики и уровни."}
              </p>
              <div className="card-actions">
                {archived ? (
                  <button
                    className="primary"
                    onClick={() =>
                      void save(
                        (s) => restoreCharacter(s, c.id),
                        "Персонаж восстановлен",
                      )
                    }
                  >
                    <RotateCcw size={16} />
                    Восстановить
                  </button>
                ) : (
                  <>
                    <button
                      className="primary"
                      onClick={() =>
                        void save(
                          (s) => selectCharacter(s, c.id),
                          "Персонаж выбран",
                        ).then((ok) => {
                          if (ok) location.hash = "character";
                        })
                      }
                    >
                      {c.kind === "draft" ? "Открыть черновик" : "Открыть лист"}
                      <ChevronRight size={16} />
                    </button>
                    <button
                      aria-label={`В архив: ${c.build.name}`}
                      title="В архив — можно восстановить"
                      onClick={() =>
                        void save(
                          (s) => archiveCharacter(s, c.id),
                          "Персонаж в архиве. Восстановление доступно во вкладке «Архив».",
                        )
                      }
                    >
                      <Archive size={17} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
const classes = [
  "Бард",
  "Варвар",
  "Воин",
  "Волшебник",
  "Друид",
  "Жрец",
  "Изобретатель",
  "Колдун",
  "Монах",
  "Паладин",
  "Плут",
  "Следопыт",
  "Чародей",
  "Савант (homebrew)",
];
const races = [
  "Человек",
  "Эльф",
  "Дварф",
  "Полурослик",
  "Гном",
  "Полуэльф",
  "Полуорк",
  "Тифлинг",
  "Драконорождённый",
];
export function DraftEditor({
  character,
  campaigns,
  save,
  onDirty,
}: {
  character?: Character;
  campaigns: Campaign[];
  save: SaveWorkspace;
  onDirty: (dirty: boolean) => void;
}) {
  const [baseline] = useState(character);
  const [campaignId, setCampaignId] = useState(
    character?.build.campaignId ?? null,
  );
  const [progression, setProgression] = useState(
    character?.build.progression ?? null,
  );
  const [name, setName] = useState(character?.build.name ?? "");
  const [ancestry, setAncestry] = useState(
    character?.build.ancestry ?? "Человек",
  );
  const [className, setClass] = useState(
    character?.build.className ?? "Волшебник",
  );
  const [lore, setLore] = useState(character?.build.lore ?? "");
  const [step, setStep] = useState(character ? 3 : 1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  function edit(update: () => void) {
    update();
    setDirty(true);
  }
  async function submit() {
    if (saving) return;
    setSaving(true);
    const savedClass = progression
      ? previewProgression(progression).classSummary
      : className.trim();
    const id = character?.id ?? crypto.randomUUID();
    const ok = await save(
      (s) => {
        if (character) {
          return saveDraftBuild(
            s,
            id,
            {
              ...baseline!.build,
              name: name.trim(),
              ancestry: ancestry.trim(),
              className: savedClass,
              lore,
              campaignId,
              progression,
            },
            baseline!.build,
          );
        }
        const draft = makeDraft({ id, name, ancestry, className });
        return {
          ...s,
          activeCharacterId: id,
          characters: [
            ...s.characters,
            {
              ...draft,
              build: {
                ...draft.build,
                lore,
                campaignId,
                progression,
                className: savedClass,
              },
            },
          ],
        };
      },
      character ? "Черновик обновлён" : "Черновик создан",
    );
    setSaving(false);
    if (ok) {
      setDirty(false);
      onDirty(false);
      location.hash = "characters";
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {character ? "ИСТОРИЯ В ВАШИХ РУКАХ" : "НОВАЯ ИСТОРИЯ"}
          </div>
          <h1>{character ? "Черновик персонажа" : "Кем вы станете?"}</h1>
        </div>
        <a className="button secondary" href="#characters">
          <ArrowLeft size={16} />К персонажам
        </a>
      </div>
      <div className="creation-layout">
        <section className="panel">
          {!character && (
            <ol className="steps">
              {["Образ", "Класс", "История", "Сборка"].map((x, i) => (
                <li
                  key={x}
                  className={step === i + 1 ? "current" : ""}
                  aria-current={step === i + 1 ? "step" : undefined}
                >
                  <span>{i + 1}</span>
                  {x}
                </li>
              ))}
            </ol>
          )}
          <p className="notice">
            Сохраните образ и заполните основу сборки. Проверка правил пока
            охватывает характеристики, хиты и владения Воина и Плута. Полный
            игровой лист ещё впереди.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!character && step < 4) setStep(step + 1);
              else void submit();
            }}
          >
            <fieldset className="draft-fields" disabled={saving}>
              {(character || step === 1) && (
                <>
                  <h2>Имя и происхождение</h2>
                  <label>
                    Имя персонажа
                    <input
                      name="character-name"
                      autoComplete="off"
                      required
                      maxLength={80}
                      pattern=".*\S.*"
                      value={name}
                      onChange={(e) => edit(() => setName(e.target.value))}
                      placeholder="Как зовут вашего героя…"
                    />
                  </label>
                  <label>
                    Происхождение
                    <input
                      name="ancestry"
                      autoComplete="off"
                      required
                      maxLength={80}
                      pattern=".*\S.*"
                      list="ancestry-options"
                      value={ancestry}
                      onChange={(e) => edit(() => setAncestry(e.target.value))}
                    />
                    <datalist id="ancestry-options">
                      {races.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </label>
                </>
              )}
              {(character || step === 2) && (
                <>
                  <h2>Класс персонажа</h2>
                  <label>
                    Название класса
                    <input
                      name="class"
                      autoComplete="off"
                      required
                      maxLength={80}
                      pattern=".*\S.*"
                      list="class-options"
                      disabled={progression !== null}
                      value={
                        progression
                          ? previewProgression(progression).classSummary
                          : className
                      }
                      onChange={(e) => edit(() => setClass(e.target.value))}
                    />
                    <datalist id="class-options">
                      {classes.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </label>
                  <p className="hint">
                    {progression
                      ? "Название рассчитывается из решений по уровням ниже."
                      : "Выберите подсказку или впишите свой вариант. После заполнения уровней название будет рассчитано из сборки."}
                  </p>
                </>
              )}
              {(character || step === 3) && (
                <>
                  <h2>{character ? "История" : name}</h2>
                  {!character && (
                    <p className="muted">
                      {ancestry} · {className}
                    </p>
                  )}
                  <label>
                    История персонажа
                    <textarea
                      name="lore"
                      rows={9}
                      maxLength={30000}
                      value={lore}
                      onChange={(e) => edit(() => setLore(e.target.value))}
                      placeholder="Откуда вы пришли? Кому доверяете? Чего ищете…"
                    />
                  </label>
                </>
              )}
              {(character || step === 4) && (
                <ProgressionEditor
                  value={progression}
                  onChange={(p) => edit(() => setProgression(p))}
                  campaignId={campaignId}
                  onCampaignChange={(id) => edit(() => setCampaignId(id))}
                  campaigns={campaigns}
                  previous={baseline?.build.progression ?? null}
                />
              )}
            </fieldset>
            <div className="form-footer">
              {!character && step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)}>
                  Назад
                </button>
              ) : (
                <span className="hint">
                  {dirty
                    ? "Есть несохранённые изменения"
                    : "Изменения появятся после сохранения"}
                </span>
              )}
              <button className="primary" disabled={saving}>
                {saving
                  ? "Сохраняем…"
                  : !character && step < 4
                    ? "Продолжить"
                    : character
                      ? "Сохранить изменения"
                      : "Сохранить черновик"}
                {!character && step < 4 ? (
                  <ChevronRight size={16} />
                ) : (
                  <Save size={16} />
                )}
              </button>
            </div>
          </form>
        </section>
        <aside className="quiet-note">
          <Feather size={24} />
          <h3>Сначала — замысел</h3>
          <p>
            Набросайте образ и вернитесь к нему в любой момент. Черновики
            хранятся отдельно от учебного листа Гу Ченя.
          </p>
          <p>
            Архив сохраняет всё содержимое персонажа. Если передумаете,
            восстановите его из списка.
          </p>
        </aside>
      </div>
    </>
  );
}
