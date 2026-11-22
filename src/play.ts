import type { Character } from "./character";
import { damage } from "./model";
import { previewProgression } from "./progression";
import { resolveProficiencies } from "./proficiencies";
import { updateCharacter, type AppWorkspace } from "./workspace";
import type { Campaign } from "./campaign";

export function startingMaximum(character: Character, campaign?: Campaign) {
  const p = character.build.progression;
  if (!p || resolveProficiencies(p).issues.length) return null;
  return previewProgression(p, campaign).hp?.maxHp ?? null;
}

export function startPlay(
  s: AppWorkspace,
  baseline: Character,
  hp: number,
  tempHp: number,
): AppWorkspace {
  const c = s.characters.find((c) => c.id === baseline.id);
  if (
    !c ||
    c.kind !== "draft" ||
    c.archivedAt ||
    JSON.stringify(c) !== JSON.stringify(baseline)
  )
    throw new Error("Черновик изменился в другой вкладке. Откройте его снова.");
  const maxHp = startingMaximum(
    c,
    s.campaigns.find((x) => x.id === c.build.campaignId),
  );
  if (maxHp === null)
    throw new Error(
      "Условия сборки изменились в другой вкладке. Проверьте решения.",
    );
  if (
    !Number.isInteger(hp) ||
    hp < 0 ||
    hp > maxHp ||
    !Number.isInteger(tempHp) ||
    tempHp < 0 ||
    tempHp > 9999
  )
    throw new Error("Проверьте стартовые хиты.");
  return {
    ...s,
    activeCharacterId: c.id,
    characters: s.characters.map((entry) =>
      entry.id === c.id
        ? {
            ...c,
            kind: "player",
            build: { ...c.build, maxHp },
            runtime: { ...c.runtime, hp, tempHp },
          }
        : entry,
    ),
  };
}

export function takeDamage(
  s: AppWorkspace,
  id: string,
  amount: number,
): AppWorkspace {
  return updateCharacter(s, id, (c) => {
    if (
      c.kind !== "player" ||
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > 9999
    )
      throw new Error("Проверьте лист и величину урона.");
    const { hp, tempHp } = c.runtime;
    if (!hp && !tempHp) return c;
    return {
      build: c.build,
      runtime: {
        ...damage(c.runtime, amount),
        lastDamage: { id: crypto.randomUUID(), amount, hp, tempHp },
      },
    };
  });
}

export function undoDamage(
  s: AppWorkspace,
  id: string,
  actionId: string,
): AppWorkspace {
  return updateCharacter(s, id, (c) => {
    const { lastDamage, ...runtime } = c.runtime;
    if (c.kind !== "player" || lastDamage?.id !== actionId)
      throw new Error("Последний урон изменился в другой вкладке.");
    return {
      build: c.build,
      runtime: { ...runtime, hp: lastDamage.hp, tempHp: lastDamage.tempHp },
    };
  });
}
