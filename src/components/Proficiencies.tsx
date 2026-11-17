import {
  abilityNames,
  type Progression,
  type previewProgression,
} from "../progression";
import {
  expertiseNames,
  skillNames,
  previewProficiencies,
  type Expertise,
} from "../proficiencies";
import { signed } from "../model";

export function ProficiencyChoices({
  index,
  entry,
  options,
  onChange,
}: {
  index: number;
  entry: Progression["levels"][number];
  options: ReturnType<typeof previewProficiencies>["levels"][number];
  onChange: (patch: Partial<Progression["levels"][number]>) => void;
}) {
  return (
    <>
      {(["skills", "expertise"] as const).map((kind) => {
        const selected = entry[kind];
        const count =
          kind === "skills" ? options.skillCount : options.expertiseCount;
        const allowed: readonly Expertise[] =
          kind === "skills" ? options.skillOptions : options.expertiseOptions;
        if (!count && !selected.length) return null;
        const available = [...new Set([...allowed, ...selected])];
        return (
          <fieldset className="proficiency-choices" key={kind}>
            <legend>
              {kind === "skills" ? "Навыки" : "Компетентность"} уровня{" "}
              {index + 1} · {selected.length}/{count}
            </legend>
            {kind === "expertise" && (
              <p className="hint">
                Выберите два уже полученных владения. Учитываются навыки классов
                и воровские инструменты; предыстория и раса ещё не подключены.
              </p>
            )}
            {available.map((id) => {
              const checked = selected.some((item) => item === id);
              return (
                <label className="check" key={id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      !checked &&
                      (selected.length >= count || !allowed.includes(id))
                    }
                    onChange={(e) =>
                      onChange({
                        [kind]: e.target.checked
                          ? [...selected, id]
                          : selected.filter((item) => item !== id),
                      })
                    }
                  />
                  {expertiseNames[id]}
                  {!allowed.includes(id) && " — недоступно, снимите выбор"}
                </label>
              );
            })}
            {count > 0 && available.length === 0 && (
              <p className="hint">
                Сначала выберите навыки этого и предыдущих уровней.
              </p>
            )}
          </fieldset>
        );
      })}
    </>
  );
}

export function ProficiencyPreview({
  value,
  base,
}: {
  value: Progression;
  base: ReturnType<typeof previewProgression>;
}) {
  const result = previewProficiencies(value, base);
  function sources(grants: { source: string; rank: string }[]) {
    return grants.length
      ? grants
          .map((g) => `${g.source}${g.rank === "expertise" ? " (×2)" : ""}`)
          .join("; ")
      : "Без владения";
  }
  return (
    <section className="build-preview" aria-label="Навыки и владения">
      <h3>Навыки и владения</h3>
      <p className="hint">
        Предварительные бонусы от характеристик и классов. Владения расы,
        предыстории и подкласса, временные эффекты и особенности бросков пока не
        учитываются.
      </p>
      {result.issues.length > 0 && (
        <>
          <h4>Уточните выборы владений</h4>
          <ul>
            {result.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </>
      )}
      {!result.valid && (
        <p className="notice">
          Бонусы появятся после исправления замечаний к характеристикам, уровням
          и владениям. Черновик можно сохранить сейчас.
        </p>
      )}
      <details open>
        <summary>Навыки и пассивные проверки</summary>
        <p className="hint">
          Пассивная проверка: 10 + бонус, без преимущества и помехи.
        </p>
        <div className="proficiency-results">
          {result.checks.map(({ id, ability, grants, check, passive }) => (
            <div key={id}>
              <strong>
                {skillNames[id]}{" "}
                <span>{check ? signed(check.total) : "?"}</span>
              </strong>
              <small>
                {abilityNames[ability]} · пассивная {passive ?? "?"}
              </small>
              <small>{sources(grants)}</small>
              {check && (
                <small>
                  Модификатор {signed(check.contributions[0].value)} ·
                  мастерство {signed(check.contributions[1].value)}
                </small>
              )}
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary>Спасброски</summary>
        <div className="proficiency-results">
          {result.savingThrows.map(({ id, grants, check }) => (
            <div key={id}>
              <strong>
                {abilityNames[id]} {check ? signed(check.total) : "?"}
              </strong>
              <small>{sources(grants)}</small>
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary>Доспехи, оружие и инструменты</summary>
        <ul>
          {[...result.gear].map(([name, from]) => (
            <li key={name}>
              {name} — {from.join("; ")}
            </li>
          ))}
        </ul>
        {result.grants.has("thievesTools") && (
          <p>
            Воровские инструменты: {sources(result.grants.get("thievesTools")!)}
            . Характеристику проверки определяет мастер; фиксированный бонус
            Ловкости не назначается.
          </p>
        )}
        <p className="hint">
          Это полученные владения. Предметы не добавляются в инвентарь, КД и
          атаки не пересчитываются.
        </p>
      </details>
    </section>
  );
}
