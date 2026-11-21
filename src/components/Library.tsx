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
        <p className="muted">Книга заклинаний</p>
      </div>
      <p className="notice">
        В библиотеке 9 заклинаний из книги Гу Ченя. Ищите их по русскому или
        английскому названию.
      </p>
      <section className="panel">
        <SpellSearch query={query} setQuery={setQuery} />
        <SpellList list={spellList} />
      </section>
    </>
  );
}
