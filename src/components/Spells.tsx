import { Search, Sparkles } from "lucide-react";
import { Empty } from "./Empty";

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

export function findSpells(query: string) {
  return spells.filter((x) =>
    x.join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
}

export function SpellSearch({
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
export function SpellList({ list }: { list: string[][] }) {
  return (
    <div>
      {list.length === 0 ? (
        <Empty
          title="Ничего не найдено"
          text="Попробуйте часть русского или английского названия."
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
