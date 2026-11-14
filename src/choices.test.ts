import { describe, expect, it } from "vitest";
import { validateChoices, type ChoiceRequirement } from "./choices";

const levels = [
  { classId: "savant" },
  { classId: "savant" },
  { classId: "savant" },
  { classId: "wizard" },
];
const skills: ChoiceRequirement = {
  id: "skills",
  source: "background",
  count: 2,
  options: ["arcana", "history", "nature"],
};
const improvement: ChoiceRequirement = {
  id: "savant:4:improvement",
  source: "fixture:class-level-choice",
  count: 1,
  options: ["abilities", "feat"],
  atClassLevel: { classId: "savant", level: 4 },
};
describe("Обязательные выборы", () => {
  it("показывает незавершённый выбор, не подставляя опции", () => {
    expect(validateChoices([skills], [], levels)).toEqual([
      { choiceId: "skills", code: "missing" },
    ]);
    expect(
      validateChoices([skills], [{ choiceId: "skills", options: [] }], levels),
    ).toEqual([{ choiceId: "skills", code: "missing" }]);
  });
  it("принимает нужное число различных разрешённых опций", () => {
    expect(
      validateChoices(
        [skills],
        [{ choiceId: "skills", options: ["arcana", "history"] }],
        levels,
      ),
    ).toEqual([]);
  });
  it.each([
    [["arcana"], "count"],
    [["arcana", "history", "nature"], "count"],
    [["arcana", "arcana"], "duplicate"],
    [["arcana", "stealth"], "option"],
  ] as const)("отклоняет выбор %s (%s)", (options, code) => {
    expect(
      validateChoices([skills], [{ choiceId: "skills", options }], levels),
    ).toContainEqual({ choiceId: "skills", code });
  });
  it("не принимает повтор одного выбора и неизвестный ID", () => {
    const selected = { choiceId: "skills", options: ["arcana", "history"] };
    expect(
      validateChoices(
        [skills],
        [selected, selected, { choiceId: "missing", options: ["x"] }],
        levels,
      ),
    ).toEqual([
      { choiceId: "skills", code: "duplicate" },
      { choiceId: "missing", code: "unknown" },
    ]);
  });
  it("не выдаёт выбор класса 4 за общий уровень 4 или 5 другого класса (GC-12/13)", () => {
    const selection = { choiceId: improvement.id, options: ["feat"] };
    expect(validateChoices([improvement], [], levels)).toEqual([]);
    expect(validateChoices([improvement], [selection], levels)).toEqual([
      { choiceId: improvement.id, code: "unavailable" },
    ]);
    expect(
      validateChoices([improvement], [], [...levels, { classId: "wizard" }]),
    ).toEqual([]);
    expect(
      validateChoices([improvement], [], [...levels, { classId: "savant" }]),
    ).toEqual([{ choiceId: improvement.id, code: "missing" }]);
    expect(
      validateChoices(
        [improvement],
        [selection],
        [...levels, { classId: "savant" }],
      ),
    ).toEqual([]);
  });
  it("не переносит выбор мастера в стандартный набор и не принимает удалённые опции", () => {
    const extra: ChoiceRequirement = {
      id: "campaign:extra-feat",
      source: "fixture:dm-permission",
      count: 1,
      options: ["observant"],
    };
    const selected = { choiceId: extra.id, options: ["observant"] };
    expect(validateChoices([extra], [selected], levels)).toEqual([]);
    expect(validateChoices([], [selected], levels)).toEqual([
      { choiceId: extra.id, code: "unknown" },
    ]);
    expect(
      validateChoices([{ ...extra, options: ["alert"] }], [selected], levels),
    ).toEqual([{ choiceId: extra.id, code: "option" }]);
  });
  it("не исправляет неправильные определения и не меняет входы", () => {
    expect(() => validateChoices([skills, skills], [], levels)).toThrow();
    expect(() =>
      validateChoices([{ ...skills, count: 0 }], [], levels),
    ).toThrow();
    expect(() =>
      validateChoices(
        [{ ...skills, options: ["arcana", "arcana"] }],
        [],
        levels,
      ),
    ).toThrow();
    const before = structuredClone({ skills, levels });
    validateChoices([skills], [], levels);
    expect({ skills, levels }).toEqual(before);
  });
});
