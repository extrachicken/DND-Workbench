import { describe, expect, it } from "vitest";
import {
  emptyProgression,
  improvementLevels,
  previewProgression,
  progressionSchema,
  type Progression,
} from "./progression";
import { makeCampaign } from "./campaign";
import {
  archiveCharacter,
  restoreCharacter,
  initialAppWorkspace,
  makeDraft,
  saveDraftBuild,
  encodeBackup,
  appWorkspaceSchema,
} from "./workspace";
import { decodeBackup, migrateV4 } from "./migrations";
import { legacyV3Fixture } from "./test-fixtures";

function build(levels = 1): Progression {
  return {
    ...emptyProgression(),
    baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    levels: Array.from({ length: levels }, (_, index) => ({
      classId: "fighter",
      hp: index === 0 ? "first" : "average",
      improvement: null,
    })),
  };
}
describe("Предпросмотр основы сборки 2014", () => {
  it("не выдумывает неизвестные характеристики", () => {
    const p = emptyProgression();
    expect(previewProgression(p).issues).toHaveLength(6);
    expect(previewProgression(p).hp).toBeNull();
    expect(previewProgression(p).scores.str).toBeNull();
  });
  it("отделяет исходные значения, расовые прибавки и модификатор хитов", () => {
    const p = build(3);
    p.ancestryBonuses.con = 1;
    const before = structuredClone(p);
    const result = previewProgression(p);
    expect(result.scores.con).toBe(14);
    expect(result.hp?.maxHp).toBe(28); // 12 + 8 + 8
    expect(result.issues).toEqual([]);
    expect(p).toEqual(before);
  });
  it("применяет новое Телосложение к каждому уровню без двойного начисления", () => {
    const p = build(4);
    p.levels[3].improvement = { kind: "ability", first: "con", second: "con" };
    expect(previewProgression(p).hp?.maxHp).toBe(36); // 12 + 3 * 8
    expect(previewProgression(p).hp?.maxHp).toBe(36);
    expect(p.baseScores.con).toBe(13);
  });
  it("мультикласс получает обычный прирост и раздельные кости", () => {
    const p = build(3);
    p.allowMulticlass = true;
    p.levels[2].classId = "rogue";
    const result = previewProgression(p);
    expect(result.hp?.maxHp).toBe(24); // 11 + 7 + 6
    expect(result.hp?.hitDice).toEqual({ 10: 2, 8: 1 });
    expect(result.classSummary).toBe("Воин 2 / Плут 1");
  });
  it("повышение даётся по классу, а не общему уровню", () => {
    const p = build(4);
    p.allowMulticlass = true;
    p.levels[3].classId = "rogue";
    expect(previewProgression(p).issues).toEqual([]);
    p.levels[3].improvement = { kind: "ability", first: "str", second: "str" };
    expect(previewProgression(p).issues.join()).toContain("нет повышения");
    expect(previewProgression(p).scores.str).toBe(15);
  });
  it.each([
    ["fighter", [4, 6, 8, 12, 14, 16, 19]],
    ["rogue", [4, 8, 10, 12, 16, 19]],
  ] as const)(
    "проверяет всю последовательность повышений %s",
    (classId, expected) => {
      const p = build(20);
      p.levels.forEach((l) => {
        l.classId = classId;
      });
      expect(
        improvementLevels(p)
          .filter((l) => l.available)
          .map((l) => l.classLevel),
      ).toEqual(expected);
      expect(previewProgression(p).proficiency).toBe(6);
    },
  );
  it("проверяет разрешения и требования обоих классов при переходе", () => {
    const p = build(2);
    p.baseScores.str = 12;
    p.baseScores.dex = 12;
    p.levels[1].classId = "rogue";
    const issues = previewProgression(p).issues.join();
    expect(issues).toContain("разрешение мастера");
    expect(issues).toContain("мультикласса Воин");
    expect(issues).toContain("мультикласса Плут");
    p.levels = [p.levels[0]];
    expect(previewProgression(p).issues).toEqual([]); // No prerequisite for a first class.
  });
  it("позднее повышение не исправляет прежнюю недоступность мультикласса", () => {
    const p = build(5);
    p.allowMulticlass = true;
    p.baseScores.dex = 12;
    p.levels[1].classId = "rogue";
    p.levels[4].improvement = { kind: "ability", first: "dex", second: "dex" };
    expect(previewProgression(p).scores.dex).toBe(14);
    expect(previewProgression(p).issues.join()).toContain(
      "Уровень 2: требования",
    );
  });
  it("сохраняет выбор при смене класса и сообщает о недоступном повышении", () => {
    const p = build(4);
    p.levels[3].improvement = { kind: "ability", first: "str", second: "str" };
    p.levels[0].classId = "rogue";
    expect(previewProgression(p).issues.join()).toContain("нет повышения");
    expect(p.levels[3].improvement).not.toBeNull();
  });
  it("останавливает расчёт для превышения 20, пропущенного повышения и хитов", () => {
    const p = build(4);
    expect(previewProgression(p).issues.join()).toContain("выберите повышение");
    p.baseScores.str = 18;
    p.ancestryBonuses.str = 2;
    p.levels[3].improvement = { kind: "ability", first: "str", second: "dex" };
    expect(previewProgression(p).issues.join()).toContain("выше 20");
    expect(previewProgression(p).hp).toBeNull();
    p.levels = p.levels.slice(0, 2);
    p.levels[1].hp = null;
    expect(previewProgression(p).issues.join()).toContain("не выбран прирост");
  });
  it.each(["first", { roll: 9 }] as const)(
    "отклоняет неверное решение хитов второго класса %j",
    (hp) => {
      const p = build(2);
      p.allowMulticlass = true;
      p.levels[1] = { classId: "rogue", hp, improvement: null };
      expect(previewProgression(p).hp).toBeNull();
      expect(previewProgression(p).issues).toHaveLength(1);
    },
  );
  it("принимает допустимый бросок и минимум прироста 1", () => {
    const p = build(2);
    p.baseScores.con = 3;
    p.levels[1].hp = { roll: 1 };
    expect(previewProgression(p).hp?.maxHp).toBe(7); // 10 - 4 + max(1, 1 - 4)
  });
  it("проверяет черту мастера по кампании и на первом уровне", () => {
    const p = build(4);
    p.extraFeat = "grappler";
    p.baseScores.str = 12;
    p.levels[3].improvement = { kind: "ability", first: "str", second: "str" };
    const campaign = makeCampaign("c", "Игра");
    expect(previewProgression(p, campaign).issues.join()).toContain(
      "не разрешена",
    );
    campaign.rules.extraFeat = true;
    expect(previewProgression(p, campaign).issues.join()).toContain(
      "на 1-м уровне: для",
    );
    p.baseScores.str = 13;
    expect(previewProgression(p, campaign).issues).toEqual([]);
    campaign.rules.sources.official2014 = false;
    expect(previewProgression(p, campaign).issues.join()).toContain(
      "не разрешает официальные",
    );
  });
  it("проверяет черты вместо повышения, предпосылки и дубликаты", () => {
    const p = build(4);
    p.levels[3].improvement = { kind: "feat", feat: "grappler" };
    expect(previewProgression(p).issues.join()).toContain(
      "разрешение мастера на черты",
    );
    p.allowFeats = true;
    expect(previewProgression(p).issues).toEqual([]);
    p.baseScores.str = 12;
    expect(previewProgression(p).issues.join()).toContain("Сила 13");
    p.baseScores.str = 15;
    p.extraFeat = "grappler";
    const campaign = makeCampaign("c", "Игра");
    campaign.rules.extraFeat = true;
    expect(previewProgression(p, campaign).issues.join()).toContain(
      "уже выбрана",
    );
  });
  it.each(["catalog", "class", "score", "levels", "feat"])(
    "отклоняет повреждённую структуру: %s",
    (problem) => {
      const p = build() as unknown as Record<string, unknown>;
      if (problem === "catalog") p.catalog = "future";
      if (problem === "class")
        p.levels = [{ classId: "unknown", hp: "first", improvement: null }];
      if (problem === "score") p.baseScores = { str: 10 };
      if (problem === "levels") p.levels = Array(21).fill(build().levels[0]);
      if (problem === "feat") p.extraFeat = "unknown";
      expect(progressionSchema.safeParse(p).success).toBe(false);
    },
  );
});

