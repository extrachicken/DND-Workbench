import { describe, expect, it } from "vitest";
import { campaignLabel, makeCampaign } from "./campaign";
import { decodeBackup, migrateV3 } from "./migrations";
import {
  initialLegacyWorkspace,
  legacyV2Fixture,
  legacyV3Fixture,
} from "./test-fixtures";
import {
  appWorkspaceSchema,
  encodeBackup,
  initialAppWorkspace,
  saveCampaign,
} from "./workspace";

const notes = ["Долина", "Долина", "долина", "Без кампании", " Долина "].map(
  (campaign, i) => ({
    id: String(i),
    title: `Сессия ${i}`,
    campaign,
    text: `Заметка ${i}`,
    date: "2026-11-14T12:00:00.000Z",
  }),
);
describe("Профили кампаний", () => {
  it("переносит прежнюю группировку по точному названию без потери текста и ресурсов", () => {
    const old = legacyV3Fixture();
    old.notes = notes;
    old.characters[0].runtime.hp = 12;
    old.characters[0].runtime.slotsRemaining = 0;
    const before = structuredClone(old);
    const moved = migrateV3(old);
    expect(moved.characters).toEqual(
      old.characters.map((c) => ({
        ...c,
        build: { ...c.build, campaignId: null, progression: null },
      })),
    );
    expect(moved.campaigns.map((c) => c.name)).toEqual([
      "Долина",
      "долина",
      "Без кампании",
      " Долина ",
    ]);
    expect(moved.notes[0].campaignId).toBe(moved.notes[1].campaignId);
    for (const [i, note] of moved.notes.entries()) {
      const { campaign, ...original } = old.notes[i];
      expect(note).toEqual({
        ...original,
        campaignId: moved.campaigns.find((c) => c.name === campaign)!.id,
      });
      expect(note).not.toHaveProperty("campaign");
    }
    expect(old).toEqual(before);
    expect(decodeBackup(encodeBackup(moved))).toEqual(moved);
  });
  it.each([1, 2, 3])(
    "импорт v%s переносит сессии в текущую модель",
    (version) => {
      const old =
        version === 1
          ? { ...initialLegacyWorkspace, notes }
          : version === 2
            ? { ...legacyV2Fixture(), notes }
            : { ...legacyV3Fixture(), notes };
      const moved = decodeBackup(JSON.stringify(old));
      expect(moved.version).toBe(8);
      expect(moved.campaigns).toHaveLength(4);
      expect(moved.notes).toHaveLength(5);
      expect(decodeBackup(encodeBackup(moved))).toEqual(moved);
    },
  );
  it("переименование и смена правил сохраняют связи с сессиями и другие кампании", () => {
    const s = migrateV3({ ...legacyV3Fixture(), notes });
    const original = s.campaigns[0];
    const next = {
      ...original,
      name: "Новое имя",
      kind: "one-shot" as const,
      rules: {
        ...original.rules,
        extraFeat: true,
        sources: { official2014: false, homebrew: true },
        sourceNotes: "Савант: версия мастера",
      },
    };
    const result = saveCampaign(s, next, original);
    expect(result.notes).toEqual(s.notes);
    expect(result.characters).toEqual(s.characters);
    expect(result.campaigns.slice(1)).toEqual(s.campaigns.slice(1));
    expect(decodeBackup(encodeBackup(result))).toEqual(result);
    const newCampaign = makeCampaign("new", "Ещё одна");
    expect(newCampaign.rules.extraFeat).toBe(false);
    expect(newCampaign.rules.sources.homebrew).toBe(false);
  });
  it("одноимённые кампании различаются по ID и подписи", () => {
    const campaigns = [
      makeCampaign("a", "Долина"),
      makeCampaign("b", "Долина"),
    ];
    expect(campaignLabel(campaigns[0], campaigns)).not.toBe(
      campaignLabel(campaigns[1], campaigns),
    );
    const s = {
      ...initialAppWorkspace(),
      campaigns,
      notes: notes.slice(0, 2).map(({ campaign: _, ...n }, i) => ({
        ...n,
        campaignId: campaigns[i].id,
      })),
    };
    expect(decodeBackup(encodeBackup(s))).toEqual(s);
  });
  it("защищает профиль от устаревшей вкладки, сохраняя независимые изменения", () => {
    const initial = makeCampaign("c", "Кампания");
    const s = saveCampaign(initialAppWorkspace(), initial);
    const updated = saveCampaign(s, { ...initial, name: "Новое имя" }, initial);
    expect(() =>
      saveCampaign(updated, { ...initial, description: "Устаревшее" }, initial),
    ).toThrow("другой вкладке");
    expect(() => saveCampaign(updated, initial)).toThrow();
    expect(() =>
      saveCampaign(initialAppWorkspace(), initial, initial),
    ).toThrow();
    const otherChange = { ...s, metric: true };
    expect(
      saveCampaign(otherChange, { ...initial, description: "Текст" }, initial)
        .metric,
    ).toBe(true);
  });
  it.each(["duplicate", "missing", "edition", "feat", "sources"])(
    "отклоняет некорректный профиль или связь: %s",
    (problem) => {
      const s = migrateV3({ ...legacyV3Fixture(), notes });
      const bad = JSON.parse(JSON.stringify(s));
      if (problem === "duplicate") bad.campaigns.push(bad.campaigns[0]);
      if (problem === "missing") bad.notes[0].campaignId = "absent";
      if (problem === "edition") bad.campaigns[0].rules.edition = "2024";
      if (problem === "feat") delete bad.campaigns[0].rules.extraFeat;
      if (problem === "sources")
        bad.campaigns[0].rules.sources.homebrew = "yes";
      expect(() => decodeBackup(JSON.stringify(bad))).toThrow();
    },
  );
  it("позволяет сессию без кампании и проверяет лимит профилей", () => {
    const s = initialAppWorkspace();
    const { campaign: _, ...note } = notes[0];
    s.notes = [{ ...note, campaignId: null }];
    expect(appWorkspaceSchema.parse(s)).toEqual(s);
    s.campaigns = Array.from({ length: 1001 }, (_, i) =>
      makeCampaign(String(i), "Кампания"),
    );
    expect(() => appWorkspaceSchema.parse(s)).toThrow();
  });
});
