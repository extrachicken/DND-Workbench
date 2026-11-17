import { z } from "zod";
import {
  abilityCheck,
  abilityIds,
  passiveCheck,
  skillAbilities,
  type Ability,
  type ProficiencyGrant,
  type Skill,
} from "./rules";
import type { Progression, previewProgression } from "./progression";

export const skillNames: Record<Skill, string> = {
  acrobatics: "Акробатика",
  animalHandling: "Уход за животными",
  arcana: "Магия",
  athletics: "Атлетика",
  deception: "Обман",
  history: "История",
  insight: "Проницательность",
  intimidation: "Запугивание",
  investigation: "Расследование",
  medicine: "Медицина",
  nature: "Природа",
  perception: "Внимательность",
  performance: "Выступление",
  persuasion: "Убеждение",
  religion: "Религия",
  sleightOfHand: "Ловкость рук",
  stealth: "Скрытность",
  survival: "Выживание",
};
export const skillIds = Object.keys(skillAbilities) as [Skill, ...Skill[]];
export const skillSchema = z.enum(skillIds);
export const expertiseSchema = z.union([
  skillSchema,
  z.literal("thievesTools"),
]);
export type Expertise = z.infer<typeof expertiseSchema>;
export const expertiseNames = {
  ...skillNames,
  thievesTools: "Воровские инструменты",
};
export const classSkills: Record<"fighter" | "rogue", readonly Skill[]> = {
  fighter: [
    "acrobatics",
    "animalHandling",
    "athletics",
    "history",
    "insight",
    "intimidation",
    "perception",
    "survival",
  ],
  rogue: [
    "acrobatics",
    "athletics",
    "deception",
    "insight",
    "intimidation",
    "investigation",
    "perception",
    "performance",
    "persuasion",
    "sleightOfHand",
    "stealth",
  ],
};
const equipment = {
  fighter: [
    "Лёгкие доспехи",
    "Средние доспехи",
    "Щиты",
    "Простое оружие",
    "Воинское оружие",
  ],
  rogue: [
    "Лёгкие доспехи",
    "Простое оружие",
    "Ручные арбалеты",
    "Длинные мечи",
    "Рапиры",
    "Короткие мечи",
    "Воровские инструменты",
  ],
};

// Resolve in chronological order: later grants cannot qualify earlier expertise.
export function resolveProficiencies(p: Progression) {
  const issues: string[] = [];
  const grants = new Map<Expertise, ProficiencyGrant[]>();
  const saves = new Map<Ability, ProficiencyGrant[]>();
  const gear = new Map<string, string[]>();
  const counts = { fighter: 0, rogue: 0 };
  const expert = new Set<Expertise>();
  const levels = p.levels.map((entry, index) => {
    const classLevel = ++counts[entry.classId];
    const source = `${entry.classId === "fighter" ? "Воин" : "Плут"} ${classLevel} · уровень ${index + 1}`;
    const skillCount =
      classLevel === 1
        ? index === 0
          ? entry.classId === "fighter"
            ? 2
            : 4
          : entry.classId === "rogue"
            ? 1
            : 0
        : 0;
    const expertiseCount =
      entry.classId === "rogue" && [1, 6].includes(classLevel) ? 2 : 0;
    const skillOptions = skillCount
      ? classSkills[entry.classId].filter((id) => !grants.has(id))
      : [];
    if (classLevel === 1) {
      const items =
        entry.classId === "fighter"
          ? [...equipment.fighter, ...(index === 0 ? ["Тяжёлые доспехи"] : [])]
          : index === 0
            ? equipment.rogue
            : ["Лёгкие доспехи", "Воровские инструменты"];
      for (const item of items)
        gear.set(item, [...(gear.get(item) ?? []), source]);
      if (entry.classId === "rogue")
        grants.set("thievesTools", [{ source, rank: "proficient" }]);
      if (index === 0) {
        const abilities: Ability[] =
          entry.classId === "fighter" ? ["str", "con"] : ["dex", "int"];
        for (const ability of abilities)
          saves.set(ability, [{ source, rank: "proficient" }]);
      }
    }
    if (entry.classId === "rogue" && classLevel === 15)
      saves.set("wis", [
        { source: `${source} · Изворотливый ум`, rank: "proficient" },
      ]);
    function validate<T extends string>(
      selected: T[],
      allowed: readonly T[],
      count: number,
      label: string,
    ) {
      if (selected.length !== count)
        issues.push(
          `${source}: ${label} — нужно выбрать ${count}, выбрано ${selected.length}.`,
        );
      if (new Set(selected).size !== selected.length)
        issues.push(`${source}: ${label} — повторный выбор.`);
      if (selected.some((id) => !allowed.includes(id)))
        issues.push(`${source}: ${label} — есть недоступный выбор.`);
      return (
        selected.length === count &&
        new Set(selected).size === selected.length &&
        selected.every((id) => allowed.includes(id))
      );
    }
    if (validate(entry.skills, skillOptions, skillCount, "навыки"))
      for (const id of entry.skills)
        grants.set(id, [{ source, rank: "proficient" }]);
    const expertiseOptions = expertiseCount
      ? [...grants.keys()].filter((id) => !expert.has(id))
      : [];
    if (
      validate(
        entry.expertise,
        expertiseOptions,
        expertiseCount,
        "компетентность",
      )
    ) {
      for (const id of entry.expertise) {
        expert.add(id);
        grants.set(id, [
          ...grants.get(id)!,
          { source: `${source} · Компетентность`, rank: "expertise" },
        ]);
      }
    }
    return { skillCount, skillOptions, expertiseCount, expertiseOptions };
  });
  return { issues, grants, saves, gear, levels };
}

export function previewProficiencies(
  p: Progression,
  base: ReturnType<typeof previewProgression>,
) {
  const resolved = resolveProficiencies(p);
  const valid = base.issues.length === 0 && resolved.issues.length === 0;
  const checks = (Object.keys(skillAbilities) as Skill[]).map((id) => {
    const ability = skillAbilities[id];
    const grants = resolved.grants.get(id) ?? [];
    const check = valid
      ? abilityCheck(base.scores[ability]!, p.levels.length, grants)
      : null;
    return {
      id,
      ability,
      grants,
      check,
      passive: check ? passiveCheck(check).total : null,
    };
  });
  const saves = abilityIds.map((id) => {
    const grants = resolved.saves.get(id) ?? [];
    return {
      id,
      grants,
      check: valid
        ? abilityCheck(base.scores[id]!, p.levels.length, grants)
        : null,
    };
  });
  return { ...resolved, checks, savingThrows: saves, valid };
}
