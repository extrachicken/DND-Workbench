import {
  ArrowLeft,
  Check,
  ChevronRight,
  Save,
  Swords,
  VenetianMask,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { campaignLabel, type Campaign } from "../campaign";
import {
  backgrounds,
  otherCoreClasses,
  races,
  terms,
} from "../creation-reference";
import {
  emptyProgression,
  previewProgression,
  progressionCatalog,
  type Progression,
  type SupportedClass,
} from "../progression";
import { makeDraft, saveDraftBuild, type Character } from "../workspace";
import { OriginChoice } from "./OriginChoice";
import { AbilityEditor } from "./AbilityEditor";
import type { SaveWorkspace } from "./Characters";
import { CreationSheet } from "./CreationSheet";
import { RuleHelp } from "./RuleHelp";
import { ProgressionEditor } from "./ProgressionEditor";
import { StartPlayForm } from "./PlayerSheet";

const otherClasses = [
  ...otherCoreClasses.map((c) => c.name),
  "Изобретатель",
  "Савант (homebrew)",
];
function supportedClass(name: string): SupportedClass | undefined {
  const text = name.trim().toLowerCase();
  return (["fighter", "rogue"] as const).find(
    (id) => text === id || text === progressionCatalog[id].name.toLowerCase(),
  );
}

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
  const build = baseline?.build;
  const [name, setName] = useState(build?.name ?? "");
  const [ancestry, setAncestry] = useState(build?.ancestry ?? "Человек");
  const [background, setBackground] = useState(build?.background ?? "");
  const [lore, setLore] = useState(build?.lore ?? "");
  const [campaignId, setCampaignId] = useState(build?.campaignId ?? null);
  const [progression, setProgression] = useState(build?.progression ?? null);
  const [className, setClass] = useState(
    build?.progression
      ? progressionCatalog[build.progression.levels[0].classId].name
      : (build?.className ?? ""),
  );
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedFocus = useRef(false);
  const campaign = campaigns.find((c) => c.id === campaignId);
  const chosen = supportedClass(className);
  const active = chosen ? progression : null;
  const preview = active ? previewProgression(active, campaign) : null;
  const savedClass = preview?.classSummary ?? className.trim();
  const identityReady = Boolean(name.trim() && ancestry.trim());
  const canSave = Boolean(identityReady && savedClass);
  const steps =
    chosen || !className.trim()
      ? ["Происхождение", "Класс", "Характеристики", "Навыки и уровни"]
      : ["Происхождение", "Класс", "Проверка"];
  const last = step === steps.length - 1;
  function navigate(index: number) {
    if (index === step) return;
    if (index >= 2 && chosen && !active) {
      setProgression(emptyProgression(chosen));
      setDirty(true);
    }
    requestedFocus.current = true;
    setStep(index);
  }
  useEffect(() => {
    if (requestedFocus.current) {
      heading.current?.focus();
      requestedFocus.current = false;
    }
  }, [step]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  function chooseClass(text: string) {
    const id = supportedClass(text);
    setClass(text);
    if (id) {
      setProgression((p) =>
        p
          ? {
              ...p,
              levels: p.levels.map((l, i) =>
                i === 0 ? { ...l, classId: id } : l,
              ),
            }
          : emptyProgression(id),
      );
    }
    setDirty(true);
  }
  function updateProgression(p: Progression) {
    setProgression(p);
    setClass(progressionCatalog[p.levels[0].classId].name);
    setDirty(true);
  }
  async function submit() {
    if (saving || !canSave) return;
    if (
      !chosen &&
      progression &&
      !window.confirm(
        "Сохранить ручной класс без расчёта? В сохранённом черновике будут только происхождение, класс и история. Решения по уровням будут удалены.",
      )
    )
      return;
    setSaving(true);
    const id = baseline?.id ?? crypto.randomUUID();
    const fields = {
      name: name.trim(),
      ancestry: ancestry.trim(),
      className: savedClass,
      lore,
      campaignId,
      progression: active,
      ...(background.trim() || build?.background !== undefined
        ? { background: background.trim() }
        : {}),
    };
    const ok = await save(
      (s) => {
        if (baseline)
          return saveDraftBuild(
            s,
            id,
            { ...baseline.build, ...fields },
            baseline.build,
          );
        const c = makeDraft({
          id,
          name: fields.name,
          ancestry: fields.ancestry,
          className: savedClass,
        });
        return {
          ...s,
          activeCharacterId: id,
          characters: [
            ...s.characters,
            { ...c, build: { ...c.build, ...fields } },
          ],
        };
      },
      baseline ? "Черновик обновлён" : "Черновик создан",
    );
    setSaving(false);
    if (ok) {
      setDirty(false);
      onDirty(false);
      location.hash = "characters";
    }
  }
  const manualClass = otherCoreClasses.find(
    (c) =>
      c.name.toLowerCase() === className.trim().toLowerCase() ||
      c.english.toLowerCase() === className.trim().toLowerCase(),
  );
  const race = races.find((r) => r.name === ancestry.trim());
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{baseline ? "Черновик персонажа" : "Создание персонажа"}</h1>
        </div>
        <a className="button secondary" href="#characters">
          <ArrowLeft size={16} />К персонажам
        </a>
      </header>
      {baseline && (
        <StartPlayForm
          character={baseline}
          campaign={campaigns.find((c) => c.id === build?.campaignId)}
          dirty={dirty}
          save={save}
        />
      )}
      <div className="builder-layout">
        <nav className="builder-nav" aria-label="Шаги создания персонажа">
          {steps.map((s, i) => (
            <button
              key={s}
              type="button"
              disabled={
                saving ||
                (i > 0 && !identityReady) ||
                (i > 1 && !className.trim())
              }
              aria-current={i === step ? "step" : undefined}
              onClick={() => navigate(i)}
            >
              <span>{i + 1}</span>
              {s}
            </button>
          ))}
        </nav>
        <CreationSheet
          name={name}
          ancestry={ancestry}
          background={background}
          className={savedClass}
          progression={active}
          preview={preview}
        />
        <section className="panel builder-panel">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (last) void submit();
              else navigate(step + 1);
            }}
          >
            <fieldset disabled={saving} className="draft-fields">
              <h2 ref={heading} tabIndex={-1}>
                {steps[step]}
              </h2>
              {step === 0 && (
                <>
                  <label>
                    Имя персонажа
                    <input
                      autoComplete="off"
                      name="character-name"
                      maxLength={80}
                      required
                      pattern=".*\S.*"
                      placeholder="Как зовут героя?"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <div className="origin-fields">
                    <OriginChoice
                      label="Раса"
                      options={races}
                      value={ancestry}
                      onChange={(v) => {
                        setAncestry(v);
                        setDirty(true);
                      }}
                      help={terms.race}
                      required
                    />
                    <OriginChoice
                      label="Предыстория"
                      options={backgrounds}
                      value={background}
                      onChange={(v) => {
                        setBackground(v);
                        setDirty(true);
                      }}
                      help={terms.background}
                    />
                  </div>
                  <label>
                    История персонажа
                    <textarea
                      rows={3}
                      maxLength={30000}
                      value={lore}
                      placeholder="Что заставило героя отправиться в путь?"
                      onChange={(e) => {
                        setLore(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label>
                    Кампания персонажа
                    <select
                      value={campaignId ?? ""}
                      onChange={(e) => {
                        setCampaignId(e.target.value || null);
                        setDirty(true);
                      }}
                    >
                      <option value="">Без кампании</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {campaignLabel(c, campaigns)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {campaign?.rules.sourceNotes && (
                    <p className="hint">{campaign.rules.sourceNotes}</p>
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <p>
                    У Воина и Плута лист рассчитывает характеристики, хиты и
                    классовые владения. Выберите один из них или внесите другой
                    класс вручную.
                  </p>
                  <div className="class-cards">
                    {(["fighter", "rogue"] as const).map((id) => {
                      const Icon = id === "fighter" ? Swords : VenetianMask;
                      return (
                        <div
                          className={chosen === id ? "selected" : ""}
                          key={id}
                        >
                          <button
                            type="button"
                            aria-pressed={chosen === id}
                            onClick={() =>
                              chooseClass(progressionCatalog[id].name)
                            }
                          >
                            <Icon aria-hidden="true" />
                            {progressionCatalog[id].name}
                            {chosen === id && <Check size={14} />}
                          </button>
                          <small>
                            {id === "fighter"
                              ? "Кость к10 · 2 навыка"
                              : "Кость к8 · 4 навыка"}
                          </small>
                          <RuleHelp entry={terms[id]} label="Умения класса" />
                        </div>
                      );
                    })}
                  </div>
                  <label>
                    Название класса
                    <input
                      name="class"
                      required
                      maxLength={80}
                      pattern=".*\S.*"
                      autoComplete="off"
                      list="class-options"
                      placeholder="Выберите или впишите класс"
                      value={className}
                      onChange={(e) => chooseClass(e.target.value)}
                    />
                  </label>
                  <datalist id="class-options">
                    {["Воин", "Плут", ...otherClasses].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                  {manualClass && (
                    <RuleHelp
                      entry={manualClass}
                      label={"Особенности класса · " + manualClass.name}
                    />
                  )}
                  {className.trim() && !chosen && (
                    <p className="notice">
                      Для класса «{className}» можно сохранить черновик. Расчёт
                      уровней и начало игры для него пока недоступны.
                    </p>
                  )}
                </>
              )}
              {step === 2 && active && (
                <>
                  <AbilityEditor
                    value={active}
                    race={race}
                    onChange={updateProgression}
                  />
                </>
              )}
              {step === 3 && active && (
                <ProgressionEditor
                  value={active}
                  onChange={updateProgression}
                  previous={build?.progression ?? null}
                  campaign={campaign}
                />
              )}
              {step === 2 && !chosen && (
                <>
                  <p>
                    <strong>{name}</strong> ·{" "}
                    {[ancestry, background, className]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p>
                    Сохраните черновик, чтобы вернуться к истории героя.
                    Характеристики и уровни этого класса ведутся вручную за
                    игровым столом.
                  </p>
                </>
              )}
            </fieldset>
            <div className="form-footer editor-save">
              {step > 0 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => navigate(step - 1)}
                >
                  Назад
                </button>
              )}
              {(canSave || last) && (
                <button
                  className={last ? "primary" : "save-draft"}
                  type={last ? "submit" : "button"}
                  disabled={!canSave || saving}
                  onClick={last ? undefined : () => void submit()}
                >
                  <Save size={15} />
                  {saving
                    ? "Сохраняем…"
                    : baseline
                      ? "Сохранить изменения"
                      : "Сохранить черновик"}
                </button>
              )}
              {!last && (
                <button className="primary" type="submit" disabled={saving}>
                  Продолжить
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
