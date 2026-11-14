import { findSpells, SpellList, SpellSearch } from "./Spells";

export function Library({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (value: string) => void;
}) {
  const spellList = findSpells(query);
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">ЗНАНИЯ ПОД РУКОЙ</div>
        <h1>Библиотека</h1>
        <p className="muted">Официальные правила и авторские миры.</p>
      </div>
      <p className="notice">
        Пока здесь только названия 9 заклинаний Гу Ченя для проверки поиска.
        Полный каталог 2014 и homebrew dnd.su ещё не подключён.
      </p>
      <section className="panel">
        <SpellSearch query={query} setQuery={setQuery} />
        <SpellList list={spellList} />
      </section>
    </>
  );
}