describe("Сохранение сборки", () => {
  function workspace() {
    const s = initialAppWorkspace();
    s.campaigns.push(makeCampaign("c", "Игра"));
    const c = makeDraft({
      id: "d",
      name: "Имя",
      ancestry: "Человек",
      className: "Воин",
    });
    c.build = { ...c.build, maxHp: 30, campaignId: "c", progression: build(3) };
    c.runtime = {
      hp: 12,
      tempHp: 4,
      slotsRemaining: 0,
      inventory: [{ id: "i", name: "Факел", quantity: 2, equipped: true }],
    };
    s.characters.push(c);
    return s;
  }
  it("сохраняет сборку, архив и восстановление без изменения ресурсов", () => {
    const s = workspace();
    const c = s.characters[1];
    const before = structuredClone(s);
    const p = build(4);
    p.levels[3].improvement = { kind: "ability", first: "con", second: "con" };
    const updated = saveDraftBuild(
      s,
      "d",
      { ...c.build, progression: p },
      c.build,
    );
    expect(updated.characters[1].runtime).toEqual(c.runtime);
    expect(updated.characters[1].build.maxHp).toBe(30);
    expect(s).toEqual(before);
    const archived = archiveCharacter(updated, "d", "2026-11-14T12:00:00.000Z");
    const restored = restoreCharacter(
      decodeBackup(encodeBackup(archived)),
      "d",
    );
    expect(restored.characters[1]).toEqual(updated.characters[1]);
  });
  it("не перезаписывает более новую сборку, но сохраняет свежие ресурсы", () => {
    const s = workspace();
    const baseline = structuredClone(s.characters[1].build);
    s.characters[1].runtime.hp = 7;
    const changed = saveDraftBuild(
      s,
      "d",
      { ...baseline, lore: "История" },
      baseline,
    );
    expect(changed.characters[1].runtime.hp).toBe(7);
    expect(() => saveDraftBuild(changed, "d", baseline, baseline)).toThrow(
      "другой вкладке",
    );
    expect(() =>
      saveDraftBuild(archiveCharacter(s, "d"), "d", baseline, baseline),
    ).toThrow();
  });
  it("проверяет ссылку кампании и неизменность при её переименовании", () => {
    const s = workspace();
    const p = structuredClone(s.characters[1]);
    s.campaigns[0].name = "Новое имя";
    expect(appWorkspaceSchema.parse(s).characters[1]).toEqual(p);
    s.campaigns = [];
    expect(() => encodeBackup(s)).toThrow();
  });
  it("перенос v4 сохраняет каждый прежний атрибут и не угадывает решения", () => {
    const old = {
      ...legacyV3Fixture(),
      version: 4,
      campaigns: [makeCampaign("c", "Игра")],
      notes: [],
    };
    old.characters[0].runtime.hp = 12;
    old.characters[0].runtime.slotsRemaining = 0;
    const before = structuredClone(old);
    const moved = migrateV4(old);
    const { campaignId, progression, ...originalBuild } =
      moved.characters[0].build;
    expect([campaignId, progression]).toEqual([null, null]);
    expect(originalBuild).toEqual(old.characters[0].build);
    expect(moved.characters[0].runtime).toEqual(old.characters[0].runtime);
    expect(moved.campaigns).toEqual(old.campaigns);
    expect(old).toEqual(before);
    expect(decodeBackup(JSON.stringify(old))).toEqual(moved);
  });
});
