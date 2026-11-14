import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  WorkbenchDB,
  initialize,
  changeWorkspace,
  replaceWorkspace,
} from "./db";
import { damage } from "./model";
import { initialLegacyWorkspace as initialWorkspace } from "./test-fixtures";
import { initialAppWorkspace, makeDraft, updateCharacter } from "./workspace";
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
        updateCharacter(s, "gu-chen-demo", (v) => ({
          ...v,
          runtime: { ...v.runtime, hp: 12, slotsRemaining: 0 },
        })),
      db,
    );
    await initialize(db);
    expect(
      (await db.documents.get("local"))?.data.characters[0].runtime,
    ).toMatchObject({ hp: 12, slotsRemaining: 0 });
  });
  it("быстрые изменения не теряются между транзакциями", async () => {
    await Promise.all([
      changeWorkspace(
        (s) =>
          updateCharacter(s, "gu-chen-demo", (v) => ({
            ...v,
            runtime: damage(v.runtime, 5),
          })),
        db,
      ),
      changeWorkspace(
        (s) =>
          updateCharacter(s, "gu-chen-demo", (v) => ({
            ...v,
            runtime: damage(v.runtime, 7),
          })),
        db,
      ),
    ]);
    expect(
      (await db.documents.get("local"))?.data.characters[0].runtime.hp,
    ).toBe(18);
  });
  it("ошибочная запись не повреждает сохранённый лист", async () => {
    await expect(
      changeWorkspace(
        (s) =>
          updateCharacter(s, "gu-chen-demo", (v) => ({
            ...v,
            runtime: { ...v.runtime, hp: -1 },
          })),
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
describe("Реальное обновление IndexedDB с v1 на v3", () => {
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
      expect(value.characters[0].runtime).toMatchObject({
        hp: 12,
        tempHp: 3,
        slotsRemaining: 0,
      });
      expect((await migratedDb.recovery.get("migration-v1"))?.data).toEqual(
        data,
      );
      expect(migratedDb.tables.map((t) => t.name).sort()).toEqual([
        "documents",
        "recovery",
      ]);
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

describe("Обновление v2 до единого хранилища", () => {
  it("переносит v2, сохраняет оба исходных снимка и удаляет только старую таблицу", async () => {
    const { legacyV2Fixture } = await import("./test-fixtures");
    const data = legacyV2Fixture();
    data.characters[0].sheet.hp = 11;
    data.characters[0].sheet.slotsRemaining = 0;
    const name = `v2-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old
      .version(2)
      .stores({ workspace: "id", documents: "id", recovery: "id,createdAt" });
    await old.table("workspace").put({ id: "local", data: initialWorkspace });
    await old.table("documents").put({ id: "local", data });
    const snapshot = {
      id: "before-import",
      reason: "before-import",
      createdAt: "2026-11-14T00:00:00.000Z",
      data: initialWorkspace,
    };
    await old.table("recovery").put(snapshot);
    old.close();
    const next = new WorkbenchDB(name);
    try {
      await initialize(next);
      expect(next.tables.map((t) => t.name).sort()).toEqual([
        "documents",
        "recovery",
      ]);
      expect(
        (await next.documents.get("local"))?.data.characters[0].runtime,
      ).toMatchObject({ hp: 11, slotsRemaining: 0 });
      expect((await next.recovery.get("migration-v2"))?.data).toEqual(data);
      expect((await next.recovery.get("migration-v1"))?.data).toEqual(
        initialWorkspace,
      );
      expect(await next.recovery.get("before-import")).toEqual(snapshot);
      next.close();
      await next.open();
      await initialize(next);
      expect(await next.recovery.count()).toBe(3);
    } finally {
      await next.delete();
    }
  });
  it.each(["invalid-data", "snapshot-failure"])(
    "откатывает схему и данные при %s",
    async (failure) => {
      const { legacyV2Fixture } = await import("./test-fixtures");
      const data = legacyV2Fixture();
      if (failure === "invalid-data") data.characters[0].sheet.hp = -1;
      const name = `v2-failed-${crypto.randomUUID()}`;
      const old = new Dexie(name);
      old
        .version(2)
        .stores({ workspace: "id", documents: "id", recovery: "id,createdAt" });
      await old.table("documents").put({ id: "local", data });
      await old.table("workspace").put({ id: "local", data: initialWorkspace });
      old.close();
      const next = new WorkbenchDB(name);
      if (failure === "snapshot-failure")
        next.recovery.hook("creating", () => {
          throw new Error("quota");
        });
      try {
        await expect(initialize(next)).rejects.toThrow();
        next.close();
        await old.open();
        expect(old.verno).toBe(2);
        expect((await old.table("documents").get("local")).data).toEqual(data);
        expect((await old.table("workspace").get("local")).data).toEqual(
          initialWorkspace,
        );
        expect(await old.table("recovery").count()).toBe(0);
      } finally {
        old.close();
        next.close();
        await Dexie.delete(name);
      }
    },
  );
});

it("размер экспорта остаётся точным при конкурентных транзакциях и импорте", async () => {
  const { encodeBackup } = await import("./workspace");
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      changeWorkspace(
        (s) =>
          updateCharacter(s, "gu-chen-demo", (c) => ({
            ...c,
            build: { ...c.build, lore: c.build.lore + `\n🧙 ${i}` },
          })),
        db,
      ),
    ),
  );
  const stored = (await db.documents.get("local"))!;
  expect(stored.backupBytes).toBe(
    new TextEncoder().encode(encodeBackup(stored.data)).byteLength,
  );
  await replaceWorkspace({ ...stored.data, metric: true }, db);
  const imported = (await db.documents.get("local"))!;
  expect(imported.backupBytes).toBe(
    new TextEncoder().encode(encodeBackup(imported.data)).byteLength,
  );
});
it("превышение размера отменяет данные и счётчик в одной транзакции", async () => {
  const { jsonBytes } = await import("./backup-size");
  const { MAX_BACKUP_BYTES } = await import("./workspace");
  const state = initialAppWorkspace();
  for (let i = 0; i < 17; i++) {
    const c = makeDraft({
      id: "large-" + i,
      name: "Имя",
      ancestry: "Человек",
      className: "Воин",
    });
    c.build.portrait = "data:image/png;base64," + "A".repeat(2_900_000);
    state.characters.push(c);
  }
  // Keep < 50 MB; adding one valid portrait must exceed the export limit.
  const bytes = jsonBytes(state);
  expect(bytes).toBeLessThan(MAX_BACKUP_BYTES);
  await replaceWorkspace(state, db);
  await expect(
    changeWorkspace(
      (s) =>
        updateCharacter(s, "gu-chen-demo", (c) => ({
          ...c,
          build: {
            ...c.build,
            portrait: "data:image/png;base64," + "A".repeat(2_900_000),
          },
        })),
      db,
    ),
  ).rejects.toThrow("50 МБ");
  const stored = (await db.documents.get("local"))!;
  expect(stored.backupBytes).toBe(bytes);
  expect(stored.data.characters[0].build.portrait).toBe("");
});

it("не допускает изменения базы сравнения размера через мутацию callback", async () => {
  await expect(
    changeWorkspace((s) => {
      s.characters[0].build.lore += "Незаметное изменение";
      return s;
    }, db),
  ).rejects.toThrow();
  const stored = (await db.documents.get("local"))!;
  expect(stored.data).toEqual(initialAppWorkspace());
  const { jsonBytes } = await import("./backup-size");
  expect(stored.backupBytes).toBe(jsonBytes(stored.data));
});
