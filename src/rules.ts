// Pure D&D 2014 calculations. Sources and supported scope: docs/rules-core.md.
export const abilityIds = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof abilityIds)[number];
export type AbilityScores = Readonly<Record<Ability, number>>;
export type Contribution = Readonly<{ source: string; value: number }>;
export type Calculation = { total: number; contributions: Contribution[] };

function integer(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`Некорректное значение: ${label}`);
}

export function abilityModifier(score: number): number {
  integer(score, 1, 30, "характеристика");
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(totalLevel: number): number {
  integer(totalLevel, 1, 20, "общий уровень");
  return 2 + Math.floor((totalLevel - 1) / 4);
}

function sum(contributions: readonly Contribution[]): Calculation {
  const sources = new Set<string>();
  for (const term of contributions) {
    if (!term.source.trim() || sources.has(term.source))
      throw new Error("У каждой прибавки должен быть уникальный источник");
    integer(term.value, -9999, 9999, term.source);
    sources.add(term.source);
  }
  return {
    total: contributions.reduce((total, term) => total + term.value, 0),
    contributions: contributions.map((term) => ({ ...term })),
  };
}

export type ProficiencyGrant = Readonly<{
  source: string;
  rank: "half" | "proficient" | "expertise";
}>;

// Grants already refer to this check; granting/qualifying for expertise is a
// class/feature rule, not inferred here. Duplicate grants never add together.
export function abilityCheck(
  score: number,
  totalLevel: number,
  grants: readonly ProficiencyGrant[] = [],
  bonuses: readonly Contribution[] = [],
): Calculation {
  const proficiency = proficiencyBonus(totalLevel);
  const factors = { half: 0.5, proficient: 1, expertise: 2 } as const;
  let factor = 0;
  for (const grant of grants) {
    if (!grant.source.trim() || !(grant.rank in factors))
      throw new Error("Некорректный источник владения");
    factor = Math.max(factor, factors[grant.rank]);
  }
  return sum([
    { source: "ability", value: abilityModifier(score) },
    {
      source: `proficiency:${[...new Set(grants.map((g) => g.source))].join(",")}`,
      value: Math.floor(proficiency * factor),
    },
    ...bonuses,
  ]);
}

export const skillAbilities = {
  acrobatics: "dex",
  animalHandling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleightOfHand: "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<string, Ability>;
export type Skill = keyof typeof skillAbilities;

export function skillCheck(
  scores: AbilityScores,
  skill: Skill,
  totalLevel: number,
  grants: readonly ProficiencyGrant[] = [],
  options: { ability?: Ability; bonuses?: readonly Contribution[] } = {},
): Calculation {
  return abilityCheck(
    scores[options.ability ?? skillAbilities[skill]],
    totalLevel,
    grants,
    options.bonuses,
  );
}

export function passiveCheck(
  check: Calculation,
  options: {
    advantage?: boolean;
    disadvantage?: boolean;
    bonuses?: readonly Contribution[];
  } = {},
): Calculation {
  const advantage = Boolean(options.advantage);
  const disadvantage = Boolean(options.disadvantage);
  return sum([
    { source: "passive:base", value: 10 },
    ...check.contributions,
    {
      source: "passive:advantage",
      value: advantage === disadvantage ? 0 : advantage ? 5 : -5,
    },
    ...(options.bonuses ?? []),
  ]);
}

export function initiative(
  dexterity: number,
  bonuses: readonly Contribution[] = [],
): Calculation {
  return sum([
    { source: "dexterity", value: abilityModifier(dexterity) },
    ...bonuses,
  ]);
}

// Exactly one applicable formula is supplied. Class/gear rules are responsible
// for offering valid alternatives; the calculator never stacks formulas.
export type ArmorFormula = Readonly<{
  source: string;
  base: number;
  abilities: readonly Readonly<{ ability: Ability; cap?: number }>[];
  allowsShield: boolean;
}>;
export function armorClass(
  scores: AbilityScores,
  formula: ArmorFormula,
  options: { shield?: boolean; bonuses?: readonly Contribution[] } = {},
): Calculation {
  integer(formula.base, 0, 30, "основа КД");
  if (!formula.source.trim()) throw new Error("Не указан источник формулы КД");
  if (options.shield && !formula.allowsShield)
    throw new Error("Эта формула КД несовместима со щитом");
  return sum([
    { source: `armor:${formula.source}`, value: formula.base },
    ...formula.abilities.map(({ ability, cap }) => {
      if (cap !== undefined) integer(cap, 0, 10, "ограничение КД");
      return {
        source: `armor:ability:${ability}`,
        value: Math.min(abilityModifier(scores[ability]), cap ?? Infinity),
      };
    }),
    { source: "armor:shield", value: options.shield ? 2 : 0 },
    ...(options.bonuses ?? []),
  ]);
}

export type HitDie = 6 | 8 | 10 | 12;
export type LevelDecision = Readonly<{
  classId: string;
  hitDie: HitDie;
  hp: "first" | "average" | { readonly roll: number } | null;
}>;

export function classLevels(levels: readonly { readonly classId: string }[]) {
  integer(levels.length, 1, 20, "число уровней");
  const counts = new Map<string, number>();
  for (const level of levels) {
    if (!level.classId.trim()) throw new Error("Не выбран класс уровня");
    counts.set(level.classId, (counts.get(level.classId) ?? 0) + 1);
  }
  return counts;
}

export type HitPointCalculation = {
  maxHp: number | null;
  levels: { level: number; classId: string; gain: number | null }[];
  hitDice: Partial<Record<HitDie, number>>;
  missingLevels: number[];
};

export function hitPoints(
  levels: readonly LevelDecision[],
  constitution: number,
): HitPointCalculation {
  classLevels(levels);
  const con = abilityModifier(constitution);
  const hitDice: Partial<Record<HitDie, number>> = {};
  const classDice = new Map<string, HitDie>();
  const missingLevels: number[] = [];
  const gains = levels.map((entry, index) => {
    if (![6, 8, 10, 12].includes(entry.hitDie))
      throw new Error("Неверная кость хитов");
    const previousDie = classDice.get(entry.classId);
    if (previousDie !== undefined && previousDie !== entry.hitDie)
      throw new Error("Кость хитов одного класса не может меняться");
    classDice.set(entry.classId, entry.hitDie);
    hitDice[entry.hitDie] = (hitDice[entry.hitDie] ?? 0) + 1;
    let gain: number | null = null;
    if (entry.hp === null) {
      missingLevels.push(index + 1);
    } else if (entry.hp === "first") {
      if (index !== 0)
        throw new Error("Полная кость только на первом уровне персонажа");
      gain = entry.hitDie + con;
    } else {
      if (index === 0)
        throw new Error("На первом уровне нужна полная кость хитов");
      const roll =
        entry.hp === "average" ? entry.hitDie / 2 + 1 : entry.hp.roll;
      integer(roll, 1, entry.hitDie, "результат кости хитов");
      gain = Math.max(1, roll + con);
    }
    return { level: index + 1, classId: entry.classId, gain };
  });
  return {
    maxHp: missingLevels.length
      ? null
      : gains.reduce((sum, g) => sum + (g.gain ?? 0), 0),
    levels: gains,
    hitDice,
    missingLevels,
  };
}
