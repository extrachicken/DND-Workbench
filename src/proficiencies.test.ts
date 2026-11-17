import { describe, expect, it } from "vitest";
import {
  emptyProgression,
  previewProgression,
  progressionSchema,
  type Progression,
} from "./progression";
import { previewProficiencies, resolveProficiencies } from "./proficiencies";
import { decodeBackup } from "./migrations";
import { makeCampaign } from "./campaign";
import {
  encodeBackup,
  initialAppWorkspace,
  makeDraft,
  saveDraftBuild,
} from "./workspace";

function fighter(): Progression {
  const p = emptyProgression();
  p.baseScores = { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 };
  p.levels[0].skills = ["athletics", "perception"];
  return p;
}
function rogue(): Progression {
  const p = fighter();
  p.levels[0] = {
    ...p.levels[0],
    classId: "rogue",
    skills: ["stealth", "perception", "investigation", "athletics"],
    expertise: ["stealth", "thievesTools"],
  };
  return p;
}
function add(p: Progression, classId: "fighter" | "rogue", count = 1) {
  for (let i = 0; i < count; i++)
    p.levels.push({
      classId,
      hp: "average",
      improvement: null,
      skills: [],
      expertise: [],
    });
}
const preview = (p: Progression) =>
  previewProficiencies(p, previewProgression(p));

