import type { Character } from "./character";
import { modifier } from "./model";

// Existing Gu Chen UI fixture, not a validated character-creation rules engine.
// Source and unresolved decisions: docs/gu-chen-validation-case.md.
const abilities = [
  ["Сила", 4],
  ["Ловкость", 16],
  ["Телосложение", 17],
  ["Интеллект", 20],
  ["Мудрость", 14],
  ["Харизма", 12],
] as const;
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
export function deriveDemoStats(character: Character): DerivedStats | null {
  if (character.kind !== "demo") return null;
  return {
    abilities: abilities.map(([name, score]) => ({
      name,
      score,
      modifier: modifier(score),
    })),
    maxHp: character.build.maxHp,
    slotsMax: 2,
    level: 4,
    experience: 2700,
    armorClass: 16,
    initiative: 8,
    speedFeet: 30,
    proficiency: 2,
    investigation: 9,
    perception: 4,
    passivePerception: 19,
  };
}
