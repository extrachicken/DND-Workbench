import type { RuntimeState } from "./character";

export function damage(s: RuntimeState, amount: number): RuntimeState {
  if (!Number.isInteger(amount) || amount < 0)
    throw new Error("Введите целое неотрицательное число");
  return {
    ...s,
    tempHp: Math.max(0, s.tempHp - amount),
    hp: Math.max(0, s.hp - Math.max(0, amount - s.tempHp)),
  };
}
export function heal(
  s: RuntimeState,
  amount: number,
  maxHp: number,
): RuntimeState {
  if (!Number.isInteger(amount) || amount < 0)
    throw new Error("Введите целое неотрицательное число");
  return { ...s, hp: Math.min(maxHp, s.hp + amount) };
}
export function spendSlot(s: RuntimeState): RuntimeState {
  return s.slotsRemaining === null
    ? s
    : { ...s, slotsRemaining: Math.max(0, s.slotsRemaining - 1) };
}
export const signed = (value: number) =>
  value >= 0 ? `+${value}` : `${value}`;
export { abilityModifier as modifier } from "./rules";
export function rollDie(sides: number): number {
  // Rejection sampling prevents modulo bias.
  if (!Number.isInteger(sides) || sides < 2 || sides > 100)
    throw new Error("Неверный кубик");
  const limit = 2 ** 32 - (2 ** 32 % sides);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % sides) + 1;
}
