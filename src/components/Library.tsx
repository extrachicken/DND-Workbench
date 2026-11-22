import { useState } from "react";
import { referenceGroups } from "../creation-reference";
import { RuleHelp } from "./RuleHelp";
import { findSpells, SpellList, SpellSearch } from "./Spells";

export function Library({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (value: string) => void;
}) {
  const [section, setSection] = useState<"creation" | "spells">("creation");
  const [search, setSearch] = useState("");
  const queryText = search.trim().toLocaleLowerCase("ru");
  const groups = Object.entries(referenceGroups)
    .map(([title, entries]) => ({
      title,
      entries: entries.filter((e) =>
        (e.name + " " + e.english).toLocaleLowerCase("ru").includes(queryText),
      ),
    }))
    .filter((g) => g.entries.length);
  return (
    <>
      <div className="page-heading">
        <h1>Библиотека</h1>
      </div>
      <div className="actions library-switch">
        <button
          aria-pressed={section === "creation"}
          onClick={() => setSection("creation")}
        >
          Создание персонажа
        </button>
        <button
          aria-pressed={section === "spells"}
          onClick={() => setSection("spells")}
        >
          Книга заклинаний
        </button>
      </div>
      <section className="panel">
        {section === "creation" ? (
          <>
            <h2>Справочник персонажа</h2>
            <label>
              Поиск по названию
              <input
                type="search"
                value={search}
                placeholder="Мудрец, Rogue…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {groups.length ? (
              groups.map(({ title, entries }) => (
                <section key={title} className="reference-group">
                  <h3>{title}</h3>
                  <ul className="reference-list">
                    {entries.map((entry) => (
                      <li key={entry.english}>
                        <RuleHelp entry={entry} />
                        <small>{entry.english}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p>
                Ничего не найдено. Попробуйте русское или английское название.
              </p>
            )}
          </>
        ) : (
          <>
            <h2>Книга заклинаний Гу Ченя</h2>
            <SpellSearch query={query} setQuery={setQuery} />
            <SpellList list={findSpells(query)} />
          </>
        )}
      </section>
    </>
  );
}
