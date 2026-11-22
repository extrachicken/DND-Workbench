import { describe, expect, it } from "vitest";
import { damage } from "./model";
import { initialLegacyWorkspace as initialWorkspace } from "./test-fixtures";
import { decodeBackup, migrateLegacy } from "./migrations";
import {
  activeCharacter,
  appWorkspaceSchema,
  archiveCharacter,
  encodeBackup,
  initialAppWorkspace,
  makeDraft,
  restoreCharacter,
  selectCharacter,
  saveDraftBuild,
  updateCharacter,
} from "./workspace";
const draft = () =>
  makeDraft({
    id: "test",
    name: "Элиан",
    ancestry: "Эльф",
    className: "Волшебник",
  });
describe("Версия 4 — перенос и резервные копии", () => {
  it("переносит весь лист, записи и черновики, не восстанавливая ячейки", () => {
    const legacy = {
      ...initialWorkspace,
      hp: 12,
      tempHp: 5,
      slotsRemaining: 0,
      lore: "История",
      portrait: "data:image/png;base64,YQ==",
      metric: true,
      inventory: [{ id: "i", name: "Факел", quantity: 3, equipped: false }],
      notes: [
        {
          id: "n",
          title: "Сессия",
          campaign: "Кампания",
          text: "Текст",
          date: "2026-11-14T00:00:00.000Z",
        },
      ],
      drafts: [
        {
          id: "gu-chen-demo",
          name: "Элиан",
          ancestry: "Эльф",
          className: "Волшебник",
        },
      ],
    };
    const moved = migrateLegacy(legacy);
    expect(moved.characters).toHaveLength(2);
    expect(moved.notes).toEqual(
      legacy.notes.map(({ campaign: _, ...note }) => ({
        ...note,
        campaignId: moved.campaigns[0].id,
      })),
    );
    expect(moved.campaigns[0].name).toBe(legacy.notes[0].campaign);
    expect(moved.metric).toBe(true);
    expect(moved.characters[0].runtime).toEqual({
      hp: 12,
      tempHp: 5,
      slotsRemaining: 0,
      inventory: legacy.inventory,
    });
    expect(moved.characters[0].build).toMatchObject({
      maxHp: 30,
      lore: "История",
      portrait: legacy.portrait,
    });
    expect(moved.characters[1].kind).toBe("draft");
    expect(moved.characters[1].build.name).toBe("Элиан");
    expect(moved.characters[1].build.lore).toBe("");
    expect(decodeBackup(JSON.stringify(legacy))).toEqual(moved);
  });
  it("сохраняет повторявшиеся ID старых черновиков как разные записи", () => {
    const d = { id: "same", name: "Имя", ancestry: "", className: "" };
    const moved = migrateLegacy({ ...initialWorkspace, drafts: [d, d] });
    expect(new Set(moved.characters.map((c) => c.id)).size).toBe(3);
  });
  it("версия 3 проходит экспорт и импорт вместе с архивом", () => {
    const s = archiveCharacter(
      {
        ...initialAppWorkspace(),
        characters: [...initialAppWorkspace().characters, draft()],
      },
      "test",
    );
    expect(decodeBackup(encodeBackup(s))).toEqual(s);
  });
  it("отклоняет неизвестные версии", () =>
    expect(() => decodeBackup('{"version":4}')).toThrow());
  it("отклоняет дублирующиеся ID", () => {
    const s = initialAppWorkspace();
    expect(() =>
      appWorkspaceSchema.parse({
        ...s,
        characters: [...s.characters, ...s.characters],
      }),
    ).toThrow();
  });
  it("отклоняет ссылку на отсутствующего персонажа", () =>
    expect(() =>
      appWorkspaceSchema.parse({
        ...initialAppWorkspace(),
        activeCharacterId: "missing",
      }),
    ).toThrow());
  it("отклоняет ссылку на архивированного персонажа", () => {
    const s = archiveCharacter(initialAppWorkspace(), "gu-chen-demo");
    expect(() =>
      appWorkspaceSchema.parse({ ...s, activeCharacterId: "gu-chen-demo" }),
    ).toThrow();
  });
  it("отклоняет испорченные хиты внутри вложенного листа", () => {
    const s = initialAppWorkspace();
    s.characters[0].runtime.hp = 31;
    expect(() => decodeBackup(JSON.stringify(s))).toThrow();
  });
});
describe("Несколько персонажей", () => {
  it("изменяет только выбранный лист, не сбрасывая другой", () => {
    const s = {
      ...initialAppWorkspace(),
      characters: [...initialAppWorkspace().characters, draft()],
    };
    const changed = updateCharacter(s, "gu-chen-demo", (v) => ({
      ...v,
      runtime: damage(v.runtime, 5),
    }));
    expect(changed.characters[0].runtime.hp).toBe(25);
    expect(changed.characters[1]).toEqual(s.characters[1]);
  });
  it("запись захватывает исходного персонажа, даже если выбор изменился", () => {
    const s = selectCharacter(
      {
        ...initialAppWorkspace(),
        characters: [...initialAppWorkspace().characters, draft()],
      },
      "test",
    );
    const changed = updateCharacter(s, "gu-chen-demo", (v) => ({
      ...v,
      build: { ...v.build, lore: "Новая история" },
    }));
    expect(changed.activeCharacterId).toBe("test");
    expect(changed.characters[0].build.lore).toBe("Новая история");
    expect(changed.characters[1].build.lore).toBe("");
  });
  it("архив сохраняет данные и выбирает следующего", () => {
    const s = {
      ...initialAppWorkspace(),
      characters: [...initialAppWorkspace().characters, draft()],
    };
    const archived = archiveCharacter(s, "gu-chen-demo");
    expect(archived.activeCharacterId).toBe("test");
    expect(archived.characters[0].runtime).toEqual(s.characters[0].runtime);
    const restored = restoreCharacter(archived, "gu-chen-demo");
    expect(restored.characters[0]).toEqual(s.characters[0]);
    expect(restored.activeCharacterId).toBe("test");
  });
  it("можно архивировать последнего и восстановить его", () => {
    const s = archiveCharacter(initialAppWorkspace(), "gu-chen-demo");
    expect(s.activeCharacterId).toBeNull();
    expect(activeCharacter(s)).toBeUndefined();
    expect(restoreCharacter(s, "gu-chen-demo").activeCharacterId).toBe(
      "gu-chen-demo",
    );
  });
  it("не даёт выбрать архивированного или отсутствующего персонажа", () => {
    const s = archiveCharacter(initialAppWorkspace(), "gu-chen-demo");
    expect(() => selectCharacter(s, "gu-chen-demo")).toThrow();
    expect(() => selectCharacter(s, "missing")).toThrow();
  });
});

it("не записывает отложенное изменение в архивированного персонажа", () => {
  const s = archiveCharacter(initialAppWorkspace(), "gu-chen-demo");
  expect(() =>
    updateCharacter(s, "gu-chen-demo", (v) => ({
      ...v,
      build: { ...v.build, lore: "Поздняя запись" },
    })),
  ).toThrow();
});

it("сохранение из старой вкладки сохраняет добавленную предысторию", () => {
  const c = draft();
  const s = initialAppWorkspace();
  s.characters.push(c);
  const updated = saveDraftBuild(
    s,
    c.id,
    { ...c.build, background: "Мудрец" },
    c.build,
  );
  expect(() =>
    saveDraftBuild(updated, c.id, { ...c.build, lore: "Новый текст" }, c.build),
  ).toThrow("другой вкладке");
  expect(
    decodeBackup(encodeBackup(updated)).characters.at(-1)?.build.background,
  ).toBe("Мудрец");
});
