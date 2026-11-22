import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  BookOpen,
  Bookmark,
  ChevronRight,
  Feather,
  Settings as SettingsIcon,
  Users,
  X,
} from "lucide-react";
import { db, initialize, changeWorkspace } from "./db";
import {
  activeCharacter,
  updateCharacter,
  type AppWorkspace,
} from "./workspace";
import type { Character } from "./character";
import {
  Characters,
  DraftEditor,
  type SaveWorkspace,
} from "./components/Characters";
import { PlayerSheet } from "./components/PlayerSheet";
import { GuChenSheet } from "./components/GuChenSheet";
import { Journal } from "./components/Journal";
import { Library } from "./components/Library";
import { Settings } from "./components/Settings";
import { Empty } from "./components/Empty";
import { characterRoute, usePage } from "./hooks/usePage";

const nav = [
  { id: "characters", title: "Персонажи", icon: Users },
  { id: "journal", title: "Журнал", icon: BookOpen },
  { id: "library", title: "Библиотека", icon: Bookmark },
  { id: "settings", title: "Настройки", icon: SettingsIcon },
];
export function App() {
  const [dirty, setDirty] = useState(false);
  const route = usePage(dirty);
  const page = route.startsWith("character/") ? "character" : route;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);
  const data = useLiveQuery(() => db.documents.get("local"));

  const lastCharacterId = data?.data.activeCharacterId;
  useEffect(() => {
    if (
      route === "character" &&
      location.hash === "#character" &&
      lastCharacterId
    ) {
      location.replace("#" + characterRoute(lastCharacterId));
    }
  }, [route, lastCharacterId]);

  const [cached, setCached] = useState(false);
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      void navigator.serviceWorker.ready.then(() => setCached(true));
  }, []);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  // Keep transient screen state here so navigation does not reset it on unmount.
  const [tab, setTab] = useState("Обзор");
  const [amount, setAmount] = useState("5");
  const [query, setQuery] = useState("");
  const [roll, setRoll] = useState("");
  const [die, setDie] = useState(20);
  const [physical, setPhysical] = useState("");
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
  const saveApp = useCallback(async function saveApp(
    update: (s: AppWorkspace) => AppWorkspace,
    message = "Сохранено на устройстве",
  ) {
    try {
      await changeWorkspace(update);
      setStatus(message);
      setError("");
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.includes("другой вкладке")
          ? cause.message
          : "Не удалось сохранить изменения. Проверьте поля, свободное место и разрешение на хранение данных.",
      );
      return false;
    }
  }, []);
  if (!data)
    return (
      <main className="loading">
        <img src="/icon.svg" width="64" height="64" alt="" />
        <h1>Workbench</h1>
        <p role="status">{error || "Открываем ваш стол приключений…"}</p>
      </main>
    );
  const workspace = data.data;
  const character = route.startsWith("character/")
    ? workspace.characters.find((c) => characterRoute(c.id) === route)
    : activeCharacter(workspace);
  async function save(update: (s: Character) => Character, message?: string) {
    return saveApp((v) => updateCharacter(v, character!.id, update), message);
  }
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
      <aside className="sidebar" aria-label="Меню рабочего стола">
        <a href="#characters" className="brand">
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
              className={
                page === id ||
                (id === "characters" && ["character", "create"].includes(page))
                  ? "active"
                  : ""
              }
              aria-current={
                page === id ||
                (id === "characters" && ["character", "create"].includes(page))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={19} aria-hidden="true" />
              <span>{title}</span>
              {page === id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="side-campaign">
          <span className="eyebrow">ТЕКУЩИЙ ПЕРСОНАЖ</span>
          {character ? (
            <>
              <a href={"#" + characterRoute(character.id)}>
                <div className="avatar tiny">
                  <Feather size={17} />
                </div>
                <div>
                  <strong>{character.build.name}</strong>
                  <small>{character.build.className}</small>
                </div>
              </a>
              <span className="tag">
                {character.kind === "draft" ? "Черновик" : "Игровой лист"}
              </span>
            </>
          ) : (
            <p className="hint">Выберите персонажа в списке</p>
          )}
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
        </header>
        <main id="main" tabIndex={-1}>
          {page === "characters" && (
            <Characters workspace={workspace} save={saveApp} />
          )}
          {page === "character" && (
            <CharacterPage
              key={route}
              character={character}
              campaigns={workspace.campaigns}
              save={saveApp}
              dirty={dirty}
              onDirty={setDirty}
            >
              {character?.kind === "player" && (
                <PlayerSheet
                  character={character}
                  campaign={workspace.campaigns.find(
                    (c) => c.id === character.build.campaignId,
                  )}
                  save={saveApp}
                />
              )}
              {character?.kind === "demo" && (
                <GuChenSheet
                  character={character}
                  metric={workspace.metric}
                  save={save}
                  controls={{
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
                  }}
                  query={query}
                  setQuery={setQuery}
                  setError={setError}
                />
              )}
            </CharacterPage>
          )}
          {page === "create" && (
            <DraftEditor
              key="new-character"
              campaigns={workspace.campaigns}
              save={saveApp}
              onDirty={setDirty}
            />
          )}
          {page === "journal" && (
            <Journal
              workspace={workspace}
              save={saveApp}
              noteId={noteId}
              setNoteId={setNoteId}
              onDirty={setDirty}
            />
          )}
          {page === "library" && <Library query={query} setQuery={setQuery} />}
          {page === "settings" && (
            <Settings
              workspace={workspace}
              save={saveApp}
              offlineReady={offlineReady || cached}
              needRefresh={needRefresh}
              updateServiceWorker={updateServiceWorker}
              setStatus={setStatus}
              setError={setError}
            />
          )}
          {![
            "characters",
            "character",
            "create",
            "journal",
            "library",
            "settings",
          ].includes(page) && (
            <Empty title="Страница не найдена" text="Выберите раздел в меню." />
          )}
          <footer className="page-footer">
            <span>
              DND Workbench <span className="gold">✧</span> Личный стол
              приключений
            </span>
          </footer>
        </main>
        <div
          className={`save-status ${error ? "error" : ""}`}
          hidden={!error && !status}
        >
          <span role="status" aria-live="polite">
            {error || status}
          </span>
          {(error || status) && (
            <button
              aria-label="Закрыть уведомление"
              onClick={() => {
                setError("");
                setStatus("");
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CharacterPage({
  character,
  campaigns,
  save,
  dirty,
  onDirty,
  children,
}: {
  character?: Character;
  campaigns: AppWorkspace["campaigns"];
  save: SaveWorkspace;
  dirty: boolean;
  onDirty: (value: boolean) => void;
  children: ReactNode;
}) {
  const liveDraft =
    character?.kind === "draft" && !character.archivedAt
      ? character
      : undefined;
  const [initialDraft] = useState(liveDraft);
  const draft = dirty && initialDraft ? initialDraft : liveDraft;
  if (draft)
    return (
      <>
        {!liveDraft && (
          <p className="notice">
            Исходный черновик заменён или перенесён в архив. Введённый текст
            можно скопировать из открытых полей.
          </p>
        )}
        <DraftEditor
          character={draft}
          campaigns={campaigns}
          save={save}
          onDirty={onDirty}
        />
      </>
    );
  if (character && !character.archivedAt) return children;
  return (
    <section className="panel empty">
      <h1>Выберите персонажа</h1>
      <p>
        Откройте персонажа из списка. Персонажей в архиве можно восстановить.
      </p>
      <a className="button primary" href="#characters">
        К персонажам
      </a>
    </section>
  );
}
