import { describe, expect, it } from "vitest";
import {
  damage,
  heal,
  initialWorkspace,
  modifier,
  parseBackup,
  rollDie,
} from "./model";

describe("Игровые ресурсы", () => {
  it("расходует временные хиты до текущих", () => {
    const next = damage({ ...initialWorkspace, tempHp: 5 }, 8);
    expect(next.hp).toBe(27);
    expect(next.tempHp).toBe(0);
  });
  it("не снимает текущие хиты, пока хватает временных", () => {
    const next = damage({ ...initialWorkspace, tempHp: 5 }, 3);
    expect(next.hp).toBe(30);
    expect(next.tempHp).toBe(2);
  });
  it("ограничивает здоровье нулём", () =>
    expect(damage(initialWorkspace, 100).hp).toBe(0));
  it("лечение не превышает максимум и не меняет временные хиты", () => {
    const next = heal({ ...initialWorkspace, hp: 25, tempHp: 5 }, 20);
    expect(next.hp).toBe(30);
    expect(next.tempHp).toBe(5);
  });
  it.each([-1, NaN, 1.5])("отклоняет некорректное количество %s", (n) => {
    expect(() => damage(initialWorkspace, n)).toThrow();
    expect(() => heal(initialWorkspace, n)).toThrow();
  });
  it("не меняет исходный объект и остаток ячеек", () => {
    const source = { ...initialWorkspace, slotsRemaining: 0 };
    const next = damage(source, 5);
    expect(source.hp).toBe(30);
    expect(next.slotsRemaining).toBe(0);
  });
  it("округляет отрицательные модификаторы вниз", () => {
    expect(modifier(7)).toBe(-2);
    expect(modifier(20)).toBe(5);
  });
});
describe("Резервная копия", () => {
  it("сохраняет нулевой остаток ячеек при экспорте и импорте", () => {
    const s = { ...initialWorkspace, slotsRemaining: 0 };
    expect(parseBackup(JSON.stringify(s))).toEqual(s);
  });
  it("отличает неизвестный остаток от нуля", () =>
    expect(
      parseBackup(JSON.stringify(initialWorkspace)).slotsRemaining,
    ).toBeNull());
  it.each([
    { version: 2 },
    { slotsRemaining: 3 },
    { hp: 31 },
    { tempHp: -1 },
    { portrait: "javascript:alert(1)" },
    {
      notes: [
        { id: "1", title: "t", campaign: "c", text: "", date: "invalid" },
      ],
    },
  ])("отклоняет недопустимые данные %j", (patch) =>
    expect(() =>
      parseBackup(JSON.stringify({ ...initialWorkspace, ...patch })),
    ).toThrow(),
  );
  it("отклоняет слишком большой файл", () =>
    expect(() => parseBackup(" ".repeat(5_000_001))).toThrow());
});
describe("Кубики", () => {
  it.each([4, 6, 8, 10, 12, 20])(
    "d%s выдаёт целое значение в границах",
    (sides) => {
      for (let i = 0; i < 50; i++) {
        const n = rollDie(sides);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(sides);
      }
    },
  );
  it("отклоняет недопустимое число граней", () =>
    expect(() => rollDie(0)).toThrow());
});
