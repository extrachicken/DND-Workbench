import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, initialize, changeWorkspace } from "./db";
import { damage, initialWorkspace } from "./model";
beforeEach(async () => {
  await db.workspace.clear();
  await initialize();
});
describe("Локальное хранилище", () => {
  it("не сбрасывает существующее состояние при повторной инициализации", async () => {
    await changeWorkspace((s) => ({ ...s, hp: 12, slotsRemaining: 0 }));
    await initialize();
    expect((await db.workspace.get("local"))?.data.hp).toBe(12);
    expect((await db.workspace.get("local"))?.data.slotsRemaining).toBe(0);
  });
  it("последовательные транзакции не теряют быстрые изменения", async () => {
    await Promise.all([
      changeWorkspace((s) => damage(s, 5)),
      changeWorkspace((s) => damage(s, 7)),
    ]);
    expect((await db.workspace.get("local"))?.data.hp).toBe(18);
  });
  it("ошибочный импорт не повреждает сохранённые данные", async () => {
    await expect(changeWorkspace((s) => ({ ...s, hp: -1 }))).rejects.toThrow();
    expect((await db.workspace.get("local"))?.data).toEqual(initialWorkspace);
  });
});
