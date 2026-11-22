import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { initialAppWorkspace, makeDraft, encodeBackup } from "./workspace";
import { emptyProgression } from "./progression";
import { makeCampaign } from "./campaign";
import { decodeBackup } from "./migrations";
import { WorkbenchDB, initialize } from "./db";
import { jsonBytes } from "./backup-size";
import { startPlay, takeDamage, undoDamage } from "./play";

function setup() {
  const s = initialAppWorkspace();
  const c = makeDraft({
    id: "hero",
    name: "Лира",
    ancestry: "Человек",
    className: "Воин 1",
  });
  const p = emptyProgression();
  p.baseScores = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 };
  p.levels[0].skills = ["athletics", "perception"];
  c.build.progression = p;
  s.characters.push(c);
  return { s, c, p };
}

it("запускает только сохранённую полную сборку с явными ресурсами", () => {
  const { s, c, p } = setup();
  expect(() => startPlay(s, c, 13, 0)).toThrow();
  expect(() => startPlay(s, c, 1, -1)).toThrow();
  const playing = startPlay(s, c, 0, 3);
  expect(playing.characters[1]).toMatchObject({
    kind: "player",
    build: { maxHp: 12 },
    runtime: { hp: 0, tempHp: 3 },
  });
  expect(playing.characters[0]).toEqual(s.characters[0]);
  expect(() => startPlay(playing, c, 12, 0)).toThrow();
  expect(() =>
    startPlay(s, { ...c, build: { ...c.build, name: "прежнее имя" } }, 12, 0),
  ).toThrow();
  const campaign = makeCampaign("c", "Игра");
  campaign.rules.sources.official2014 = false;
  s.campaigns.push(campaign);
  c.build.campaignId = "c";
  expect(() => startPlay(s, c, 12, 0)).toThrow();
  c.build.campaignId = null;
  p.levels[0].skills = [];
  expect(() => startPlay(s, c, 12, 0)).toThrow();
});

it("переносит урон и его однократную отмену через копию и защищает от устаревшей отмены", () => {
  const { s, c } = setup();
  const playing = startPlay(s, c, 9, 3);
  const first = takeDamage(playing, c.id, 2);
  const id = first.characters[1].runtime.lastDamage!.id;
  const second = takeDamage(first, c.id, 20);
  const restored = decodeBackup(encodeBackup(second));
  expect(restored).toEqual(second);
  expect(restored.characters[1].runtime).toMatchObject({ hp: 0, tempHp: 0 });
  expect(() => undoDamage(restored, c.id, id)).toThrow();
  const latest = restored.characters[1].runtime.lastDamage!.id;
  const undone = undoDamage(restored, c.id, latest);
  expect(undone.characters[1].runtime).toMatchObject({ hp: 9, tempHp: 1 });
  expect(() => undoDamage(undone, c.id, latest)).toThrow();
  restored.characters[1].archivedAt = new Date().toISOString();
  expect(() => takeDamage(restored, c.id, 2)).toThrow();
  expect(() => undoDamage(restored, c.id, latest)).toThrow();
});

it.each([
  [6, false],
  [6, true],
  [7, false],
  [7, true],
] as const)(
  "перенос v%s сохраняет точный снимок или откатывается (отказ записи %s)",
  async (version, fail) => {
    const { s } = setup();
    s.characters[0].runtime.hp = 0;
    const data =
      version === 6
        ? { ...s, version }
        : {
            ...takeDamage(
              startPlay(s, s.characters[1], 9, 2),
              s.characters[1].id,
              3,
            ),
            version,
          };
    const name = crypto.randomUUID();
    const old = new Dexie(name);
    old
      .version(version + 1)
      .stores({ documents: "id", recovery: "id,createdAt" });
    await old.table("documents").put({ id: "local", data });
    old.close();
    const next = new WorkbenchDB(name);
    try {
      if (fail) {
        next.documents.hook("updating", () => {
          throw new Error("quota");
        });
        await expect(initialize(next)).rejects.toThrow();
        next.close();
        await old.open();
        expect(old.verno).toBe(version + 1);
        expect(await old.table("recovery").count()).toBe(0);
        expect((await old.table("documents").get("local")).data).toEqual(data);
      } else {
        await initialize(next);
        const saved = (await next.documents.get("local"))!;
        expect(saved.data).toEqual({ ...data, version: 8 });
        expect(saved.backupBytes).toBe(jsonBytes(saved.data));
        expect(
          (await next.recovery.get(`migration-v${version}`))?.data,
        ).toEqual(data);
        expect(decodeBackup(JSON.stringify(data))).toEqual(saved.data);
      }
    } finally {
      next.close();
      old.close();
      await Dexie.delete(name);
    }
  },
);

it("требует компетентность Плута и использует его кость хитов", () => {
  const { s, c, p } = setup();
  p.levels[0].classId = "rogue";
  p.levels[0].skills = ["athletics", "stealth", "perception", "acrobatics"];
  expect(() => startPlay(s, c, 10, 0)).toThrow();
  p.levels[0].expertise = ["stealth", "thievesTools"];
  const sheet = startPlay(s, c, 10, 0).characters[1];
  expect(sheet.build.maxHp).toBe(10);
  expect(sheet.build.progression).toEqual(p);
});

it("отклоняет импорт, если запись отмены расходится с текущими хитами", () => {
  const { s, c } = setup();
  const wounded = takeDamage(startPlay(s, c, 9, 3), c.id, 5);
  wounded.characters[1].runtime.hp = 8;
  expect(() => decodeBackup(JSON.stringify(wounded))).toThrow();
});
