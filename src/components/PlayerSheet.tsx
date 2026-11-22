import { useState } from "react";
import type { Campaign } from "../campaign";
import type { Character } from "../character";
import { startingMaximum, startPlay, takeDamage, undoDamage } from "../play";
import { abilityNames, previewProgression } from "../progression";
import { abilityIds } from "../rules";
import type { SaveWorkspace } from "./Characters";
import { ProficiencyPreview } from "./Proficiencies";

export function StartPlayForm({
  character,
  campaign,
  dirty,
  save,
}: {
  character: Character;
  campaign?: Campaign;
  dirty: boolean;
  save: SaveWorkspace;
}) {
  const max = startingMaximum(character, campaign);
  const [pending, setPending] = useState(false);
  if (!character.build.progression) return null;
  return (
    <section className="panel play-start" aria-label="Подготовка к игре">
      <h2>Подготовка к игре</h2>
      {dirty || max === null ? (
        <p className="hint">
          {dirty
            ? "Сохраните изменения сборки перед началом игры."
            : "Заполните характеристики и выборы по уровням ниже, затем сохраните черновик."}
        </p>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            const data = new FormData(event.currentTarget);
            setPending(true);
            await save(
              (s) =>
                startPlay(
                  s,
                  character,
                  Number(data.get("hp")),
                  Number(data.get("tempHp")),
                ),
              "Игровой лист открыт",
            );
            setPending(false);
          }}
        >
          <p>
            Максимум хитов по сборке — {max}. Укажите остаток на начало сессии.
            После начала игры сборка фиксируется.
          </p>
          <div className="play-controls">
            <label>
              Стартовые хиты
              <input
                name="hp"
                type="number"
                inputMode="numeric"
                min={0}
                max={max}
                required
                placeholder={`0–${max}`}
              />
            </label>
            <label>
              Стартовые временные хиты
              <input
                name="tempHp"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                required
                defaultValue={character.runtime.tempHp}
              />
            </label>
            <button className="primary" disabled={pending}>
              Начать игру
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function PlayerSheet({
  character,
  campaign,
  save,
}: {
  character: Character;
  campaign?: Campaign;
  save: SaveWorkspace;
}) {
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const p = character.build.progression!;
  const preview = previewProgression(p, campaign);
  const { hp, tempHp, lastDamage } = character.runtime;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{character.build.name}</h1>
          <p>
            {character.build.ancestry} · {preview.classSummary}
          </p>
        </div>
        <a href="#characters" className="button secondary">
          К персонажам
        </a>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Хиты</h2>
          <div className="health-display">
            <strong>
              {hp} / {character.build.maxHp}
            </strong>
          </div>
          <p>Временные хиты · {tempHp}</p>
          <form
            className="play-controls"
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending) return;
              setPending(true);
              await save(
                (s) => takeDamage(s, character.id, Number(amount)),
                "Урон записан",
              );
              setPending(false);
            }}
          >
            <label>
              Величина урона
              <input
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={9999}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <button className="primary" disabled={pending || (!hp && !tempHp)}>
              Урон
            </button>
          </form>
          {lastDamage && (
            <button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await save(
                  (s) => undoDamage(s, character.id, lastDamage.id),
                  "Хиты до удара восстановлены",
                );
                setPending(false);
              }}
            >
              Отменить урон · {lastDamage.amount}
            </button>
          )}
        </section>
        <section className="panel">
          <h2>Характеристики</h2>
          <dl className="play-scores">
            {abilityIds.map((id) => (
              <div key={id}>
                <dt>{abilityNames[id]}</dt>
                <dd>{preview.scores[id] ?? "?"}</dd>
              </div>
            ))}
          </dl>
          <ProficiencyPreview value={p} base={preview} />
          {character.build.lore && (
            <details>
              <summary>История персонажа</summary>
              <p className="play-lore">{character.build.lore}</p>
            </details>
          )}
        </section>
      </div>
    </>
  );
}
