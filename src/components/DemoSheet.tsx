import {
  Check,
  ChevronRight,
  Dice5,
  Feather,
  Heart,
  Minus,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
  Sword,
  Upload,
  Zap,
} from "lucide-react";
import {
  damage,
  heal,
  modifier,
  rollDie,
  signed,
  type Workspace,
} from "../model";
import { Empty } from "./Empty";
import { findSpells, SpellList, SpellSearch } from "./Spells";

export type SaveSheet = (
  update: (s: Workspace) => Workspace,
  message?: string,
) => Promise<boolean>;
export type SheetControls = {
  tab: string;
  setTab: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  roll: string;
  setRoll: (value: string) => void;
  die: number;
  setDie: (value: number) => void;
  physical: string;
  setPhysical: (value: string) => void;
};

const stats = [
  ["Сила", 4],
  ["Ловкость", 16],
  ["Телосложение", 17],
  ["Интеллект", 20],
  ["Мудрость", 14],
  ["Харизма", 12],
] as const;

export function DemoSheet({
  s,
  save,
  controls,
  query,
  setQuery,
  setError,
}: {
  s: Workspace;
  save: SaveSheet;
  controls: SheetControls;
  query: string;
  setQuery: (value: string) => void;
  setError: (message: string) => void;
}) {
  const {
    tab,
    setTab,
    amount,
    setAmount,
    roll,
    setRoll,
    die,
    setDie,
    physical,
    setPhysical,
  } = controls;
  const number = Number(amount);
  const amountValid =
    amount.trim() !== "" &&
    Number.isInteger(number) &&
    number >= 0 &&
    number <= 9999;
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
  const spellList = findSpells(query);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ИСТОРИЯ ПРОДОЛЖАЕТСЯ</div>
          <h1>Ваш персонаж</h1>
        </div>
        <a className="button secondary create-link" href="#create">
          <Plus size={17} />
          <span className="wide-label">Создать персонажа</span>
          <span className="compact-label">Создать</span>
        </a>
      </div>
      <a className="back-link" href="#characters">
        ← Все персонажи
      </a>
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
            Человек · Мудрец <span className="dot-separator">·</span> Савант 3 /
            Волшебник 1
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
      <div className="sheet-tabs" role="group" aria-label="Разделы листа">
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
                  <span className="muted small">Состояние учебной копии</span>
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
                  <div style={{ width: `${(s.hp / s.maxHp) * 100}%` }} />
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
                      void save((v) => heal(v, number), "Лечение учтено")
                    }
                  >
                    <Plus size={16} />
                    Лечение
                  </button>
                </div>
                <p className="hint">Урон сначала расходует временные хиты.</p>
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
                      {s.slotsRemaining === null ? "?" : s.slotsRemaining}
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
                        className={s.slotsRemaining === n ? "chosen" : ""}
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
                      s.slotsRemaining === null || s.slotsRemaining === 0
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
                    Бдительный — от альтернативного человека. Внимательный —
                    дополнительная черта, разрешённая мастером. Проверка всех
                    способностей саванта появится на следующем этапе.
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
                  <span>{s.metric ? "Скорость, м" : "Скорость, фт"}</span>
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
                  Сохраните важную встречу, новую зацепку или обещание, которое
                  нельзя забыть.
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
            Список для проверки интерфейса. Подготовка, описания и применение
            заклинаний появятся позже.
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
              const name = String(new FormData(f).get("item") || "").trim();
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
    </>
  );
}
