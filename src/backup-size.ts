// Inputs are schema-validated JSON values. Match compact JSON export exactly.
// Equal portrait/text strings cost no serialization during ordinary saves.
export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
export function jsonSizeDelta(before: unknown, after: unknown): number {
  if (before === after) return 0;
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    before.length === after.length
  )
    return after.reduce(
      (delta, value, index) => delta + jsonSizeDelta(before[index], value),
      0,
    );
  if (
    before !== null &&
    after !== null &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    const keys = Object.keys(right);
    if (
      Object.keys(left).length === keys.length &&
      keys.every((key) => Object.hasOwn(left, key))
    )
      return keys.reduce(
        (delta, key) => delta + jsonSizeDelta(left[key], right[key]),
        0,
      );
  }
  return jsonBytes(after) - jsonBytes(before);
}
