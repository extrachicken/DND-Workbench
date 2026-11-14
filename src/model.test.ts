import { describe, expect, it } from "vitest";
import { damage, heal, modifier, rollDie, spendSlot } from "./model";

import { initialAppWorkspace } from "./workspace";
const initialWorkspace = initialAppWorkspace().characters[0].runtime;

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
    const next = heal({ ...initialWorkspace, hp: 25, tempHp: 5 }, 20, 30);
    expect(next.hp).toBe(30);
    expect(next.tempHp).toBe(5);
  });
  it.each([-1, NaN, 1.5])("отклоняет некорректное количество %s", (n) => {
    expect(() => damage(initialWorkspace, n)).toThrow();
    expect(() => heal(initialWorkspace, n, 30)).toThrow();
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

it.each([null, 0, 1, 2])(
  "расход ячейки не превращает неизвестный остаток %s в известный",
  (remaining) => {
    const source = { ...initialWorkspace, slotsRemaining: remaining };
    expect(spendSlot(source).slotsRemaining).toBe(
      remaining === null ? null : Math.max(0, remaining - 1),
    );
    expect(source.slotsRemaining).toBe(remaining);
  },
);
