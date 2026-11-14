// Start Vite on 127.0.0.1:5175 first. Optional args: Playwright module, baseline Git ref.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.argv[2] || "playwright");
const baseline = process.argv[3];
if (baseline) {
  await mkdir("tmp/performance-baseline", { recursive: true });
  for (const file of ["db", "workspace", "model"]) {
    await writeFile(
      `tmp/performance-baseline/${file}.ts`,
      execFileSync("git", ["show", `${baseline}:src/${file}.ts`]),
    );
  }
}
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5175");
  const results = await page.evaluate(async (hasBaseline) => {
    const results = [];
    for (const mode of hasBaseline ? ["baseline", "current"] : ["current"]) {
      const prefix = mode === "baseline" ? "/tmp/performance-baseline" : "/src";
      const { WorkbenchDB, initialize, changeWorkspace } = await import(
        prefix + "/db.ts"
      );
      const { initialAppWorkspace, makeDraft, updateSheet, updateCharacter } =
        await import(prefix + "/workspace.ts");
      const { damage } = await import(prefix + "/model.ts");
      for (const count of [1, 16]) {
        const db = new WorkbenchDB("bench-" + crypto.randomUUID());
        try {
          await initialize(db);
          const s = initialAppWorkspace();
          for (let i = 1; i < count; i++)
            s.characters.push(
              makeDraft({
                id: "p" + i,
                name: "Имя",
                ancestry: "Человек",
                className: "Воин",
              }),
            );
          if (count > 1)
            for (const c of s.characters)
              (mode === "baseline" ? c.sheet : c.build).portrait =
                "data:image/png;base64," + "A".repeat(2_900_000);
          await db.documents.put({ id: "local", data: s });
          const times = [];
          for (let i = 0; i < 25; i++) {
            const start = performance.now();
            await changeWorkspace(
              (v) =>
                mode === "baseline"
                  ? updateSheet(v, "gu-chen-demo", (r) => damage(r, 1))
                  : updateCharacter(v, "gu-chen-demo", (c) => ({
                      ...c,
                      runtime: damage(c.runtime, 1),
                    })),
              db,
            );
            if (i >= 5) times.push(performance.now() - start);
          }
          times.sort((a, b) => a - b);
          results.push({
            mode,
            count,
            bytes: new TextEncoder().encode(JSON.stringify(s)).length,
            median: (times[9] + times[10]) / 2,
            p95: times[18],
            max: times[19],
          });
        } finally {
          await db.delete();
        }
      }
    }
    return { ua: navigator.userAgent, results };
  }, Boolean(baseline));
  await mkdir("tmp", { recursive: true });
  console.log(JSON.stringify(results, null, 2));
  await writeFile(
    "tmp/performance-results.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
