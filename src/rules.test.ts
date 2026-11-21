import { describe, expect, it } from "vitest";
import {
  abilityCheck,
  abilityIds,
  abilityModifier,
  armorClass,
  classLevels,
  hitPoints,
  initiative,
  passiveCheck,
  proficiencyBonus,
  skillAbilities,
  skillCheck,
  type AbilityScores,
  type ArmorFormula,
  type LevelDecision,
} from "./rules";
import { deriveGuChenStats } from "./gu-chen";
import { initialAppWorkspace, makeDraft } from "./workspace";

const guChen: AbilityScores = {
  str: 4,
  dex: 16,
  con: 17,
  int: 20,
  wis: 14,
  cha: 12,
};
const fighterWizard: readonly LevelDecision[] = [
  { classId: "fighter", hitDie: 10, hp: "first" },
  { classId: "fighter", hitDie: 10, hp: "average" },
  { classId: "fighter", hitDie: 10, hp: { roll: 4 } },
  { classId: "wizard", hitDie: 6, hp: "average" },
];

describe("Характеристики и владения 2014", () => {
  it("получает модификаторы уже итоговых характеристик без повторных бонусов", () => {
    expect(
      abilityIds.map((ability) => abilityModifier(guChen[ability])),
    ).toEqual([-3, 3, 3, 5, 2, 1]);
    expect(abilityModifier(1)).toBe(-5);
    expect(abilityModifier(30)).toBe(10);
    expect(abilityModifier(7)).toBe(-2);
  });
  it.each([0, 31, 12.5, NaN, Infinity])(
    "не рассчитывает недопустимую характеристику %s",
    (value) => {
      expect(() => abilityModifier(value)).toThrow();
    },
  );
  it("проверяет все уровни таблицы мастерства", () => {
    expect(
      Array.from({ length: 20 }, (_, i) => proficiencyBonus(i + 1)),
    ).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
  });
  it.each([0, 21, 1.5, NaN])("отклоняет недопустимый уровень %s", (value) => {
    expect(() => proficiencyBonus(value)).toThrow();
  });
  it("сохраняет отдельный уровень каждого класса", () => {
    expect([...classLevels(fighterWizard)]).toEqual([
      ["fighter", 3],
      ["wizard", 1],
    ]);
    expect(proficiencyBonus([...fighterWizard, fighterWizard[1]].length)).toBe(
      3,
    );
  });
  it("не складывает повторное владение или компетентность", () => {
    expect(
      abilityCheck(14, 5, [
        { source: "background", rank: "proficient" },
        { source: "class", rank: "proficient" },
      ]).total,
    ).toBe(5);
    expect(
      abilityCheck(14, 5, [
        { source: "background", rank: "proficient" },
        { source: "rogue", rank: "expertise" },
        { source: "feature", rank: "expertise" },
      ]).total,
    ).toBe(8);
  });
  it("округляет половину мастерства вниз и применяет её только без полного владения", () => {
    const half = { source: "jack-of-all-trades", rank: "half" } as const;
    expect(abilityCheck(10, 5, [half, half]).total).toBe(1);
    expect(
      abilityCheck(10, 5, [half, { source: "class", rank: "proficient" }])
        .total,
    ).toBe(3);
    expect(abilityCheck(4, 5).total).toBe(-3);
  });
  it("содержит стандартные характеристики всех 18 навыков", () => {
    expect(skillAbilities).toEqual({
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
    });
  });
  it("заменяет характеристику проверки, сохраняя компетентность (GC-05)", () => {
    const grants = [{ source: "gu-chen:insight", rank: "expertise" }] as const;
    expect(skillCheck(guChen, "insight", 4, grants).total).toBe(6);
    expect(
      skillCheck(guChen, "insight", 4, grants, { ability: "int" }).total,
    ).toBe(9);
  });
  it("считает спасбросок и инициативу с явными источниками бонусов", () => {
    expect(
      abilityCheck(17, 4, [{ source: "fighter:con-save", rank: "proficient" }])
        .total,
    ).toBe(5);
    const result = initiative(16, [{ source: "alert", value: 5 }]);
    expect(result).toEqual({
      total: 8,
      contributions: [
        { source: "dexterity", value: 3 },
        { source: "alert", value: 5 },
      ],
    });
  });
  it("отклоняет повторную прибавку от одного источника", () => {
    expect(() =>
      initiative(16, [
        { source: "alert", value: 5 },
        { source: "alert", value: 5 },
      ]),
    ).toThrow();
    expect(() => initiative(16, [{ source: "effect", value: NaN }])).toThrow();
  });
});

