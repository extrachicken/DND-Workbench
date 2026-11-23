import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { once } from "node:events";

// Serve the production app on a fresh origin. Only the worker changes between
// releases, so the test exercises the browser's actual waiting/activation path.
test("Обновление сохраняет черновики в двух вкладках конструктора", async ({
  page,
  context,
  baseURL,
}) => {
  let revision = 1;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, baseURL);
      const upstream = await fetch(new URL(url.pathname, baseURL));
      const data = Buffer.from(await upstream.arrayBuffer());
      res.setHeader(
        "content-type",
        upstream.headers.get("content-type") || "application/octet-stream",
      );
      res.setHeader("cache-control", "no-store");
      res.writeHead(upstream.status);
      res.end(
        url.pathname === "/sw.js"
          ? data.toString() + "\n// test release " + revision
          : data,
      );
    } catch {
      res.writeHead(502);
      res.end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    const create = origin + "/#create";
    await page.goto(create);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    const other = await context.newPage();
    await other.goto(create);
    for (const [tab, name] of [
      [page, "Север"],
      [other, "Заря"],
    ]) {
      await tab.getByLabel("Имя персонажа").fill(name);
      await tab.getByRole("button", { name: "Продолжить" }).click();
      await tab.getByRole("button", { name: "Воин", exact: true }).click();
    }
    revision++;
    await page.bringToFront();
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    const update = page.getByRole("button", { name: "Применить обновление" });
    const otherUpdate = other.getByRole("button", {
      name: "Применить обновление",
    });
    await expect(update).toBeDisabled();
    await expect(update).toBeInViewport({ ratio: 1 });
    await expect(otherUpdate).toBeDisabled();
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(update).toBeEnabled();
    await expect(page).toHaveURL(/#characters$/);
    await Promise.all([page.waitForEvent("load"), update.click()]);
    await expect(page.getByRole("heading", { name: "Север" })).toBeVisible();
    await expect(update).toHaveCount(0);

    await expect(otherUpdate).toBeDisabled();
    await expect(other).toHaveURL(/#create$/);
    await other.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(otherUpdate).toBeEnabled();
    await expect(other).toHaveURL(/#characters$/);
    await Promise.all([other.waitForEvent("load"), otherUpdate.click()]);
    await expect(other.getByRole("heading", { name: "Заря" })).toBeVisible();
    await expect(other.getByRole("heading", { name: "Север" })).toBeVisible();
    await expect(otherUpdate).toHaveCount(0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
