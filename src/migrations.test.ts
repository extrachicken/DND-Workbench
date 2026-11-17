import { describe, expect, it } from "vitest";
import { decodeBackup, migrateV2 } from "./migrations";
import { initialLegacyWorkspace, legacyV2Fixture } from "./test-fixtures";
import {
  encodeBackup,
  initialAppWorkspace,
  makeDraft,
  MAX_BACKUP_BYTES,
} from "./workspace";
import { deriveDemoStats } from "./demo";
import { damage } from "./model";

describe("Разделение сборки, состояния и вычислений", () => {
  it("переносит все поля v2 и архив, сохраняя нулевые и неизвестные ресурсы", () => {
    const old = legacyV2Fixture();
    old.metric = true;
    old.characters[0].sheet = {
      ...old.characters[0].sheet,
      hp: 12,
      maxHp: 41,
      tempHp: 3,
      slotsRemaining: 0,
      lore: "История",
      portrait: "data:image/png;base64,YQ==",
      inventory: [{ id: "i", name: "Факел", quantity: 0, equipped: true }],
    };
    old.characters.push({
      ...structuredClone(old.characters[0]),
      id: "archive",
      kind: "draft",
      name: "Другой",
      archivedAt: "2026-11-14T00:00:00.000Z",
    });
    old.characters[1].sheet.slotsRemaining = null;
    const moved = migrateV2(old);
    expect(moved.version).toBe(6);
    expect(moved.metric).toBe(true);
    expect(moved.activeCharacterId).toBe(old.activeCharacterId);
    for (const [i, character] of moved.characters.entries()) {
      const previous = old.characters[i];
      expect(character).toEqual({
        id: previous.id,
        kind: previous.kind,
        archivedAt: previous.archivedAt,
        build: {
          name: previous.name,
          ancestry: previous.ancestry,
          className: previous.className,
          lore: previous.sheet.lore,
          portrait: previous.sheet.portrait,
          maxHp: previous.sheet.maxHp,
          campaignId: null,
          progression: null,
        },
        runtime: {
          hp: previous.sheet.hp,
          tempHp: previous.sheet.tempHp,
          slotsRemaining: previous.sheet.slotsRemaining,
          inventory: previous.sheet.inventory,
        },
      });
    }
    expect(decodeBackup(JSON.stringify(old))).toEqual(moved);
    expect(decodeBackup(encodeBackup(moved))).toEqual(moved);
  });
  it("расчёт не меняет сборку, расход ресурсов и инвентарь", () => {
    const character = initialAppWorkspace().characters[0];
    character.build.maxHp = 41;
    character.runtime = { ...damage(character.runtime, 7), slotsRemaining: 0 };
    const before = structuredClone(character);
    for (let i = 0; i < 5; i++) {
      expect(deriveDemoStats(character)).toMatchObject({
        maxHp: 41,
        slotsMax: 2,
        armorClass: 16,
        initiative: 8,
      });
    }
    expect(character).toEqual(before);
    const backup = JSON.parse(
      encodeBackup({ ...initialAppWorkspace(), characters: [character] }),
    );
    expect(backup.characters[0]).not.toHaveProperty("derived");
    expect(backup.characters[0]).not.toHaveProperty("sheet");
  });
  it("черновик не получает вычисленные характеристики Гу Ченя", () => {
    expect(
      deriveDemoStats(
        makeDraft({
          id: "d",
          name: "Другой",
          ancestry: "Эльф",
          className: "Бард",
        }),
      ),
    ).toBeNull();
  });
  it.each([0, null])(
    "не сбрасывает остаток %s при импорте v1 и v3",
    (slotsRemaining) => {
      const moved = decodeBackup(
        JSON.stringify({ ...initialLegacyWorkspace, slotsRemaining }),
      );
      expect(moved.characters[0].runtime.slotsRemaining).toBe(slotsRemaining);
      expect(decodeBackup(encodeBackup(moved))).toEqual(moved);
    },
  );
  it.each([
    { slotsRemaining: 3 },
    { hp: 31 },
    { tempHp: -1 },
    { portrait: "javascript:alert(1)" },
    {
      notes: [
        { id: "1", title: "t", campaign: "c", text: "", date: "invalid" },
      ],
    },
  ])("отклоняет испорченную v1 %j", (patch) => {
    expect(() =>
      decodeBackup(JSON.stringify({ ...initialLegacyWorkspace, ...patch })),
    ).toThrow();
  });
  it.each(["duplicate", "missing", "archived", "hp"])(
    "проверяет инварианты v2: %s",
    (problem) => {
      const old = legacyV2Fixture();
      if (problem === "duplicate")
        old.characters.push(structuredClone(old.characters[0]));
      if (problem === "missing") old.activeCharacterId = "missing";
      if (problem === "archived")
        old.characters[0].archivedAt = "2026-11-14T00:00:00.000Z";
      if (problem === "hp") old.characters[0].sheet.hp = 31;
      expect(() => decodeBackup(JSON.stringify(old))).toThrow();
    },
  );
  it("ограничивает импорт по байтам UTF-8, а не числу символов", () => {
    expect(() => decodeBackup("я".repeat(MAX_BACKUP_BYTES / 2 + 1))).toThrow(
      "50 МБ",
    );
  });
  it("отклоняет экспорт, превышающий 50 МБ", () => {
    const s = initialAppWorkspace();
    for (let i = 0; i < 18; i++) {
      const character = makeDraft({
        id: "large-" + i,
        name: "Имя",
        ancestry: "Человек",
        className: "Воин",
      });
      character.build.portrait =
        "data:image/png;base64," + "A".repeat(2_900_000);
      s.characters.push(character);
    }
    expect(() => encodeBackup(s)).toThrow("50 МБ");
  });
});