describe("Пассивные проверки", () => {
  const observant = { source: "observant:perception", value: 5 };
  it("отделяет активные +4 от пассивных 19 (GC-03/04)", () => {
    const check = skillCheck(guChen, "perception", 4, [
      { source: "quick-learning", rank: "proficient" },
    ]);
    expect(check.total).toBe(4);
    const passive = passiveCheck(check, { bonuses: [observant] });
    expect(passive.total).toBe(19);
    expect(passive.contributions.reduce((n, t) => n + t.value, 0)).toBe(19);
    expect(
      passiveCheck(skillCheck(guChen, "perception", 4), {
        bonuses: [observant],
      }).total,
    ).toBe(17);
    expect(check.total).toBe(4);
  });
  it.each([
    [false, false, 14],
    [true, false, 19],
    [false, true, 9],
    [true, true, 14],
  ])(
    "преимущество %s / помеха %s → %s",
    (advantage, disadvantage, expected) => {
      expect(
        passiveCheck(
          abilityCheck(14, 4, [{ source: "skill", rank: "proficient" }]),
          {
            advantage: Boolean(advantage),
            disadvantage: Boolean(disadvantage),
          },
        ).total,
      ).toBe(expected);
    },
  );
});

describe("Класс доспеха", () => {
  const leather: ArmorFormula = {
    source: "leather",
    base: 11,
    abilities: [{ ability: "dex" }],
    allowsShield: true,
  };
  const scale: ArmorFormula = {
    source: "scale",
    base: 14,
    abilities: [{ ability: "dex", cap: 2 }],
    allowsShield: true,
  };
  const chain: ArmorFormula = {
    source: "chain",
    base: 16,
    abilities: [],
    allowsShield: true,
  };
  it("различает лёгкий, средний и тяжёлый доспех и обычный щит", () => {
    expect(armorClass(guChen, leather).total).toBe(14);
    expect(armorClass(guChen, scale).total).toBe(16);
    expect(armorClass(guChen, chain, { shield: true }).total).toBe(18);
  });
  it("сохраняет отрицательную Ловкость для среднего доспеха, игнорирует её для тяжёлого", () => {
    expect(armorClass({ ...guChen, dex: 7 }, scale).total).toBe(12);
    expect(armorClass({ ...guChen, dex: 7 }, chain).total).toBe(16);
  });
  it("применяет одну выбранную формулу, проверяя несовместимость со щитом", () => {
    const monk: ArmorFormula = {
      source: "monk",
      base: 10,
      abilities: [{ ability: "dex" }, { ability: "wis" }],
      allowsShield: false,
    };
    expect(armorClass(guChen, monk).total).toBe(15);
    expect(() => armorClass(guChen, monk, { shield: true })).toThrow();
    expect(
      armorClass(guChen, leather, { bonuses: [{ source: "magic", value: 1 }] })
        .total,
    ).toBe(15);
  });
});

