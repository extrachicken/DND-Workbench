import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  WorkbenchDB,
  initialize,
  changeWorkspace,
  replaceWorkspace,
} from "./db";
import { damage, initialWorkspace } from "./model";
import { initialAppWorkspace, makeDraft, updateSheet } from "./workspace";
let db: WorkbenchDB;
beforeEach(async () => {
  db = new WorkbenchDB(`test-${crypto.randomUUID()}`);
  await initialize(db);
});
afterEach(async () => {
  await db.delete();
});
describe("Локальное хранилище", () => {
  it("повторная инициализация не сбрасывает состояние", async () => {
    await changeWorkspace(
      (s) =>
        updateSheet(s, "gu-chen-demo", (v) => ({
          ...v,
          hp: 12,
          slotsRemaining: 0,
        })),
      db,
    );
    await initialize(db);
    expect(
      (await db.documents.get("local"))?.data.characters[0].sheet,
    ).toMatchObject({ hp: 12, slotsRemaining: 0 });
  });
  it("быстрые изменения не теряются между транзакциями", async () => {
    await Promise.all([
      changeWorkspace(
        (s) => updateSheet(s, "gu-chen-demo", (v) => damage(v, 5)),
        db,
      ),
      changeWorkspace(
        (s) => updateSheet(s, "gu-chen-demo", (v) => damage(v, 7)),
        db,
      ),
    ]);
    expect((await db.documents.get("local"))?.data.characters[0].sheet.hp).toBe(
      18,
    );
  });
  it("ошибочная запись не повреждает сохранённый лист", async () => {
    await expect(
      changeWorkspace(
        (s) => updateSheet(s, "gu-chen-demo", (v) => ({ ...v, hp: -1 })),
        db,
      ),
    ).rejects.toThrow();
    expect((await db.documents.get("local"))?.data).toEqual(
      initialAppWorkspace(),
    );
  });
  it("импорт сохраняет предыдущую версию для восстановления", async () => {
    const imported = initialAppWorkspace();
    imported.characters.push(
      makeDraft({
        id: "new",
        name: "Имя",
        ancestry: "Эльф",
        className: "Бард",
      }),
    );
    await replaceWorkspace(imported, db);
    expect((await db.recovery.get("before-import"))?.data).toEqual(
      initialAppWorkspace(),
    );
    expect((await db.documents.get("local"))?.data).toEqual(imported);
  });
  it("некорректный импорт не меняет данные или точку восстановления", async () => {
    const bad = initialAppWorkspace();
    bad.activeCharacterId = "missing";
    await expect(replaceWorkspace(bad, db)).rejects.toThrow();
    expect(await db.recovery.count()).toBe(0);
    expect((await db.documents.get("local"))?.data).toEqual(
      initialAppWorkspace(),
    );
  });
  it("ошибка создания снимка откатывает весь импорт", async () => {
    const fail = () => {
      throw new Error("quota");
    };
    db.recovery.hook("creating", fail);
    try {
      await expect(
        replaceWorkspace({ ...initialAppWorkspace(), metric: true }, db),
      ).rejects.toThrow();
    } finally {
      db.recovery.hook("creating").unsubscribe(fail);
    }
    expect((await db.documents.get("local"))?.data.metric).toBe(false);
    expect(await db.recovery.count()).toBe(0);
  });
});
describe("Реальное обновление IndexedDB с v1 на v2", () => {
  it("атомарно переносит v1 и сохраняет нетронутую копию", async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const legacyDb = new Dexie(name);
    legacyDb.version(1).stores({ workspace: "id" });
    const data = {
      ...initialWorkspace,
      hp: 12,
      tempHp: 3,
      slotsRemaining: 0,
      drafts: [
        { id: "d", name: "Другой", ancestry: "Эльф", className: "Бард" },
      ],
    };
    await legacyDb.table("workspace").put({ id: "local", data });
    legacyDb.close();
    const migratedDb = new WorkbenchDB(name);
    try {
      await initialize(migratedDb);
      const value = (await migratedDb.documents.get("local"))!.data;
      expect(value.characters).toHaveLength(2);
      expect(value.characters[0].sheet).toMatchObject({
        hp: 12,
        tempHp: 3,
        slotsRemaining: 0,
      });
      expect((await migratedDb.recovery.get("migration-v1"))?.data).toEqual(
        data,
      );
      expect((await migratedDb.workspace.get("local"))?.data).toEqual(data);
      migratedDb.close();
      await migratedDb.open();
      await initialize(migratedDb);
      expect(await migratedDb.recovery.count()).toBe(1);
    } finally {
      await migratedDb.delete();
    }
  });
  it("повреждённая v1 не заменяется пустым рабочим пространством", async () => {
    const name = `invalid-${crypto.randomUUID()}`;
    const legacyDb = new Dexie(name);
    legacyDb.version(1).stores({ workspace: "id" });
    await legacyDb
      .table("workspace")
      .put({ id: "local", data: { ...initialWorkspace, hp: -1 } });
    legacyDb.close();
    const migratedDb = new WorkbenchDB(name);
    try {
      await expect(initialize(migratedDb)).rejects.toThrow();
      migratedDb.close();
      await legacyDb.open();
      expect((await legacyDb.table("workspace").get("local")).data.hp).toBe(-1);
    } finally {
      legacyDb.close();
      await Dexie.delete(name);
    }
  });
});
