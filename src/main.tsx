import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Dice5,
  Download,
  Feather,
  Heart,
  Minus,
  Plus,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sword,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { db, initialize, changeWorkspace } from "./db";
import {
  damage,
  heal,
  modifier,
  parseBackup,
  rollDie,
  signed,
  type Workspace,
} from "./model";
import "./styles.css";

const stats = [
  ["Сила", 4],
  ["Ловкость", 16],
  ["Телосложение", 17],
  ["Интеллект", 20],
  ["Мудрость", 14],
  ["Харизма", 12],
] as const;
const spells = [
  ["Расщепление разума", "Mind Sliver", "Заговор"],
  ["Луч холода", "Ray of Frost", "Заговор"],
  ["Малая иллюзия", "Minor Illusion", "Заговор"],
  ["Жуткий смех Таши", "Tasha’s Hideous Laughter", "1 круг"],
  ["Скольжение", "Grease", "1 круг"],
  ["Щит", "Shield", "1 круг"],
  ["Доспехи мага", "Mage Armor", "1 круг"],
  ["Поиск фамильяра", "Find Familiar", "1 круг"],
  ["Обнаружение магии", "Detect Magic", "1 круг"],
];
const nav = [
  { id: "character", title: "Персонаж", icon: Users },
  { id: "journal", title: "Журнал", icon: BookOpen },
  { id: "library", title: "Библиотека", icon: Bookmark },
  { id: "settings", title: "Настройки", icon: Settings },
];
const classes = [
  "Бард",
  "Варвар",
  "Воин",
  "Волшебник",
  "Друид",
  "Жрец",
  "Изобретатель",
  "Колдун",
  "Монах",
  "Паладин",
  "Плут",
  "Следопыт",
  "Чародей",
  "Савант (homebrew)",
];
function usePage() {
  const read = () => location.hash.slice(1) || "character";
  const [page, setPage] = useState(read);
  useEffect(() => {
    const handler = () => setPage(read());
    addEventListener("hashchange", handler);
    return () => removeEventListener("hashchange", handler);
  }, []);
  return page;
}
function App() {
  const page = usePage();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  const data = useLiveQuery(() => db.workspace.get("local"));
  const [cached, setCached] = useState(false);
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      void navigator.serviceWorker.ready.then(() => setCached(true));
  }, []);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("Обзор");
  const [amount, setAmount] = useState("5");
  const [query, setQuery] = useState("");
  const [roll, setRoll] = useState("");
  const [die, setDie] = useState(20);
  const [physical, setPhysical] = useState("");
  const [draftStep, setDraftStep] = useState(1);
  const [draftName, setDraftName] = useState("");
  const [draftClass, setDraftClass] = useState("Волшебник");
  const [draftRace, setDraftRace] = useState("Человек");
  const [noteId, setNoteId] = useState("");
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    initialize().catch(() =>
      setError(
        "Не удалось открыть хранилище. Разрешите хранение данных в браузере и перезагрузите страницу.",
      ),
    );
  }, []);
  async function save(
    update: (s: Workspace) => Workspace,
    message = "Сохранено на устройстве",
  ) {
    try {
      await changeWorkspace(update);
      setStatus(message);
      setError("");
      return true;
    } catch {
      setError(
        "Не удалось сохранить изменения. Проверьте свободное место и разрешение на хранение данных.",
      );
      return false;
    }
  }
  if (!data)
    return (
      <main className="loading">
        <img src="/icon.svg" width="64" height="64" alt="" />
        <h1>Workbench</h1>
        <p role="status">{error || "Открываем ваш стол приключений…"}</p>
      </main>
    );
  const s = data.data;
  const number = Number(amount);
  const amountValid =
    amount.trim() !== "" &&
    Number.isInteger(number) &&
    number >= 0 &&
    number <= 9999;
  const activeNote = s.notes.find((n) => n.id === noteId) || s.notes[0];
  function exportBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `workbench-${new Date().toISOString().slice(0, 10)}.dndwb.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Файл резервной копии подготовлен");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error();
      const imported = parseBackup(await file.text());
      if (
        confirm(
          "Заменить данные на этом устройстве данными из файла? Сначала сохраните текущую резервную копию.",
        )
      )
        await save(() => imported, "Резервная копия восстановлена");
    } catch {
      setError(
        "Файл не подходит. Выберите резервную копию Workbench версии 1, не больше 5 МБ.",
      );
    }
  }
  async function portrait(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2_000_000
    ) {
      setError("Выберите PNG, JPEG или WebP до 2 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      void save((v) => ({ ...v, portrait: String(reader.result) }));
    reader.onerror = () =>
      setError("Не удалось прочитать изображение. Выберите файл ещё раз.");
    reader.readAsDataURL(file);
  }
  const spellList = spells.filter((x) =>
    x.join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="app-shell">
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      <aside className="sidebar">
        <a href="#character" className="brand">
          <img src="/icon.svg" width="38" height="38" alt="" />
          <span>
            WORKBENCH<small>DUNGEONS & DRAGONS · 2014</small>
          </span>
        </a>
        <div className="side-label">ВАШ СТОЛ ПРИКЛЮЧЕНИЙ</div>
        <nav aria-label="Основная навигация">
          {nav.map(({ id, title, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{title}</span>
              {page === id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="side-campaign">
          <span className="eyebrow">ТЕКУЩИЙ ПЕРСОНАЖ</span>
          <a href="#character">
            <div className="avatar tiny">ГЧ</div>
            <div>
              <strong>Гу Чень</strong>
              <small>Савант 3 / Волшебник 1</small>
            </div>
          </a>
          <span className="tag">Учебная копия</span>
        </div>
        <div className="sidebar-bottom">
          <span className="connection-dot" />
          Локальное хранилище<small>Ваши истории остаются у вас.</small>
          <a href="#settings">
            Сделать резервную копию <ChevronRight size={14} />
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Личный стол <ChevronRight size={13} />{" "}
            <strong>
              {page === "create"
                ? "Новый персонаж"
                : nav.find((n) => n.id === page)?.title || "Персонаж"}
            </strong>
          </span>
          <span className="prototype">ПРОТОТИП · 0.1</span>
        </header>
        <main id="main" tabIndex={-1}>
          {page === "character" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ИСТОРИЯ ПРОДОЛЖАЕТСЯ</div>
                  <h1>Ваш персонаж</h1>
                </div>
                <a className="button secondary" href="#create">
                  <Plus size={17} />
                  Создать персонажа
                </a>
              </div>
              <section className="character-banner">
                <div className="avatar portrait">
                  {s.portrait ? (
                    <img
                      src={s.portrait}
                      width="112"
                      height="132"
                      alt="Портрет Гу Ченя"
                    />
                  ) : (
                    <>
                      <Feather size={38} />
                      <span>ГУ ЧЕНЬ</span>
                    </>
                  )}
                </div>
                <div className="character-identity">
                  <div className="inline">
                    <span className="eyebrow">ХРАНИТЕЛЬ ДУШ</span>
                    <span className="tag">Учебная копия</span>
                  </div>
                  <h2>Гу Чень</h2>
                  <p>
                    Человек · Мудрец <span className="dot-separator">·</span>{" "}
                    Савант 3 / Волшебник 1
                  </p>
                  <div className="inline">
                    <span className="badge">
                      <Sparkles size={13} /> Следователь
                    </span>
                    <span className="muted small">2014 + homebrew</span>
                  </div>
                </div>
                <div className="level">
                  <span>УРОВЕНЬ</span>
                  <strong>4</strong>
                  <small>2 700 опыта</small>
                </div>
              </section>
              <div
                className="sheet-tabs"
                role="group"
                aria-label="Разделы листа"
              >
                {["Обзор", "Заклинания", "Инвентарь", "История"].map((t) => (
                  <button
                    aria-pressed={tab === t}
                    className={tab === t ? "selected" : ""}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Обзор" && (
                <>
                  <div className="stat-grid">
                    {stats.map(([name, value]) => (
                      <article
                        className={`stat ${name === "Интеллект" ? "prime" : ""}`}
                        key={name}
                      >
                        <span>{name}</span>
                        <strong>{signed(modifier(value))}</strong>
                        <small>{value}</small>
                      </article>
                    ))}
                  </div>
                  <div className="play-grid">
                    <div className="primary-column">
                      <section className="panel health">
                        <div className="section-heading">
                          <h3>
                            <Heart size={18} /> Здоровье
                          </h3>
                          <span className="muted small">
                            Состояние учебной копии
                          </span>
                        </div>
                        <div className="health-display">
                          <div>
                            <strong>{s.hp}</strong>
                            <span> / {s.maxHp}</span>
                            <small>текущие хиты</small>
                          </div>
                          <label className="temp">
                            Временные
                            <input
                              autoComplete="off"
                              aria-label="Временные хиты"
                              type="number"
                              min="0"
                              max="9999"
                              value={s.tempHp}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isInteger(n) && n >= 0 && n <= 9999)
                                  void save((v) => ({ ...v, tempHp: n }));
                              }}
                            />
                          </label>
                        </div>
                        <div className="hp-track">
                          <div
                            style={{ width: `${(s.hp / s.maxHp) * 100}%` }}
                          />
                        </div>
                        <div className="health-actions">
                          <label className="amount-label">
                            <span className="sr-only">Количество хитов</span>
                            <input
                              autoComplete="off"
                              aria-label="Количество хитов"
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="9999"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                            />
                          </label>
                          <button
                            className="danger"
                            disabled={!amountValid}
                            onClick={() =>
                              void save((v) => damage(v, number), "Урон учтён")
                            }
                          >
                            <Minus size={16} />
                            Урон
                          </button>
                          <button
                            className="healing"
                            disabled={!amountValid}
                            onClick={() =>
                              void save(
                                (v) => heal(v, number),
                                "Лечение учтено",
                              )
                            }
                          >
                            <Plus size={16} />
                            Лечение
                          </button>
                        </div>
                        <p className="hint">
                          Урон сначала расходует временные хиты.
                        </p>
                      </section>
                      <section className="panel">
                        <div className="section-heading">
                          <h3>
                            <Sparkles size={18} /> Ячейки заклинаний
                          </h3>
                          <span className="badge">1 круг</span>
                        </div>
                        <div className="slot-row">
                          <div>
                            <strong className="resource-value">
                              {s.slotsRemaining === null
                                ? "?"
                                : s.slotsRemaining}
                              <span> / 2</span>
                            </strong>
                            <p className="hint">
                              {s.slotsRemaining === null
                                ? "Укажите остаток после сессии"
                                : "осталось / максимум"}
                            </p>
                          </div>
                          <div className="slot-pips">
                            {[0, 1, 2].map((n) => (
                              <button
                                aria-label={`${n} ячеек осталось`}
                                aria-pressed={s.slotsRemaining === n}
                                className={
                                  s.slotsRemaining === n ? "chosen" : ""
                                }
                                key={n}
                                onClick={() =>
                                  void save((v) => ({
                                    ...v,
                                    slotsRemaining: n,
                                  }))
                                }
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="panel-foot">
                          <span>Волшебник · 1 уровень</span>
                          <button
                            disabled={
                              s.slotsRemaining === null ||
                              s.slotsRemaining === 0
                            }
                            onClick={() =>
                              void save(
                                (v) => ({
                                  ...v,
                                  slotsRemaining: Math.max(
                                    0,
                                    (v.slotsRemaining ?? 0) - 1,
                                  ),
                                }),
                                "Ячейка потрачена",
                              )
                            }
                          >
                            Потратить ячейку <ChevronRight size={15} />
                          </button>
                        </div>
                      </section>
                      <section className="panel">
                        <div className="section-heading">
                          <h3>
                            <ScrollText size={18} /> Навыки и особенности
                          </h3>
                          <span className="muted small">Из листа Гу Ченя</span>
                        </div>
                        <div className="skill-row">
                          <span>
                            Расследование
                            <small>Интеллект · компетентность</small>
                          </span>
                          <strong>+9</strong>
                        </div>
                        <div className="skill-row">
                          <span>
                            Восприятие<small>Мудрость · владение</small>
                          </span>
                          <strong>+4</strong>
                        </div>
                        <div className="skill-row">
                          <span>
                            Пассивное восприятие
                            <small>Включая «Внимательный»</small>
                          </span>
                          <strong>19</strong>
                        </div>
                        <details>
                          <summary>Черты и происхождение бонусов</summary>
                          <p>
                            Бдительный — от альтернативного человека.
                            Внимательный — дополнительная черта, разрешённая
                            мастером. Проверка всех способностей саванта
                            появится на следующем этапе.
                          </p>
                        </details>
                      </section>
                    </div>
                    <div className="secondary-column">
                      <section className="combat-grid">
                        <div>
                          <Shield size={20} />
                          <strong>16</strong>
                          <span>Класс доспеха</span>
                        </div>
                        <div>
                          <Zap size={20} />
                          <strong>+8</strong>
                          <span>Инициатива</span>
                        </div>
                        <div>
                          <ChevronRight size={20} />
                          <strong>{s.metric ? "9,14" : "30"}</strong>
                          <span>
                            {s.metric ? "Скорость, м" : "Скорость, фт"}
                          </span>
                        </div>
                        <div>
                          <Check size={20} />
                          <strong>+2</strong>
                          <span>Мастерство</span>
                        </div>
                      </section>
                      <section className="panel dice-panel">
                        <div className="section-heading">
                          <h3>
                            <Dice5 size={18} /> Бросок кубика
                          </h3>
                          <span className="muted small">Без модификаторов</span>
                        </div>
                        <div className="dice-types">
                          {[4, 6, 8, 10, 12, 20].map((n) => (
                            <button
                              key={n}
                              aria-pressed={die === n}
                              className={die === n ? "chosen" : ""}
                              onClick={() => setDie(n)}
                            >
                              d{n}
                            </button>
                          ))}
                        </div>
                        <div className="roll-result" aria-live="polite">
                          {roll || <span>Готовы к броску?</span>}
                        </div>
                        <button
                          className="primary full"
                          onClick={() => setRoll(`${rollDie(die)} · d${die}`)}
                        >
                          <Dice5 size={17} /> Бросить d{die}
                        </button>
                        <details>
                          <summary>Бросаю настоящие кубики</summary>
                          <form
                            className="inline"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (
                                Number.isInteger(Number(physical)) &&
                                Number(physical) >= 1 &&
                                Number(physical) <= die
                              )
                                setRoll(`${physical} · d${die} · вручную`);
                            }}
                          >
                            <label>
                              Результат
                              <input
                                autoComplete="off"
                                type="number"
                                min="1"
                                max={die}
                                required
                                value={physical}
                                onChange={(e) => setPhysical(e.target.value)}
                              />
                            </label>
                            <button>Записать</button>
                          </form>
                        </details>
                      </section>
                      <aside className="quiet-note">
                        <Feather size={21} />
                        <h3>Место для вашей истории</h3>
                        <p>
                          Сохраните важную встречу, новую зацепку или обещание,
                          которое нельзя забыть.
                        </p>
                        <a href="#journal">
                          Открыть журнал <ChevronRight size={15} />
                        </a>
                      </aside>
                    </div>
                  </div>
                </>
              )}
              {tab === "Заклинания" && (
                <section className="panel">
                  <div className="section-heading">
                    <h3>Книга заклинаний</h3>
                    <span className="badge">9 записей из листа</span>
                  </div>
                  <p className="muted">
                    Список для проверки интерфейса. Подготовка, описания и
                    применение заклинаний появятся позже.
                  </p>
                  <SpellSearch query={query} setQuery={setQuery} />
                  <SpellList list={spellList} />
                </section>
              )}
              {tab === "Инвентарь" && (
                <section className="panel">
                  <div className="section-heading">
                    <h3>
                      <Sword size={18} /> Инвентарь
                    </h3>
                    <span className="muted small">Учебная копия</span>
                  </div>
                  <p className="muted">
                    Добавленные предметы пока не меняют КД, атаки и нагрузку
                    автоматически.
                  </p>
                  <form
                    className="add-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = e.currentTarget;
                      const name = String(
                        new FormData(f).get("item") || "",
                      ).trim();
                      if (name) {
                        void save((v) => ({
                          ...v,
                          inventory: [
                            ...v.inventory,
                            {
                              id: crypto.randomUUID(),
                              name,
                              quantity: 1,
                              equipped: false,
                            },
                          ],
                        }));
                        f.reset();
                      }
                    }}
                  >
                    <label>
                      Название предмета
                      <input
                        autoComplete="off"
                        name="item"
                        required
                        maxLength={100}
                        placeholder="Например, факел…"
                      />
                    </label>
                    <button className="primary">
                      <Plus size={16} /> Добавить
                    </button>
                  </form>
                  {s.inventory.length === 0 ? (
                    <Empty
                      title="В рюкзаке пока пусто"
                      text="Снаряжение из исходного листа ещё не перенесено. Здесь можно попробовать добавление и расход предметов."
                    />
                  ) : (
                    s.inventory.map((item) => (
                      <div className="item-row" key={item.id}>
                        <label>
                          <input
                            autoComplete="off"
                            type="checkbox"
                            checked={item.equipped}
                            onChange={() =>
                              void save((v) => ({
                                ...v,
                                inventory: v.inventory.map((i) =>
                                  i.id === item.id
                                    ? { ...i, equipped: !i.equipped }
                                    : i,
                                ),
                              }))
                            }
                          />
                          <span>
                            {item.name}
                            <small>
                              {item.equipped ? "Надето / в руках" : "В рюкзаке"}
                            </small>
                          </span>
                        </label>
                        <div className="inline">
                          <button
                            aria-label={`Потратить ${item.name}`}
                            disabled={item.quantity === 0}
                            onClick={() =>
                              void save((v) => ({
                                ...v,
                                inventory: v.inventory.map((i) =>
                                  i.id === item.id
                                    ? { ...i, quantity: i.quantity - 1 }
                                    : i,
                                ),
                              }))
                            }
                          >
                            <Minus size={16} />
                          </button>
                          <strong>{item.quantity}</strong>
                          <button
                            aria-label={`Добавить ${item.name}`}
                            disabled={item.quantity >= 9999}
                            onClick={() =>
                              void save((v) => ({
                                ...v,
                                inventory: v.inventory.map((i) =>
                                  i.id === item.id
                                    ? { ...i, quantity: i.quantity + 1 }
                                    : i,
                                ),
                              }))
                            }
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              )}
              {tab === "История" && (
                <section className="panel">
                  <h3>За именем — целая жизнь</h3>
                  <p className="muted">
                    История и портрет сохраняются только на этом устройстве.
                  </p>
                  <label className="upload button secondary">
                    <Upload size={16} />
                    Загрузить портрет
                    <input
                      autoComplete="off"
                      className="file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => void portrait(e.target.files?.[0])}
                    />
                  </label>
                  <p className="hint">PNG, JPEG, WebP · до 2 МБ</p>
                  <label>
                    История персонажа
                    <textarea
                      key={s.version}
                      defaultValue={s.lore}
                      rows={12}
                      onChange={(e) => {
                        const text = e.target.value;
                        void save((v) => ({ ...v, lore: text }));
                      }}
                      maxLength={30000}
                    />
                  </label>
                  <p className="hint">
                    Текст сохраняется автоматически на этом устройстве.
                  </p>
                </section>
              )}
              {s.drafts.length > 0 && (
                <section className="panel drafts">
                  <h3>Черновики персонажей</h3>
                  {s.drafts.map((d) => (
                    <div className="skill-row" key={d.id}>
                      <span>
                        {d.name}
                        <small>
                          {d.ancestry} · {d.className}
                        </small>
                      </span>
                      <span className="tag">Не проверен</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {page === "create" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">НОВАЯ ИСТОРИЯ</div>
                <h1>Кем вы станете?</h1>
                <p className="muted">
                  Начните с образа. Детали придадут ему жизнь.
                </p>
              </div>
              <div className="creation-layout">
                <section className="panel">
                  <ol className="steps">
                    {["Образ", "Класс", "Черновик"].map((x, i) => (
                      <li
                        key={x}
                        className={draftStep === i + 1 ? "current" : ""}
                      >
                        <span>{i + 1}</span>
                        {x}
                      </li>
                    ))}
                  </ol>
                  <p className="notice">
                    Это прототип создания. Он сохраняет замысел персонажа;
                    проверка правил, характеристики и повышение уровня ещё
                    разрабатываются.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draftStep < 3) setDraftStep(draftStep + 1);
                      else if (draftName.trim()) {
                        void save(
                          (v) => ({
                            ...v,
                            drafts: [
                              ...v.drafts,
                              {
                                id: crypto.randomUUID(),
                                name: draftName.trim(),
                                ancestry: draftRace,
                                className: draftClass,
                              },
                            ],
                          }),
                          "Черновик сохранён",
                        ).then((ok) => {
                          if (!ok) return;
                          location.hash = "character";
                          setDraftStep(1);
                          setDraftName("");
                        });
                      }
                    }}
                  >
                    {draftStep === 1 && (
                      <>
                        <h2>Сначала — имя и происхождение</h2>
                        <label>
                          Имя персонажа
                          <input
                            autoComplete="off"
                            required
                            maxLength={80}
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Как зовут вашего героя…"
                          />
                        </label>
                        <label>
                          Происхождение
                          <select
                            value={draftRace}
                            onChange={(e) => setDraftRace(e.target.value)}
                          >
                            {[
                              "Человек",
                              "Эльф",
                              "Дварф",
                              "Полурослик",
                              "Гном",
                              "Полуэльф",
                              "Полуорк",
                              "Тифлинг",
                              "Драконорождённый",
                            ].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    {draftStep === 2 && (
                      <>
                        <h2>Выберите направление</h2>
                        <p className="muted">
                          В полной версии здесь будут объяснения особенностей,
                          роли в группе и выбора на каждом уровне.
                        </p>
                        <label>
                          Начальный класс
                          <select
                            value={draftClass}
                            onChange={(e) => setDraftClass(e.target.value)}
                          >
                            {classes.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </label>
                        <div className="choice-preview">
                          <BookOpen size={32} />
                          <h3>{draftClass}</h3>
                          <p>
                            Выбор сохранится в черновике. Механики класса ещё не
                            применяются.
                          </p>
                        </div>
                      </>
                    )}
                    {draftStep === 3 && (
                      <>
                        <h2>{draftName}</h2>
                        <p>
                          {draftRace} · {draftClass}
                        </p>
                        <p className="muted">
                          Следующий этап разработки добавит характеристики,
                          предыстории, навыки, черты и проверку обязательных
                          выборов.
                        </p>
                      </>
                    )}
                    <div className="form-footer">
                      {draftStep > 1 ? (
                        <button
                          type="button"
                          onClick={() => setDraftStep(draftStep - 1)}
                        >
                          Назад
                        </button>
                      ) : (
                        <a href="#character">К листу персонажа</a>
                      )}
                      <button className="primary">
                        {draftStep === 3 ? "Сохранить черновик" : "Продолжить"}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </form>
                </section>
                <aside className="quiet-note">
                  <Sparkles size={24} />
                  <h3>Каждый выбор понятен</h3>
                  <p>
                    В будущем мастер создания будет объяснять правила в нужный
                    момент и показывать, что ещё нужно выбрать.
                  </p>
                  <p>
                    Официальные материалы и homebrew будут отмечены отдельно.
                  </p>
                </aside>
              </div>
            </>
          )}
          {page === "journal" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">НИ ОДНА ЗАЦЕПКА НЕ ПОТЕРЯЕТСЯ</div>
                  <h1>Журнал приключений</h1>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    const id = crypto.randomUUID();
                    void save((v) => ({
                      ...v,
                      notes: [
                        {
                          id,
                          title: `Сессия ${v.notes.length + 1}`,
                          campaign: "Без кампании",
                          date: new Date().toISOString(),
                          text: "",
                        },
                        ...v.notes,
                      ],
                    })).then((ok) => {
                      if (ok) setNoteId(id);
                    });
                  }}
                >
                  <Plus size={16} />
                  Новая сессия
                </button>
              </div>
              {s.notes.length === 0 ? (
                <section className="panel">
                  <Empty
                    title="Первая страница вашей истории"
                    text="Создайте заметку сессии. Укажите название кампании или ваншота — записи с одинаковым названием будут собраны вместе."
                  />
                </section>
              ) : (
                <div className="journal-grid">
                  <aside className="panel note-list">
                    {[...new Set(s.notes.map((n) => n.campaign))].map((c) => (
                      <div key={c}>
                        <div className="eyebrow">{c}</div>
                        {s.notes
                          .filter((n) => n.campaign === c)
                          .map((n) => (
                            <button
                              key={n.id}
                              className={
                                activeNote?.id === n.id ? "selected" : ""
                              }
                              onClick={() => setNoteId(n.id)}
                            >
                              <ScrollText size={16} />
                              <span>
                                {n.title}
                                <small>
                                  {new Intl.DateTimeFormat("ru", {
                                    dateStyle: "medium",
                                  }).format(new Date(n.date))}
                                </small>
                              </span>
                            </button>
                          ))}
                      </div>
                    ))}
                  </aside>
                  {activeNote && (
                    <section className="panel note-editor" key={activeNote.id}>
                      <div className="eyebrow">ЗАПИСЬ СЕССИИ</div>
                      <label>
                        Название
                        <input
                          autoComplete="off"
                          maxLength={150}
                          defaultValue={activeNote.title}
                          onBlur={(e) => {
                            if (e.target.value.trim())
                              void save((v) => ({
                                ...v,
                                notes: v.notes.map((n) =>
                                  n.id === activeNote.id
                                    ? { ...n, title: e.target.value.trim() }
                                    : n,
                                ),
                              }));
                          }}
                        />
                      </label>
                      <label>
                        Кампания или ваншот
                        <input
                          autoComplete="off"
                          maxLength={100}
                          defaultValue={activeNote.campaign}
                          onBlur={(e) => {
                            if (e.target.value.trim())
                              void save((v) => ({
                                ...v,
                                notes: v.notes.map((n) =>
                                  n.id === activeNote.id
                                    ? { ...n, campaign: e.target.value.trim() }
                                    : n,
                                ),
                              }));
                          }}
                        />
                      </label>
                      <label>
                        Что произошло
                        <textarea
                          rows={15}
                          maxLength={30000}
                          defaultValue={activeNote.text}
                          placeholder="События, встречи, добыча, планы на следующую сессию…"
                          onChange={(e) => {
                            const text = e.target.value;
                            void save((v) => ({
                              ...v,
                              notes: v.notes.map((n) =>
                                n.id === activeNote.id ? { ...n, text } : n,
                              ),
                            }));
                          }}
                        />
                      </label>
                      <p className="hint">
                        Текст сохраняется автоматически; названия — при выходе
                        из поля.
                      </p>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
          {page === "library" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">ЗНАНИЯ ПОД РУКОЙ</div>
                <h1>Библиотека</h1>
                <p className="muted">Официальные правила и авторские миры.</p>
              </div>
              <p className="notice">
                Пока здесь только названия 9 заклинаний Гу Ченя для проверки
                поиска. Полный каталог 2014 и homebrew dnd.su ещё не подключён.
              </p>
              <section className="panel">
                <SpellSearch query={query} setQuery={setQuery} />
                <SpellList list={spellList} />
              </section>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">ВСЁ НА СВОЁМ МЕСТЕ</div>
                <h1>Настройки</h1>
              </div>
              <div className="settings-grid">
                <section className="panel">
                  <h3>Ваши данные</h3>
                  <p className="muted">
                    Лист, заметки и портрет хранятся в этом браузере. Очистка
                    данных сайта удалит их. Сохраняйте копии вне приложения.
                  </p>
                  <button className="primary" onClick={exportBackup}>
                    <Download size={17} />
                    Скачать резервную копию
                  </button>
                  <label className="button secondary upload">
                    <Upload size={17} />
                    Восстановить из файла
                    <input
                      autoComplete="off"
                      className="file-input"
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        void importBackup(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="hint">JSON · версия 1 · до 5 МБ</p>
                </section>
                <section className="panel">
                  <h3>Отображение и доступность</h3>
                  <label className="checkbox">
                    <input
                      autoComplete="off"
                      type="checkbox"
                      checked={s.metric}
                      onChange={() =>
                        void save((v) => ({ ...v, metric: !v.metric }))
                      }
                    />
                    Метрические единицы
                  </label>
                  <p className="hint">
                    Храним исходные единицы. 30 футов ≈ 9,14 м; округление сетки
                    будет отдельной настройкой.
                  </p>
                  <div className="divider" />
                  <h3>Работа без интернета</h3>
                  <p className="muted">
                    {offlineReady || cached
                      ? "Файлы приложения подготовлены для офлайн-доступа."
                      : "Для офлайн-доступа нужна загруженная production-сборка. В режиме разработки кеш не включён."}
                  </p>
                  {needRefresh && (
                    <button onClick={() => void updateServiceWorker(true)}>
                      Применить обновление
                    </button>
                  )}
                </section>
              </div>
            </>
          )}
          {!["character", "create", "journal", "library", "settings"].includes(
            page,
          ) && (
            <Empty title="Страница не найдена" text="Выберите раздел в меню." />
          )}
          <footer className="page-footer">
            <span>
              DND Workbench <span className="gold">✧</span> Личный стол
              приключений
            </span>
            <span>Прототип интерфейса · правила внедряются поэтапно</span>
          </footer>
        </main>
        <div
          className={`save-status ${error ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {error || status}
        </div>
      </div>
    </div>
  );
}
function SpellSearch({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (s: string) => void;
}) {
  return (
    <label className="search">
      <Search size={18} />
      <span className="sr-only">Поиск заклинаний</span>
      <input
        autoComplete="off"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Название на русском или английском…"
      />
    </label>
  );
}
function SpellList({ list }: { list: string[][] }) {
  return (
    <div>
      {list.length === 0 ? (
        <Empty
          title="Ничего не найдено"
          text="Попробуйте другое название. В прототипе доступно 9 записей."
        />
      ) : (
        list.map(([ru, en, level]) => (
          <div className="spell-row" key={en}>
            <div className="spell-symbol">
              <Sparkles size={18} />
            </div>
            <span>
              <strong>{ru}</strong>
              <small>{en}</small>
            </span>
            <span className="tag">{level}</span>
          </div>
        ))
      )}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <BookOpen size={36} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
