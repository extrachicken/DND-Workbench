import { ProficiencyChoices, ProficiencyPreview } from "./Proficiencies";
import { resolveProficiencies } from "../proficiencies";
import { abilityIds, abilityModifier } from "../rules";
import {
  abilityNames,
  emptyProgression,
  improvementLevels,
  previewProgression,
  progressionCatalog,
  type Progression,
  type SupportedClass,
} from "../progression";
import { campaignLabel, type Campaign } from "../campaign";

export function ProgressionEditor({
  value,
  className,
  onChange,
  campaignId,
  onCampaignChange,
  campaigns,
  previous,
}: {
  value: Progression | null;
  className: string;
  onChange: (value: Progression) => void;
  campaignId: string | null;
  onCampaignChange: (id: string | null) => void;
  campaigns: Campaign[];
  previous: Progression | null;
}) {
  const chosenClass = className.trim().toLocaleLowerCase("ru");
  const firstClass = (Object.keys(progressionCatalog) as SupportedClass[]).find(
    (id) =>
      id === chosenClass ||
      progressionCatalog[id].name.toLocaleLowerCase("ru") === chosenClass,
  );
  const campaign = campaigns.find((c) => c.id === campaignId);
  const preview = value ? previewProgression(value, campaign) : null;
  const proficiencies = value ? resolveProficiencies(value) : null;
  const before = previous ? previewProgression(previous, campaign) : null;
  const opportunities = value ? improvementLevels(value) : [];
  function level(index: number, patch: Partial<Progression["levels"][number]>) {
    if (value)
      onChange({
        ...value,
        levels: value.levels.map((l, i) =>
          i === index ? { ...l, ...patch } : l,
        ),
      });
  }
  return (
    <section className="progression-editor">
      <h2>Характеристики и уровни</h2>
      <label>
        Кампания персонажа
        <select
          value={campaignId ?? ""}
          onChange={(e) => onCampaignChange(e.target.value || null)}
        >
          <option value="">Без кампании</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {campaignLabel(c, campaigns)}
            </option>
          ))}
        </select>
      </label>
      {campaign && (
        <p className="hint">
          {campaign.rules.sourceNotes ||
            "Особые условия источников не указаны."}
        </p>
      )}
      <p className="notice">
        Расчёт по правилам 2014 учитывает уровни Воина и Плута, классовые
        владения и черту «Борец».
      </p>
      {!value ? (
        firstClass ? (
          <button
            type="button"
            onClick={() => onChange(emptyProgression(firstClass))}
          >
            Заполнить основу сборки
          </button>
        ) : (
          <p className="hint">
            Для класса «{className}» доступна запись образа и истории. Для
            расчёта уровней выберите Воина или Плута в поле «Название класса».
          </p>
        )
      ) : (
        <>
          <p className="hint">
            Введите исходные значения до расовых прибавок и повышений за уровни.
            Расовые прибавки укажите отдельно по своему источнику; происхождение
            пока не проверяется автоматически. Пустое поле означает неизвестное
            значение.
          </p>
          <div className="build-abilities">
            {abilityIds.map((id) => (
              <div key={id} className="build-ability">
                <label>
                  {abilityNames[id]}: исходная
                  <input
                    type="number"
                    min={3}
                    max={18}
                    value={value.baseScores[id] ?? ""}
                    onChange={(e) => {
                      const n =
                        e.target.value === "" ? null : Number(e.target.value);
                      if (
                        n === null ||
                        (Number.isInteger(n) && n >= 1 && n <= 30)
                      )
                        onChange({
                          ...value,
                          baseScores: { ...value.baseScores, [id]: n },
                        });
                    }}
                  />
                </label>
                <label>
                  {abilityNames[id]}: расовая прибавка
                  <select
                    value={value.ancestryBonuses[id]}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        ancestryBonuses: {
                          ...value.ancestryBonuses,
                          [id]: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[0, 1, 2].map((n) => (
                      <option key={n} value={n}>
                        +{n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
          <label>
            Способ получения и источник характеристик
            <textarea
              rows={2}
              maxLength={2000}
              value={value.abilityNotes}
              placeholder="Например: броски за столом, расовые бонусы из PHB 2014"
              onChange={(e) =>
                onChange({ ...value, abilityNotes: e.target.value })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={value.allowMulticlass}
              onChange={(e) =>
                onChange({ ...value, allowMulticlass: e.target.checked })
              }
            />
            Мастер разрешил мультикласс
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={value.allowFeats}
              onChange={(e) =>
                onChange({ ...value, allowFeats: e.target.checked })
              }
            />
            Мастер разрешил черты вместо повышения характеристик
          </label>
          {(campaign?.rules.extraFeat || value.extraFeat) && (
            <label>
              Дополнительная черта мастера на 1-м уровне
              <select
                value={value.extraFeat ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    extraFeat: e.target.value ? "grappler" : null,
                  })
                }
              >
                <option value="">Не выбрана</option>
                <option value="grappler">Борец / Grappler — Сила 13</option>
              </select>
              <span className="hint">
                Разрешение берётся из профиля кампании. Выбор необязателен;
                боевые эффекты черты пока применяются вручную.
              </span>
            </label>
          )}
          {value.levels.map((entry, index) => (
            <fieldset className="build-level" key={index}>
              <legend>
                Уровень {index + 1} · {progressionCatalog[entry.classId].name}{" "}
                {opportunities[index].classLevel}
              </legend>
              <label>
                Класс уровня {index + 1}
                <select
                  value={entry.classId}
                  onChange={(e) =>
                    level(index, { classId: e.target.value as SupportedClass })
                  }
                >
                  {Object.entries(progressionCatalog).map(([id, c]) => (
                    <option key={id} value={id}>
                      {c.name} / {id === "fighter" ? "Fighter" : "Rogue"} · к
                      {c.hitDie}
                    </option>
                  ))}
                </select>
              </label>
              <ProficiencyChoices
                index={index}
                entry={entry}
                options={proficiencies!.levels[index]}
                onChange={(patch) => level(index, patch)}
              />
              <label>
                Хиты уровня {index + 1}
                <select
                  value={
                    typeof entry.hp === "object" && entry.hp !== null
                      ? "roll"
                      : (entry.hp ?? "")
                  }
                  onChange={(e) =>
                    level(index, {
                      hp:
                        e.target.value === "roll"
                          ? { roll: 1 }
                          : e.target.value === "first"
                            ? "first"
                            : e.target.value === "average"
                              ? "average"
                              : null,
                    })
                  }
                >
                  <option value="">Неизвестно</option>
                  {index === 0 || entry.hp === "first" ? (
                    <option value="first">
                      Полная кость: {progressionCatalog[entry.classId].hitDie}
                    </option>
                  ) : null}
                  {index > 0 || entry.hp === "average" ? (
                    <option value="average">
                      Фиксированный прирост:{" "}
                      {progressionCatalog[entry.classId].hitDie / 2 + 1}
                    </option>
                  ) : null}
                  {index > 0 ||
                  (typeof entry.hp === "object" && entry.hp !== null) ? (
                    <option value="roll">Результат броска</option>
                  ) : null}
                </select>
              </label>
              {typeof entry.hp === "object" && entry.hp !== null && (
                <label>
                  Бросок хитов уровня {index + 1}
                  <input
                    type="number"
                    min={1}
                    max={progressionCatalog[entry.classId].hitDie}
                    required
                    value={entry.hp.roll}
                    onChange={(e) => {
                      const roll = Number(e.target.value);
                      if (Number.isInteger(roll) && roll >= 1 && roll <= 10)
                        level(index, { hp: { roll } });
                    }}
                  />
                </label>
              )}
              {(opportunities[index].available || entry.improvement) && (
                <>
                  <label>
                    Повышение уровня {index + 1}
                    <select
                      value={entry.improvement?.kind ?? ""}
                      onChange={(e) =>
                        level(index, {
                          improvement:
                            e.target.value === "ability"
                              ? { kind: "ability", first: "str", second: "str" }
                              : e.target.value === "feat"
                                ? { kind: "feat", feat: "grappler" }
                                : null,
                        })
                      }
                    >
                      <option value="">Не выбрано</option>
                      <option value="ability">
                        +2 к одной или +1 к двум характеристикам
                      </option>
                      <option value="feat">Борец / Grappler — Сила 13</option>
                    </select>
                  </label>
                  {entry.improvement?.kind === "ability" &&
                    (["first", "second"] as const).map((key, n) => (
                      <label key={key}>
                        Прибавка {n + 1} уровня {index + 1} (+1)
                        <select
                          value={
                            entry.improvement?.kind === "ability"
                              ? entry.improvement[key]
                              : "str"
                          }
                          onChange={(e) => {
                            if (entry.improvement?.kind === "ability")
                              level(index, {
                                improvement: {
                                  ...entry.improvement,
                                  [key]: e.target.value,
                                },
                              });
                          }}
                        >
                          {abilityIds.map((id) => (
                            <option key={id} value={id}>
                              {abilityNames[id]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                </>
              )}
            </fieldset>
          ))}
          <div className="actions build-actions">
            <button
              type="button"
              disabled={value.levels.length >= 20}
              onClick={() =>
                onChange({
                  ...value,
                  levels: [
                    ...value.levels,
                    {
                      classId: value.levels.at(-1)!.classId,
                      hp: null,
                      improvement: null,
                      skills: [],
                      expertise: [],
                    },
                  ],
                })
              }
            >
              Добавить уровень
            </button>
            <button
              type="button"
              disabled={value.levels.length <= 1}
              onClick={() =>
                onChange({ ...value, levels: value.levels.slice(0, -1) })
              }
            >
              Убрать последний уровень
            </button>
          </div>
          {preview && (
            <section
              className="build-preview"
              aria-label="Предварительный расчёт"
            >
              <h3>Предварительный расчёт</h3>
              <p>
                {before?.classSummary ?? "Без уровней"} →{" "}
                <strong>{preview.classSummary}</strong>
              </p>
              <p>
                Мастерство: +{preview.proficiency}. Максимум хитов по уровням:{" "}
                <strong>{preview.hp?.maxHp ?? "?"}</strong>
                {before && ` (сохранено: ${before.hp?.maxHp ?? "?"})`}.
              </p>
              <div className="build-totals">
                {abilityIds.map((id) => {
                  const score = preview.scores[id];
                  const modifier =
                    score !== null && score <= 30
                      ? abilityModifier(score)
                      : null;
                  return (
                    <span key={id}>
                      {abilityNames[id]}: <strong>{score ?? "?"}</strong> (
                      {modifier === null
                        ? "?"
                        : modifier >= 0
                          ? `+${modifier}`
                          : modifier}
                      )
                    </span>
                  );
                })}
              </div>
              {preview.hp && (
                <p>
                  Кости хитов:{" "}
                  {Object.entries(preview.hp.hitDice)
                    .map(([die, count]) => `${count}к${die}`)
                    .join(" + ")}
                  . Это максимумы, не остатки.
                </p>
              )}
              {preview.issues.length ? (
                <>
                  <h4>Нужно уточнить</h4>
                  <ul>
                    {preview.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                  <p className="hint">
                    Можно сохранить незавершённый черновик и вернуться к
                    решениям позже.
                  </p>
                </>
              ) : (
                <p>
                  В характеристиках, хитах и повышениях ошибок нет. Владения
                  проверяются ниже; полная проверка персонажа ещё не выполнена.
                </p>
              )}
              <p className="hint">
                Предпросмотр не меняет текущие хиты, ячейки, инвентарь или
                ручной максимум игрового листа.
              </p>
            </section>
          )}
          {preview && <ProficiencyPreview value={value} base={preview} />}
          <p className="hint">
            Источники:{" "}
            <a
              href="https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes"
              target="_blank"
              rel="noreferrer"
            >
              классы 2014
            </a>
            ,{" "}
            <a
              href="https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options"
              target="_blank"
              rel="noreferrer"
            >
              мультиклассы и черты
            </a>
            , SRD 5.1 («Борец», Сила 13). Полные тексты не загружаются.
          </p>
        </>
      )}
    </section>
  );
}
