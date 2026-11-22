import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { WorkbenchDB, initialize, replaceWorkspace } from "./db";
import { jsonBytes } from "./backup-size";
import { emptyProgression } from "./progression";
import { decodeBackup, migrateV5 } from "./migrations";
import { initialAppWorkspace, makeDraft } from "./workspace";
import { makeCampaign } from "./campaign";

function oldWorkspace() {
  const current = initialAppWorkspace();
  current.campaigns = [makeCampaign("c", "Учебная игра")];
  current.notes = [
    {
      id: "n",
      title: "Запись",
      text: "История",
      campaignId: "c",
      date: "2026-11-17T10:00:00.000Z",
    },
  ];
  const draft = makeDraft({
    id: "d",
    name: "Архив",
    ancestry: "Человек",
    className: "Воин",
  });
  draft.archivedAt = "2026-11-17T10:00:00.000Z";
  draft.build = {
    ...draft.build,
    campaignId: "c",
    portrait: "data:image/png;base64,YQ==",
    lore: "История",
    maxHp: 30,
    progression: emptyProgression(),
  };
  draft.runtime = {
    hp: 12,
    tempHp: 3,
    slotsRemaining: 0,
    inventory: [{ id: "i", name: "Факел", quantity: 0, equipped: true }],
  };
  current.characters.push(draft);
  return {
    ...current,
    version: 5,
    characters: current.characters.map((c) => ({
      ...c,
      build: {
        ...c.build,
        progression: c.build.progression
          ? {
              ...c.build.progression,
              catalog: "srd-5.1-starter-1",
              levels: c.build.progression.levels.map(
                ({ skills: _skills, expertise: _expertise, ...level }) => level,
              ),
            }
          : null,
      },
    })),
  };
}
describe("Миграция v5 → v6", () => {
  it("импорт переносит известные решения и добавляет только пустые выборы", () => {
    const old = oldWorkspace();
    const before = structuredClone(old);
    const moved = migrateV5(old);
    expect(moved.version).toBe(7);
    expect(moved.characters[0]).toEqual(old.characters[0]);
    const p = moved.characters[1].build.progression!;
    expect(p.catalog).toBe("srd-5.1-starter-2");
    expect(p.levels[0]).toEqual({
      ...old.characters[1].build.progression!.levels[0],
      skills: [],
      expertise: [],
    });
    expect({
      ...moved.characters[1],
      build: { ...moved.characters[1].build, progression: null },
    }).toEqual({
      ...old.characters[1],
      build: { ...old.characters[1].build, progression: null },
    });
    expect(decodeBackup(JSON.stringify(old))).toEqual(moved);
    expect(old).toEqual(before);
  });
  it.each(["success", "invalid-data", "snapshot-failure", "size-limit"])(
    "обновляет БД атомарно: %s",
    async (outcome) => {
      const data = oldWorkspace();
      if (outcome === "invalid-data")
        data.characters[1].build.campaignId = "missing";
      if (outcome === "size-limit") {
        for (let i = 0; i < 18; i++) {
          const c = structuredClone(data.characters[1]);
          c.id = `large-${i}`;
          c.build.portrait = "data:image/png;base64," + "A".repeat(2_900_000);
          data.characters.push(c);
        }
      }
      const name = `proficiencies-${crypto.randomUUID()}`;
      const old = new Dexie(name);
      old.version(6).stores({ documents: "id", recovery: "id,createdAt" });
      const document = { id: "local", data, backupBytes: jsonBytes(data) };
      const prior = {
        id: "before-import",
        reason: "before-import",
        createdAt: "2026-11-17T10:00:00.000Z",
        data: { version: 1 },
      };
      await old.table("documents").put(document);
      await old.table("recovery").put(prior);
      old.close();
      const next = new WorkbenchDB(name);
      if (outcome === "snapshot-failure")
        next.recovery.hook("creating", () => {
          throw new Error("quota");
        });
      try {
        if (outcome === "success") {
          await initialize(next);
          const saved = (await next.documents.get("local"))!;
          expect(next.verno).toBe(8);
          expect(saved.data).toEqual(migrateV5(data));
          expect(saved.backupBytes).toBe(jsonBytes(saved.data));
          expect((await next.recovery.get("migration-v5"))?.data).toEqual(data);
          expect(await next.recovery.get("before-import")).toEqual(prior);
          expect(await next.recovery.count()).toBe(2);
          next.close();
          await next.open();
          await initialize(next);
          expect(await next.documents.get("local")).toEqual(saved);
          await replaceWorkspace(decodeBackup(JSON.stringify(data)), next);
          expect((await next.documents.get("local"))?.data).toEqual(saved.data);
          expect((await next.recovery.get("before-import"))?.data).toEqual(
            saved.data,
          );
        } else {
          await expect(initialize(next)).rejects.toThrow();
          next.close();
          await old.open();
          expect(old.verno).toBe(6);
          expect(await old.table("documents").get("local")).toEqual(document);
          expect(await old.table("recovery").toArray()).toEqual([prior]);
        }
      } finally {
        next.close();
        old.close();
        await Dexie.delete(name);
      }
    },
  );
});
