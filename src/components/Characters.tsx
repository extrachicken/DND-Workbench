import {
  Archive,
  ChevronRight,
  Feather,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { useState } from "react";
import { characterRoute } from "../hooks/usePage";
import {
  archiveCharacter,
  restoreCharacter,
  selectCharacter,
  type AppWorkspace,
} from "../workspace";

export type SaveWorkspace = (
  update: (s: AppWorkspace) => AppWorkspace,
  message?: string,
) => Promise<boolean>;
export function Characters({
  workspace,
  save,
}: {
  workspace: AppWorkspace;
  save: SaveWorkspace;
}) {
  const [archived, setArchived] = useState(false);
  const characters = workspace.characters.filter(
    (c) => Boolean(c.archivedAt) === archived,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">КАЖДАЯ ИСТОРИЯ — ВАША</div>
          <h1>Персонажи</h1>
        </div>
        <a className="button primary create-link" href="#create">
          <Plus size={18} />
          <span className="wide-label">Создать персонажа</span>
          <span className="compact-label">Создать</span>
        </a>
      </div>
      <div className="sheet-tabs" role="group" aria-label="Список персонажей">
        <button
          aria-pressed={!archived}
          className={!archived ? "selected" : ""}
          onClick={() => setArchived(false)}
        >
          За столом · {workspace.characters.filter((c) => !c.archivedAt).length}
        </button>
        <button
          aria-pressed={archived}
          className={archived ? "selected" : ""}
          onClick={() => setArchived(true)}
        >
          Архив · {workspace.characters.filter((c) => c.archivedAt).length}
        </button>
      </div>
      {characters.length === 0 ? (
        <section className="panel empty">
          <Users size={36} />
          <h2>{archived ? "Архив пуст" : "Новая история ждёт"}</h2>
          <p>
            {archived
              ? "Архив сохраняет персонажей целиком. Их всегда можно вернуть к игре."
              : "Создайте персонажа или восстановите его из архива."}
          </p>
        </section>
      ) : (
        <div className="character-cards">
          {characters.map((c) => (
            <article
              className={`panel character-card ${c.id === workspace.activeCharacterId ? "is-active" : ""}`}
              key={c.id}
            >
              <div className="inline">
                <div className="avatar tiny">
                  {c.build.portrait ? (
                    <img src={c.build.portrait} width="42" height="48" alt="" />
                  ) : (
                    <Feather size={20} />
                  )}
                </div>
                <span className="tag">
                  {c.kind === "draft" ? "Черновик" : "Игровой лист"}
                </span>
                {c.id === workspace.activeCharacterId && (
                  <span className="active-label">Выбран</span>
                )}
              </div>
              <h2>{c.build.name}</h2>
              <p>
                {c.build.ancestry}
                <br />
                <span className="muted">{c.build.className}</span>
              </p>
              <p className="hint">
                {c.kind === "demo"
                  ? "Хиты, ячейки, снаряжение и история"
                  : c.kind === "player"
                    ? `Хиты ${c.runtime.hp} / ${c.build.maxHp}`
                    : c.build.progression
                      ? "Характеристики, уровни и владения сохранены."
                      : "Образ и история. Можно добавить характеристики и уровни."}
              </p>
              <div className="card-actions">
                {archived ? (
                  <button
                    className="primary"
                    onClick={() =>
                      void save(
                        (s) => restoreCharacter(s, c.id),
                        "Персонаж восстановлен",
                      )
                    }
                  >
                    <RotateCcw size={16} />
                    Восстановить
                  </button>
                ) : (
                  <>
                    <button
                      className="primary"
                      onClick={() =>
                        void save((s) => selectCharacter(s, c.id), "").then(
                          (ok) => {
                            if (ok) location.hash = characterRoute(c.id);
                          },
                        )
                      }
                    >
                      {c.kind === "draft" ? "Открыть черновик" : "Открыть лист"}
                      <ChevronRight size={16} />
                    </button>
                    <button
                      aria-label={`В архив: ${c.build.name}`}
                      title="В архив — можно восстановить"
                      onClick={() =>
                        void save(
                          (s) => archiveCharacter(s, c.id),
                          "Персонаж в архиве. Восстановление доступно во вкладке «Архив».",
                        )
                      }
                    >
                      <Archive size={17} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