describe("Владения классов 2014", () => {
  it("рассчитывает все навыки, пассивные значения и спасброски Воина с источниками", () => {
    const p = fighter();
    const before = structuredClone(p);
    const result = preview(p);
    expect(result.issues).toEqual([]);
    expect(result.checks).toHaveLength(18);
    expect(result.checks.find((c) => c.id === "athletics")).toMatchObject({
      check: { total: 4 },
      passive: 14,
      grants: [{ source: "Воин 1 · уровень 1", rank: "proficient" }],
    });
    expect(result.checks.find((c) => c.id === "deception")).toMatchObject({
      check: { total: -1 },
      passive: 9,
    });
    expect(
      result.savingThrows.filter((s) => s.grants.length).map((s) => s.id),
    ).toEqual(["str", "con"]);
    expect(result.gear.has("Тяжёлые доспехи")).toBe(true);
    expect(p).toEqual(before);
  });
  it("компетентность удваивает мастерство один раз; инструменты не получают выдуманную характеристику", () => {
    const result = preview(rogue());
    expect(result.valid).toBe(true);
    expect(result.checks.find((c) => c.id === "stealth")).toMatchObject({
      check: { total: 6 },
      passive: 16,
    });
    expect(result.grants.get("thievesTools")?.map((g) => g.rank)).toEqual([
      "proficient",
      "expertise",
    ]);
    expect(
      result.savingThrows.filter((s) => s.grants.length).map((s) => s.id),
    ).toEqual(["dex", "int"]);
  });
  it("второй Воин не даёт навыков, тяжёлых доспехов и новых спасбросков", () => {
    const p = rogue();
    p.allowMulticlass = true;
    add(p, "fighter");
    const result = preview(p);
    expect(result.valid).toBe(true);
    expect(result.levels[1].skillCount).toBe(0);
    expect(result.gear.has("Тяжёлые доспехи")).toBe(false);
    expect(result.gear.has("Средние доспехи")).toBe(true);
    expect(
      result.savingThrows.filter((s) => s.grants.length).map((s) => s.id),
    ).toEqual(["dex", "int"]);
  });
  it("второй Плут даёт один навык, инструменты и компетентность в прежнем навыке", () => {
    const p = fighter();
    p.allowMulticlass = true;
    add(p, "rogue");
    p.levels[1].skills = ["stealth"];
    p.levels[1].expertise = ["athletics", "thievesTools"];
    const result = preview(p);
    expect(result.valid).toBe(true);
    expect(result.levels[1].skillCount).toBe(1);
    expect(result.levels[1].skillOptions).not.toContain("perception");
    expect(result.checks.find((c) => c.id === "athletics")?.check?.total).toBe(
      6,
    );
    expect(result.gear.has("Рапиры")).toBe(false);
    expect(
      result.savingThrows.filter((s) => s.grants.length).map((s) => s.id),
    ).toEqual(["str", "con"]);
  });
  it("использует общий уровень для мастерства, уровень Плута для компетентности", () => {
    const p = rogue();
    p.allowMulticlass = true;
    add(p, "fighter");
    add(p, "rogue", 4);
    p.levels[4].improvement = { kind: "ability", first: "con", second: "con" };
    expect(resolveProficiencies(p).levels[5].expertiseCount).toBe(0); // total 6, rogue 5
    expect(
      preview(p).checks.find((c) => c.id === "stealth")?.check?.total,
    ).toBe(8);
    add(p, "rogue");
    p.levels[6].expertise = ["perception", "investigation"];
    expect(preview(p).valid).toBe(true);
    expect(preview(p).checks.find((c) => c.id === "perception")?.passive).toBe(
      17,
    );
    p.levels[6].expertise = ["stealth", "investigation"];
    expect(resolveProficiencies(p).issues.join()).toContain("недоступный");
  });
  it("не использует поздний навык для ранней компетентности", () => {
    const p = rogue();
    p.levels[0].expertise = ["history", "thievesTools"];
    add(p, "fighter");
    p.levels[1].skills = ["history", "survival"];
    const result = resolveProficiencies(p);
    expect(result.issues.join()).toContain(
      "Плут 1 · уровень 1: компетентность — есть недоступный",
    );
    expect(result.grants.has("history")).toBe(false);
  });
  it.each(["missing", "duplicate", "unavailable", "too-many", "wrong-level"])(
    "оставляет замечание вместо чисел: %s",
    (problem) => {
      const p = fighter();
      if (problem === "missing") p.levels[0].skills = [];
      if (problem === "duplicate")
        p.levels[0].skills = ["athletics", "athletics"];
      if (problem === "unavailable")
        p.levels[0].skills = ["arcana", "athletics"];
      if (problem === "too-many") p.levels[0].skills.push("history");
      if (problem === "wrong-level") {
        add(p, "fighter");
        p.levels[1].expertise = ["athletics", "perception"];
      }
      const before = structuredClone(p);
      const result = preview(p);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(
        result.checks.every((c) => c.check === null && c.passive === null),
      ).toBe(true);
      expect(p).toEqual(before);
    },
  );
  it("не показывает бонусы при неизвестной характеристике или запрещённом источнике", () => {
    const p = fighter();
    p.baseScores.dex = null;
    expect(preview(p).valid).toBe(false);
    const campaign = makeCampaign("c", "Игра");
    campaign.rules.sources.official2014 = false;
    const complete = fighter();
    expect(
      previewProficiencies(complete, previewProgression(complete, campaign))
        .valid,
    ).toBe(false);
  });
  it("смена раннего класса сохраняет прежние решения, убирает недоступные бонусы", () => {
    const p = rogue();
    p.levels[0].classId = "fighter";
    const result = preview(p);
    expect(result.valid).toBe(false);
    expect(p.levels[0].skills).toHaveLength(4);
    expect(p.levels[0].expertise).toEqual(["stealth", "thievesTools"]);
    expect(result.grants.has("thievesTools")).toBe(false);
    expect(
      result.savingThrows.filter((s) => s.grants.length).map((s) => s.id),
    ).toEqual(["str", "con"]);
  });
  it("Плут 15 получает владение спасброском Мудрости", () => {
    const p = rogue();
    add(p, "rogue", 13);
    expect(resolveProficiencies(p).saves.has("wis")).toBe(false);
    add(p, "rogue");
    expect(resolveProficiencies(p).saves.get("wis")?.[0].source).toContain(
      "Изворотливый ум",
    );
  });
  it.each(["skill", "expertise", "catalog", "missing-field"])(
    "импорт отклоняет повреждённые решения: %s",
    (problem) => {
      const raw = JSON.parse(JSON.stringify(rogue()));
      if (problem === "skill") raw.levels[0].skills = ["dex"];
      if (problem === "expertise") raw.levels[0].expertise = ["unknown"];
      if (problem === "catalog") raw.catalog = "srd-5.1-starter-1";
      if (problem === "missing-field") delete raw.levels[0].skills;
      expect(progressionSchema.safeParse(raw).success).toBe(false);
    },
  );
  it("сохраняет решения в копии и защищает их от устаревшей записи, сохраняя ресурсы", () => {
    const s = initialAppWorkspace();
    const c = makeDraft({
      id: "d",
      name: "Тест",
      ancestry: "Человек",
      className: "Плут",
    });
    c.build.maxHp = 30;
    c.runtime = { ...c.runtime, hp: 12, tempHp: 3, slotsRemaining: 0 };
    s.characters.push(c);
    const saved = saveDraftBuild(
      s,
      "d",
      { ...c.build, progression: rogue() },
      c.build,
    );
    const restored = decodeBackup(encodeBackup(saved));
    expect(restored).toEqual(saved);
    expect(restored.characters[1].runtime).toEqual(c.runtime);
    const baseline = structuredClone(restored.characters[1].build);
    restored.characters[1].build.progression!.levels[0].expertise = [
      "perception",
      "thievesTools",
    ];
    expect(() => saveDraftBuild(restored, "d", baseline, baseline)).toThrow(
      "другой вкладке",
    );
  });
});
