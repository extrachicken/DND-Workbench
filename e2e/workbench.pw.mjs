import { expect, test } from "@playwright/test";

async function startCharacter(page, name, className) {
  await page.goto("/#create");
  await page.getByLabel("Имя персонажа").fill(name);
  const next = page.getByRole("button", { name: "Продолжить" });
  await next.click();
  await page.getByLabel("Название класса").fill(className);
  await next.click();
}

async function restore(target, record) {
  await target.goto("/#settings");
  target.once("dialog", (d) => d.accept());
  await target.locator('input[type="file"]').setInputFiles({
    name: "session.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(record)),
  });
  await expect(target.getByRole("status")).toHaveText(
    "Резервная копия восстановлена",
  );
}
async function download(target) {
  const ready = target.waitForEvent("download");
  await target.getByRole("button", { name: "Скачать резервную копию" }).click();
  const stream = await (await ready).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

test("Класс первого уровня следует выбору игрока", async ({ page }) => {
  await startCharacter(page, "Лира", "Плут");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByLabel("Класс уровня 1")).toHaveValue("rogue");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(
    page.locator("article").filter({ hasText: "Лира" }),
  ).toContainText("Плут 1");
});

test("Волшебник сохраняет выбранный класс", async ({ page }) => {
  await startCharacter(page, "Мирра", "Волшебник");
  await expect(
    page.getByRole("button", { name: "Распределить стандартный набор" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(
    page.locator("article").filter({ hasText: "Мирра" }),
  ).toContainText("Волшебник");
});

test("Открытие листа в другой вкладке сохраняет ввод в черновике", async ({
  page,
  context,
}) => {
  await startCharacter(page, "Яра", "Воин");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  const open = page.getByRole("button", { name: "Открыть черновик" });
  await open.click();
  const lore = page.getByLabel("История персонажа");
  await lore.fill("Обещание у переправы");
  const second = await context.newPage();
  await second.goto("/#characters");
  await second.getByRole("button", { name: "Открыть лист" }).click();
  await expect(
    second.getByRole("button", { name: "Урон", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Черновик персонажа" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await open.click();
  await expect(lore).toHaveValue("Обещание у переправы");
});

test("Журнал оставляет обе версии при конфликте", async ({ page, context }) => {
  await page.goto("/#journal");
  await page.getByRole("button", { name: "Новая сессия" }).click();
  const field = page.getByLabel("Что произошло");
  await field.fill("Нашли ключ");
  await expect(page.getByRole("status")).toHaveText("Сохранено на устройстве");
  const second = await context.newPage();
  await second.goto("/#journal");
  const otherField = second.getByLabel("Что произошло");
  await expect(otherField).toHaveValue("Нашли ключ");
  await otherField.fill("Нашли ключ и карту");
  await expect(second.getByRole("status")).toHaveText(
    "Сохранено на устройстве",
  );
  await field.fill("Нашли ключ у моста");
  await expect(
    page.getByText("Сохранённый вариант", { exact: true }),
  ).toBeVisible();
  await expect(field).toHaveValue("Нашли ключ у моста");
  await expect(page.getByLabel("Сохранённый текст")).toHaveValue(
    "Нашли ключ и карту",
  );
  await page
    .getByRole("button", { name: "Сохранить отдельной записью" })
    .click();
  await expect(page.locator(".note-list button")).toHaveCount(2);
  await page.reload();
  await expect(field).toHaveValue("Нашли ключ у моста");
  await page.locator(".note-list button").last().click();
  await expect(field).toHaveValue("Нашли ключ и карту");
});

test("На телефоне урон и сохранение доступны без длинной прокрутки", async ({
  page,
}) => {
  await page.goto("/#characters");
  await page.getByRole("button", { name: "Открыть лист" }).click();
  await expect(
    page.getByRole("button", { name: "Урон", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await startCharacter(page, "Лира", "Воин");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(
    page.getByRole("button", { name: "Сохранить черновик" }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByText("Навыки и пассивные проверки").locator(".."),
  ).not.toHaveAttribute("open", "");
  await expect(page.getByRole("link", { name: "классы 2014" })).toHaveCSS(
    "text-decoration-line",
    "underline",
  );
});

test("Игровой лист и история оформлены как продукт", async ({ page }) => {
  await page.goto("/#characters");
  await expect(
    page.getByRole("button", { name: "Открыть лист" }),
  ).toBeVisible();
  const labels = /учебн|прототип|для проверки интерфейса/i;
  await expect(page.locator("body")).not.toContainText(labels);
  await page.getByRole("button", { name: "Открыть лист" }).click();
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.getByLabel("История персонажа")).not.toHaveValue(labels);
});

test("Старый адрес листа, биография и ресурсы переживают офлайн-восстановление", async ({
  page,
  browser,
}) => {
  const biography =
    "Гу Чень — Хранитель душ. Его настоящее имя — Синь Дзин. За образом учёного скрывается агент двора Хань.";
  const oldLore =
    biography + "\n\nЭто учебная копия. Дополните историю своими заметками.";
  const legacy = {
    version: 1,
    hp: 12,
    maxHp: 30,
    tempHp: 3,
    slotsRemaining: 0,
    lore: oldLore,
    portrait: "",
    inventory: [],
    notes: [],
    drafts: [],
    metric: false,
  };
  await restore(page, legacy);
  await page.goto("/#character");
  await expect(page).toHaveURL(/#character\/.+/);
  await expect(page.locator(".health-display strong")).toHaveText("12");
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.getByLabel("История персонажа")).toHaveValue(biography);
  const authored = oldLore + "\nЗаписи моей партии.";
  await page.getByLabel("История персонажа").fill(authored);
  await expect(page.getByRole("status")).toHaveText("Сохранено на устройстве");
  await page.goto("/#settings");
  const backup = await download(page);
  expect(backup.characters[0].build.lore).toBe(authored);
  expect(backup.characters[0].runtime).toMatchObject({
    hp: 12,
    tempHp: 3,
    slotsRemaining: 0,
  });
  const clean = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    acceptDownloads: true,
  });
  try {
    const second = await clean.newPage();
    await second.goto("/#settings");
    await second.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await second.reload();
    await second.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );
    await clean.setOffline(true);
    await restore(second, backup);
    expect(await download(second)).toEqual(backup);
    await second.goto("/#character");
    await second.reload();
    await expect(second.getByLabel("Временные хиты")).toHaveValue("3");
    await second.getByRole("button", { name: "История", exact: true }).click();
    await expect(second.getByLabel("История персонажа")).toHaveValue(authored);
  } finally {
    await clean.close();
  }
});

test("Замена данных в соседней вкладке оставляет открытый текст для восстановления", async ({
  page,
  context,
}) => {
  await startCharacter(page, "Яра", "Воин");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await page.getByRole("button", { name: "Открыть черновик" }).click();
  const lore = page.getByLabel("История персонажа");
  await lore.fill("Неотправленное письмо");
  const second = await context.newPage();
  await second.goto("/#settings");
  const empty = {
    version: 6,
    campaigns: [],
    characters: [],
    notes: [],
    activeCharacterId: null,
    metric: false,
  };
  second.once("dialog", (d) => d.accept());
  await second.locator('input[type="file"]').setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(empty)),
  });
  await expect(second.getByRole("status")).toHaveText(
    "Резервная копия восстановлена",
  );
  await page
    .getByRole("button", { name: "Сохранить изменения" })
    .click({ timeout: 3000 });
  await expect(page.getByRole("status")).toContainText("другой вкладке");
  await expect(lore).toHaveValue("Неотправленное письмо");
});

test("Открывает персонажа по исходному ID из JSON-копии", async ({ page }) => {
  // JSON can carry any UTF-16 code unit, including one without a pairing unit.
  const id = "карта/#%" + String.fromCharCode(0xd800);
  const draft = {
    id,
    kind: "draft",
    archivedAt: null,
    build: {
      name: "Рин",
      ancestry: "Эльф",
      className: "Плут",
      lore: "История из копии",
      portrait: "",
      maxHp: 1,
      campaignId: null,
      progression: null,
    },
    runtime: { hp: 1, tempHp: 0, slotsRemaining: null, inventory: [] },
  };
  const backup = {
    version: 6,
    activeCharacterId: id,
    campaigns: [],
    notes: [],
    characters: [draft],
    metric: false,
  };
  await page.goto("/#settings");
  page.once("dialog", (d) => d.accept());
  await page.locator('input[type="file"]').setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("status")).toHaveText(
    "Резервная копия восстановлена",
  );
  await page.locator('nav a[href="#characters"]').click();
  await page.getByRole("button", { name: "Открыть черновик" }).click();
  await expect(page.getByLabel("История персонажа")).toHaveValue(
    "История из копии",
  );
  await page.reload();
  await expect(page.getByLabel("Имя персонажа")).toHaveValue("Рин");
});

test("Свой Воин получает урон и отменяет его после офлайн-восстановления", async ({
  page,
  browser,
}) => {
  await startCharacter(page, "Лира", "Воин");
  for (const ability of [
    "Сила",
    "Ловкость",
    "Телосложение",
    "Интеллект",
    "Мудрость",
    "Харизма",
  ])
    await page.getByLabel(ability + ": исходная", { exact: true }).fill("14");
  await page.getByRole("button", { name: "Продолжить" }).click();
  for (const name of ["Атлетика", "Внимательность"])
    await page.getByRole("checkbox", { name, exact: true }).check();
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await page.getByRole("button", { name: "Открыть черновик" }).click();
  await page.getByLabel("Стартовые хиты", { exact: true }).fill("9");
  await page.getByLabel("Стартовые временные хиты").fill("3");
  await page.getByRole("button", { name: "Начать игру" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Лира", exact: true }),
  ).toBeVisible();
  const hit = page.getByRole("button", { name: "Урон", exact: true });
  await expect(hit).toBeInViewport({ ratio: 1 });
  await page.getByLabel("Величина урона").fill("5");
  await hit.click();
  await expect(page.getByText("7 / 12", { exact: true })).toBeVisible();
  const url = page.url();
  await page.goto("/#settings");
  const backup = await download(page);
  const clean = await browser.newContext({
    baseURL: new URL(url).origin,
    viewport: { width: 320, height: 800 },
  });
  try {
    const second = await clean.newPage();
    await second.goto("/#settings");
    await second.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await second.reload();
    await second.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );
    await clean.setOffline(true);
    await restore(second, backup);
    expect(await download(second)).toEqual(backup);
    await second.goto(url);
    await second.reload();
    await expect(second.getByText("7 / 12", { exact: true })).toBeVisible();
    await second.getByRole("button", { name: /Отменить урон/ }).click();
    await expect(second.getByText("9 / 12", { exact: true })).toBeVisible();
    await expect(second.getByText("Временные хиты · 3")).toBeVisible();
    await second.reload();
    await expect(second.getByText("9 / 12", { exact: true })).toBeVisible();
    expect(
      await second.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await clean.close();
  }
});

test("Справка и живой лист сопровождают создание персонажа", async ({
  page,
}) => {
  await page.goto("/#create");
  await page.getByLabel("Имя персонажа").fill("Ива");
  await page
    .getByRole("combobox", { name: "Предыстория", exact: true })
    .selectOption("Мудрец");
  const help = page.getByRole("button", { name: "О предыстории", exact: true });
  await help.click();
  await expect(page.getByRole("dialog")).toContainText("Мудрец");
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: "Плут", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page
    .getByRole("button", { name: "Распределить стандартный набор" })
    .click();
  await expect(
    page.getByLabel("Ловкость: исходная", { exact: true }),
  ).toHaveValue("15");
  const sheet = page.getByRole("group", {
    name: "Лист персонажа",
    exact: true,
  });
  await sheet.locator("summary").click();
  await expect(sheet).toContainText("Ива");
  await expect(sheet).toContainText("Мудрец");
  await expect(sheet).toContainText("+2");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await page.getByRole("button", { name: "Открыть черновик" }).click();
  await expect(
    page.getByRole("combobox", { name: "Предыстория", exact: true }),
  ).toHaveValue("Мудрец");
});

test("На широком экране лист показывает решения при смене шага и класса", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await startCharacter(page, "Ива", "Плут");
  const sheet = page.getByRole("group", {
    name: "Лист персонажа",
    exact: true,
  });
  await expect(sheet).toHaveAttribute("open", "");
  await page
    .getByRole("button", { name: "Распределить стандартный набор" })
    .click();
  await page.getByRole("button", { name: "Продолжить" }).click();
  const stealth = page.getByLabel("Скрытность", { exact: true }).first();
  await page.getByRole("button", { name: "О навыке · Скрытность" }).click();
  await expect(page.getByRole("dialog")).toContainText("Ловкость");
  await page.getByRole("button", { name: "Закрыть справку" }).click();
  await expect(stealth).not.toBeChecked();
  await stealth.check();
  await expect(sheet).toContainText("Скрытность");
  const nav = page.getByRole("navigation", { name: "Шаги создания персонажа" });
  await nav.getByRole("button", { name: /Класс$/ }).click();
  await page.getByRole("button", { name: "Воин", exact: true }).click();
  await expect(sheet).toContainText("Воин 1");
  await nav.getByRole("button", { name: /Характеристики/ }).click();
  await expect(
    page.getByLabel("Ловкость: исходная", { exact: true }),
  ).toHaveValue("15");
});

test("Справочник ищет по-английски и открывает правило без сети", async ({
  page,
  context,
}) => {
  await page.goto("/#library");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("searchbox", { name: "Поиск по названию" })
    .fill("investigation");
  await page
    .getByRole("button", { name: "Расследование", exact: true })
    .press("Enter");
  await expect(page.getByRole("dialog")).toContainText("Интеллект");
  await page.keyboard.press("Escape");
  await page
    .getByRole("searchbox", { name: "Поиск по названию" })
    .fill("short rest");
  const rest = page.getByRole("button", { name: "Короткий отдых", exact: true });
  await rest.press("Enter");
  const rule = page.getByRole("dialog", { name: "Короткий отдых" });
  await expect(rule).toContainText("модификатор Телосложения");
  await expect(rule.getByRole("link")).toHaveAttribute(
    "href",
    "https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring#ShortRest",
  );
  await page.keyboard.press("Escape");
  await expect(rest).toBeFocused();
  await page.getByRole("button", { name: "Книга заклинаний" }).click();
  await page
    .getByRole("searchbox", { name: "Поиск заклинаний" })
    .fill("shield");
  await expect(page.locator(".spell-row")).toHaveText(/Щит/);
});
