import { ScrollText } from "lucide-react";
import { useState } from "react";
import { abilityIds, abilityModifier } from "../rules";
import { expertiseNames, skillNames } from "../proficiencies";
import type { Progression } from "../progression";
import { signed } from "../model";
import { abilityNames, type previewProgression } from "../progression";
import { terms } from "../creation-reference";
import { RuleHelp } from "./RuleHelp";

export function CreationSheet({
  name,
  ancestry,
  background,
  className,
  progression,
  preview,
}: {
  name: string;
  ancestry: string;
  background: string;
  className: string;
  progression: Progression | null;
  preview: ReturnType<typeof previewProgression> | null;
}) {
  const [open, setOpen] = useState(
    () => window.matchMedia("(min-width: 901px)").matches,
  );
  const skills = new Set(progression?.levels.flatMap((level) => level.skills));
  const expertise = new Set(
    progression?.levels.flatMap((level) => level.expertise),
  );
  return (
    <details
      className="creation-sheet"
      aria-label="Лист персонажа"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <ScrollText size={19} />
        <div>
          Лист персонажа
          {!open && name.trim() && (
            <small>
              {[name.trim(), className].filter(Boolean).join(" · ")}
            </small>
          )}
        </div>
        <span>D&D 2014</span>
      </summary>
      <div className="sheet-paper">
        <div className="sheet-identity">
          <strong>{name.trim() || "Имя персонажа"}</strong>
          <span>{[ancestry, background].filter(Boolean).join(" · ")}</span>
        </div>
        <dl className="sheet-line">
          <div>
            <dt>Класс</dt>
            <dd>{className || "—"}</dd>
          </div>
          <div>
            <dt>Уровень</dt>
            <dd>{progression?.levels.length ?? "—"}</dd>
          </div>
        </dl>
        <dl className="sheet-abilities">
          {abilityIds.map((id) => {
            const score = preview?.scores[id];
            return (
              <div key={id}>
                <dt>{abilityNames[id]}</dt>
                <dd>
                  <strong>{score ?? "—"}</strong>
                  <span aria-label="Модификатор">
                    {score != null && score >= 1 && score <= 30
                      ? signed(abilityModifier(score))
                      : "—"}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
        <dl className="sheet-line">
          <div>
            <dt>Максимум хитов</dt>
            <dd>{preview?.hp?.maxHp ?? "—"}</dd>
          </div>
          <div>
            <dt>Мастерство</dt>
            <dd>{preview ? signed(preview.proficiency) : "—"}</dd>
          </div>
        </dl>
        {skills.size > 0 && (
          <div className="sheet-grants">
            <h3>Выбранные навыки</h3>
            <p>{[...skills].map((id) => skillNames[id]).join(", ")}</p>
          </div>
        )}
        {expertise.size > 0 && (
          <div className="sheet-grants">
            <h3>Выбранная компетентность</h3>
            <p>{[...expertise].map((id) => expertiseNames[id]).join(", ")}</p>
          </div>
        )}
        <RuleHelp entry={terms.modifier} label="Как читать модификатор" />
      </div>
    </details>
  );
}
