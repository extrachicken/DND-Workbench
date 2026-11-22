import { abilityIds } from "../rules";
import { abilityNames, type Progression } from "../progression";
import { terms, type RuleEntry } from "../creation-reference";
import { RuleHelp } from "./RuleHelp";

export function AbilityEditor({
  value,
  race,
  onChange,
}: {
  value: Progression;
  race?: RuleEntry;
  onChange: (value: Progression) => void;
}) {
  const rogue = value.levels[0].classId === "rogue";
  return (
    <section>
      <RuleHelp entry={terms.scores} label="Как распределить значения" />
      <p>
        {rogue
          ? "Для плута обычно важнее всего Ловкость."
          : "Для воина с тяжёлым оружием обычно важнее всего Сила."}{" "}
        Можно начать со стандартного набора и изменить расстановку.
      </p>
      <button
        type="button"
        onClick={() => {
          if (
            abilityIds.some((id) => value.baseScores[id] !== null) &&
            !window.confirm(
              "Заменить шесть исходных значений стандартным набором?",
            )
          )
            return;
          onChange({
            ...value,
            baseScores: rogue
              ? { str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 }
              : { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
          });
        }}
      >
        Распределить стандартный набор
      </button>
      <p className="hint">
        Введите исходные значения, затем укажите расовые прибавки по своему
        источнику. Пустое исходное значение можно заполнить позже.
      </p>
      {race && <RuleHelp entry={race} label={"Прибавки расы · " + race.name} />}
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
                  if (n === null || (Number.isInteger(n) && n >= 1 && n <= 30))
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
          onChange={(e) => onChange({ ...value, abilityNotes: e.target.value })}
        />
      </label>
    </section>
  );
}
