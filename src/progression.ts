import { z } from "zod";
import { skillSchema, expertiseSchema } from "./proficiencies";
import {
  abilityIds,
  classLevels,
  hitPoints,
  proficiencyBonus,
  type Ability,
} from "./rules";
import type { Campaign } from "./campaign";

export const abilityNames: Record<Ability, string> = {
  str: "Сила",
  dex: "Ловкость",
  con: "Телосложение",
  int: "Интеллект",
  wis: "Мудрость",
  cha: "Харизма",
};
// Fixed revision; updating this registry must not silently reinterpret saved decisions.
export const progressionCatalog = {
  fighter: {
    name: "Воин",
    hitDie: 10,
    improvements: [4, 6, 8, 12, 14, 16, 19],
  },
  rogue: { name: "Плут", hitDie: 8, improvements: [4, 8, 10, 12, 16, 19] },
} as const;
export type SupportedClass = keyof typeof progressionCatalog;
const scores = z.record(
  z.enum(abilityIds),
  z.number().int().min(1).max(30).nullable(),
);
const bonuses = z.record(z.enum(abilityIds), z.number().int().min(0).max(2));
const improvement = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ability"),
    first: z.enum(abilityIds),
    second: z.enum(abilityIds),
  }),
  z.object({ kind: z.literal("feat"), feat: z.literal("grappler") }),
]);
export const progressionSchema = z.object({
  catalog: z.literal("srd-5.1-starter-2"),
  baseScores: scores,
  ancestryBonuses: bonuses,
  abilityNotes: z.string().max(2000),
  allowMulticlass: z.boolean(),
  allowFeats: z.boolean(),
  extraFeat: z.literal("grappler").nullable(),
  levels: z
    .array(
      z.object({
        classId: z.enum(["fighter", "rogue"]),
        hp: z
          .union([
            z.literal("first"),
            z.literal("average"),
            z.object({ roll: z.number().int().min(1).max(10) }),
          ])
          .nullable(),
        improvement: improvement.nullable(),
        skills: z.array(skillSchema).max(4),
        expertise: z.array(expertiseSchema).max(2),
      }),
    )
    .min(1)
    .max(20),
});
export type Progression = z.infer<typeof progressionSchema>;
export function emptyProgression(): Progression {
  return {
    catalog: "srd-5.1-starter-2",
    baseScores: {
      str: null,
      dex: null,
      con: null,
      int: null,
      wis: null,
      cha: null,
    },
    ancestryBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    abilityNotes: "",
    allowMulticlass: false,
    allowFeats: false,
    extraFeat: null,
    levels: [
      {
        classId: "fighter",
        hp: "first",
        improvement: null,
        skills: [],
        expertise: [],
      },
    ],
  };
}
export function improvementLevels(p: Progression) {
  const counts = { fighter: 0, rogue: 0 };
  return p.levels.map((level) => {
    const classLevel = ++counts[level.classId];
    return {
      classLevel,
      available: (
        progressionCatalog[level.classId].improvements as readonly number[]
      ).includes(classLevel),
    };
  });
}
export function previewProgression(p: Progression, campaign?: Campaign) {
  const issues: string[] = [];
  const scores = { ...p.baseScores };
  for (const ability of abilityIds) {
    if (scores[ability] === null)
      issues.push(`Не задана характеристика: ${abilityNames[ability]}.`);
    else {
      if (scores[ability] < 3 || scores[ability] > 18)
        issues.push(
          `${abilityNames[ability]}: исходное значение должно быть от 3 до 18.`,
        );
      scores[ability] += p.ancestryBonuses[ability];
    }
  }
  if (campaign && !campaign.rules.sources.official2014)
    issues.push(
      "Кампания не разрешает официальные материалы 2014 из этого набора.",
    );
  let hasGrappler = false;
  function feat(label: string) {
    if (hasGrappler) issues.push(`${label}: черта «Борец» уже выбрана.`);
    if (scores.str === null || scores.str < 13)
      issues.push(`${label}: для «Борца» нужна Сила 13.`);
    hasGrappler = true;
  }
  if (p.extraFeat) {
    if (!campaign?.rules.extraFeat)
      issues.push("Дополнительная черта не разрешена выбранной кампанией.");
    feat("Черта мастера на 1-м уровне");
  }
  const opportunities = improvementLevels(p);
  const seen = new Set<SupportedClass>();
  p.levels.forEach((level, index) => {
    const label = `Уровень ${index + 1}`;
    if (seen.size && !seen.has(level.classId)) {
      if (!p.allowMulticlass)
        issues.push(`${label}: подтвердите разрешение мастера на мультикласс.`);
      for (const id of new Set([...seen, level.classId])) {
        const meets =
          id === "fighter"
            ? (scores.str ?? 0) >= 13 || (scores.dex ?? 0) >= 13
            : (scores.dex ?? 0) >= 13;
        if (!meets)
          issues.push(
            `${label}: требования мультикласса ${progressionCatalog[id].name} не выполнены (${id === "fighter" ? "Сила или Ловкость" : "Ловкость"} 13).`,
          );
      }
    }
    seen.add(level.classId);
    const choice = level.improvement;
    if (opportunities[index].available) {
      if (!choice)
        issues.push(`${label}: выберите повышение характеристик или черту.`);
      else if (choice.kind === "feat") {
        if (!p.allowFeats)
          issues.push(
            `${label}: подтвердите разрешение мастера на черты вместо повышения.`,
          );
        feat(label);
      } else {
        for (const ability of [choice.first, choice.second]) {
          if (scores[ability] !== null) scores[ability]++;
        }
        if (abilityIds.some((ability) => (scores[ability] ?? 0) > 20))
          issues.push(
            `${label}: повышение не может увеличить характеристику выше 20.`,
          );
      }
    } else if (choice)
      issues.push(
        `${label}: у этого уровня класса нет повышения характеристик.`,
      );
    if (level.hp === null) issues.push(`${label}: не выбран прирост хитов.`);
    else if (index === 0 ? level.hp !== "first" : level.hp === "first")
      issues.push(
        `${label}: полная кость хитов применяется только на первом общем уровне.`,
      );
    else if (
      typeof level.hp === "object" &&
      level.hp.roll > progressionCatalog[level.classId].hitDie
    )
      issues.push(`${label}: бросок превышает кость хитов класса.`);
  });
  // Invalid/incomplete decisions never produce an apparently authoritative HP maximum.
  const hp =
    issues.length || scores.con === null
      ? null
      : hitPoints(
          p.levels.map((l) => ({
            classId: l.classId,
            hitDie: progressionCatalog[l.classId].hitDie,
            hp: l.hp,
          })),
          scores.con,
        );
  return {
    scores,
    issues,
    hp,
    proficiency: proficiencyBonus(p.levels.length),
    classSummary: [...classLevels(p.levels)]
      .map(
        ([id, count]) =>
          `${progressionCatalog[id as SupportedClass].name} ${count}`,
      )
      .join(" / "),
  };
}
