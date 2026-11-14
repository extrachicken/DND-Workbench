import { expect, it } from "vitest";
import { jsonBytes, jsonSizeDelta } from "./backup-size";
import { encodeBackup, initialAppWorkspace, makeDraft } from "./workspace";

it.each([
  ['Я🧙\n"', "é\\\t"],
  [999, 0],
  [null, 0],
  [[1, 2], [3]],
  [{ a: "x" }, { longer: "y", b: 3 }],
  [
    { a: 1, b: 2 },
    { b: 3, a: 1 },
  ],
  [[], {}],
  [
    [{ v: "я" }, { v: "e" }],
    [{ v: "emoji🧙" }, { v: "\n" }],
  ],
])("разница совпадает с UTF-8 JSON: %j → %j", (before, after) => {
  expect(jsonBytes(before) + jsonSizeDelta(before, after)).toBe(
    jsonBytes(after),
  );
});
it("учёт размера совпадает с реальным экспортом после последовательности изменений", () => {
  let previous = initialAppWorkspace();
  let bytes = jsonBytes(previous);
  for (let i = 0; i < 120; i++) {
    const next = structuredClone(previous);
    next.characters[0].runtime.hp = i % 31;
    next.characters[0].runtime.slotsRemaining = i % 2 ? null : 0;
    next.characters[0].build.lore = '🧙 Я\\\n"'.repeat(i);
    if (i % 3 === 0)
      next.characters.push(
        makeDraft({
          id: "d" + i,
          name: "Имя",
          ancestry: "Человек",
          className: "Воин",
        }),
      );
    if (i % 5 === 0 && next.characters.length > 1) next.characters.pop();
    bytes += jsonSizeDelta(previous, next);
    expect(bytes).toBe(new TextEncoder().encode(encodeBackup(next)).byteLength);
    previous = next;
  }
});