describe("Хиты по уровням", () => {
  it("даёт полную кость лишь на первом общем уровне, хранит разные кости отдельно", () => {
    expect(hitPoints(fighterWizard, 16)).toEqual({
      maxHp: 36,
      levels: [
        { level: 1, classId: "fighter", gain: 13 },
        { level: 2, classId: "fighter", gain: 9 },
        { level: 3, classId: "fighter", gain: 7 },
        { level: 4, classId: "wizard", gain: 7 },
      ],
      hitDice: { 6: 1, 10: 3 },
      missingLevels: [],
    });
  });
  it("пересчитывает Телосложение для всех уровней", () => {
    expect(hitPoints(fighterWizard, 18).maxHp).toBe(40);
    expect(hitPoints(fighterWizard, 14).maxHp).toBe(32);
  });
  it("применяет минимальный прирост 1 из errata", () => {
    expect(
      hitPoints(
        [
          { classId: "wizard", hitDie: 6, hp: "first" },
          { classId: "wizard", hitDie: 6, hp: { roll: 1 } },
        ],
        1,
      ).maxHp,
    ).toBe(2);
  });
  it("не угадывает недостающие результаты хитов", () => {
    const result = hitPoints(
      [fighterWizard[0], { ...fighterWizard[1], hp: null }],
      16,
    );
    expect(result.maxHp).toBeNull();
    expect(result.missingLevels).toEqual([2]);
    expect(result.hitDice).toEqual({ 10: 2 });
  });
  it("отклоняет полную кость при мультиклассе и бросок на первом уровне", () => {
    expect(() =>
      hitPoints(
        [fighterWizard[0], { classId: "wizard", hitDie: 6, hp: "first" }],
        16,
      ),
    ).toThrow();
    expect(() =>
      hitPoints([{ classId: "wizard", hitDie: 6, hp: { roll: 6 } }], 16),
    ).toThrow();
  });
  it.each([0, 11, 1.5, NaN])("отклоняет неправильный бросок d10 %s", (roll) => {
    expect(() =>
      hitPoints([fighterWizard[0], { ...fighterWizard[1], hp: { roll } }], 16),
    ).toThrow();
  });
  it("отклоняет пустой список, более 20 уровней и противоречивую кость класса", () => {
    expect(() => hitPoints([], 16)).toThrow();
    expect(() =>
      hitPoints(
        Array.from({ length: 21 }, () => fighterWizard[0]),
        16,
      ),
    ).toThrow();
    expect(() =>
      hitPoints([fighterWizard[0], { ...fighterWizard[1], hitDie: 6 }], 16),
    ).toThrow();
  });
});

describe("Подключение к учебному листу", () => {
  it.each([null, 0, 1, 2])(
    "пересчёт не изменяет лист и остаток ячеек %s",
    (slotsRemaining) => {
      const character = initialAppWorkspace().characters[0];
      character.runtime = {
        ...character.runtime,
        hp: 12,
        tempHp: 7,
        slotsRemaining,
      };
      const before = structuredClone(character);
      const derived = deriveGuChenStats(character);
      expect(derived).toMatchObject({
        maxHp: 30,
        slotsMax: 2,
        proficiency: 2,
        initiative: 8,
        investigation: 9,
        perception: 4,
        passivePerception: 19,
        armorClass: 16,
      });
      expect(deriveGuChenStats(character)).toEqual(derived);
      expect(character).toEqual(before);
      expect(character).not.toHaveProperty("derived");
    },
  );
  it("не создаёт игровой лист для незавершённого черновика", () => {
    expect(
      deriveGuChenStats(
        makeDraft({
          id: "draft",
          name: "Черновик",
          ancestry: "Человек",
          className: "Воин",
        }),
      ),
    ).toBeNull();
  });
  it("вычисления не меняют переданные решения и возвращают независимые пояснения", () => {
    const levels = structuredClone(fighterWizard);
    const before = structuredClone(levels);
    hitPoints(levels, 18);
    expect(levels).toEqual(before);
    const bonuses = [{ source: "alert", value: 5 }];
    const result = initiative(16, bonuses);
    bonuses[0].value = 99;
    expect(result.contributions[1].value).toBe(5);
  });
});
