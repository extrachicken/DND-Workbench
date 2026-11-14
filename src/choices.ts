import { classLevels } from "./rules";

// Prepared by supported class/feature handlers, not by a generic rules language.
export type ChoiceRequirement = Readonly<{
  id: string;
  source: string;
  count: number;
  options: readonly string[];
  atClassLevel?: Readonly<{ classId: string; level: number }>;
}>;
export type ChoiceSelection = Readonly<{
  choiceId: string;
  options: readonly string[];
}>;
export type ChoiceIssue = {
  choiceId: string;
  code:
    "missing" | "count" | "duplicate" | "option" | "unknown" | "unavailable";
};

export function validateChoices(
  requirements: readonly ChoiceRequirement[],
  selections: readonly ChoiceSelection[],
  levels: readonly { readonly classId: string }[],
): ChoiceIssue[] {
  const counts = classLevels(levels);
  const definitions = new Map<string, ChoiceRequirement>();
  for (const requirement of requirements) {
    const { id, count, options, atClassLevel } = requirement;
    if (
      !id.trim() ||
      !requirement.source.trim() ||
      definitions.has(id) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > options.length ||
      options.some((option) => !option.trim()) ||
      new Set(options).size !== options.length ||
      (atClassLevel &&
        (!atClassLevel.classId.trim() ||
          !Number.isInteger(atClassLevel.level) ||
          atClassLevel.level < 1 ||
          atClassLevel.level > 20))
    )
      throw new Error("Некорректное определение обязательного выбора");
    definitions.set(id, requirement);
  }
  const issues: ChoiceIssue[] = [];
  const selected = new Map<string, ChoiceSelection>();
  for (const selection of selections) {
    if (selected.has(selection.choiceId))
      issues.push({ choiceId: selection.choiceId, code: "duplicate" });
    else selected.set(selection.choiceId, selection);
    if (!definitions.has(selection.choiceId))
      issues.push({ choiceId: selection.choiceId, code: "unknown" });
  }
  for (const requirement of requirements) {
    const { id: choiceId, atClassLevel } = requirement;
    const selection = selected.get(choiceId);
    const available =
      !atClassLevel ||
      (counts.get(atClassLevel.classId) ?? 0) >= atClassLevel.level;
    if (!available) {
      if (selection) issues.push({ choiceId, code: "unavailable" });
      continue;
    }
    if (!selection || selection.options.length === 0) {
      issues.push({ choiceId, code: "missing" });
      continue;
    }
    if (selection.options.length !== requirement.count)
      issues.push({ choiceId, code: "count" });
    if (new Set(selection.options).size !== selection.options.length)
      issues.push({ choiceId, code: "duplicate" });
    if (
      selection.options.some((option) => !requirement.options.includes(option))
    )
      issues.push({ choiceId, code: "option" });
  }
  return issues;
}
