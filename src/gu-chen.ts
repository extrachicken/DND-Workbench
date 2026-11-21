import type { Character } from "./character";
import {
  abilityModifier,
  initiative,
  passiveCheck,
  proficiencyBonus,
  skillCheck,
  type AbilityScores,
} from "./rules";

// Fixed decisions from Gu Chen’s character sheet.
// Source and unresolved decisions: docs/gu-chen-validation-case.md.
const abilities = [
  ["Сила", "str"],
  ["Ловкость", "dex"],
  ["Телосложение", "con"],
  ["Интеллект", "int"],
  ["Мудрость", "wis"],
  ["Харизма", "cha"],
] as const;
const scores: AbilityScores = {
  str: 4,
  dex: 16,
  con: 17,
  int: 20,
  wis: 14,
  cha: 12,
};
export type DerivedStats = {
  abilities: { name: string; score: number; modifier: number }[];
  maxHp: number;
  slotsMax: number;
  level: number;
  experience: number;
  armorClass: number;
  initiative: number;
  speedFeet: number;
  proficiency: number;
  investigation: number;
  perception: number;
  passivePerception: number;
};
export function deriveGuChenStats(character: Character): DerivedStats | null {
  if (character.kind !== "demo") return null;
  const level = 4;
  const perception = skillCheck(scores, "perception", level, [
    { source: "gu-chen:quick-learning", rank: "proficient" },
  ]);
  return {
    abilities: abilities.map(([name, ability]) => ({
      name,
      score: scores[ability],
      modifier: abilityModifier(scores[ability]),
    })),
    maxHp: character.build.maxHp,
    slotsMax: 2,
    level,
    experience: 2700,
    armorClass: 16,
    initiative: initiative(scores.dex, [{ source: "gu-chen:alert", value: 5 }])
      .total,
    speedFeet: 30,
    proficiency: proficiencyBonus(level),
    investigation: skillCheck(scores, "investigation", level, [
      { source: "gu-chen:investigation-expertise", rank: "expertise" },
    ]).total,
    perception: perception.total,
    passivePerception: passiveCheck(perception, {
      bonuses: [{ source: "gu-chen:observant", value: 5 }],
    }).total,
  };
}
