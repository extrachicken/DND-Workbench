import { useLiveQuery } from "dexie-react-hooks";
import { decodeBackup } from "../migrations";
import { Download, Upload } from "lucide-react";
import { db, replaceWorkspace } from "../db";
import {
  encodeBackup,
  MAX_BACKUP_BYTES,
  type AppWorkspace,
} from "../workspace";
import type { SaveWorkspace } from "./Characters";

export function Settings({
  workspace,
  save,
  offlineReady,
  needRefresh,
  updateServiceWorker,
  setStatus,
  setError,
}: {
  workspace: AppWorkspace;
  save: SaveWorkspace;
  offlineReady: boolean;
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  setStatus: (message: string) => void;
  setError: (message: string) => void;
}) {
  const recovery = useLiveQuery(() => db.recovery.toArray());
  function downloadJson(raw: string, filename: string) {
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportBackup() {
    try {
      downloadJson(
        encodeBackup(workspace),
        `workbench-${new Date().toISOString().slice(0, 10)}.dndwb.json`,
      );
      setStatus("Резервная копия подготовлена");
    } catch {
      setError(
        "Не удалось подготовить копию. Уменьшите размер портретов; общий лимит — 50 МБ.",
      );
    }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error();
      const imported = decodeBackup(await file.text());
      if (
        !confirm(
          `В файле ${imported.characters.length} персонажей и ${imported.notes.length} записей. Заменить текущие данные? Текущее состояние сохранится в точке восстановления.`,
        )
      )
        return;
      await replaceWorkspace(imported);
      setStatus("Резервная копия восстановлена");
      setError("");
    } catch {
      setError(
        "Не удалось восстановить копию. Нужен JSON Workbench версии 1, 2 или 3 до 50 МБ и достаточно места в браузере. Исходные данные сохранены.",
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">ВСЁ НА СВОЁМ МЕСТЕ</div>
        <h1>Настройки</h1>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h3>Ваши данные</h3>
          <p className="muted">
            Лист, заметки и портрет хранятся в этом браузере. Очистка данных
            сайта удалит их. Сохраняйте копии вне приложения.
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
          <p className="hint">
            JSON · версия 3 · до 50 МБ · импорт версий 1 и 2 поддерживается
          </p>
        </section>
        <section className="panel">
          <h3>Точки восстановления</h3>
          <p className="muted">
            Снимки перед обновлениями формата и состояние перед последним
            импортом. Скачайте нужную копию и восстановите её через импорт. Они
            хранятся в этом браузере и не заменяют внешний бэкап.
          </p>
          {recovery?.length ? (
            recovery.map((r) => (
              <div className="recovery-row" key={r.id}>
                <span>
                  {r.reason === "migration-v1"
                    ? "До перехода на несколько персонажей"
                    : r.reason === "migration-v2"
                      ? "До разделения сборки и состояния"
                      : "До последнего импорта"}
                  <small>
                    {new Intl.DateTimeFormat("ru", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(r.createdAt))}
                  </small>
                </span>
                <button
                  aria-label={`Скачать снимок: ${r.reason.startsWith("migration-") ? "до миграции" : "до импорта"}`}
                  onClick={() =>
                    downloadJson(
                      JSON.stringify(r.data),
                      `workbench-recovery-${r.id}.dndwb.json`,
                    )
                  }
                >
                  <Download size={17} />
                </button>
              </div>
            ))
          ) : (
            <p className="hint">
              Снимки появятся при миграции или импорте данных.
            </p>
          )}
        </section>
        <section className="panel">
          <h3>Отображение и доступность</h3>
          <label className="checkbox">
            <input
              autoComplete="off"
              type="checkbox"
              checked={workspace.metric}
              onChange={() => void save((v) => ({ ...v, metric: !v.metric }))}
            />
            Метрические единицы
          </label>
          <p className="hint">
            Храним исходные единицы. 30 футов ≈ 9,14 м; округление сетки будет
            отдельной настройкой.
          </p>
          <div className="divider" />
          <h3>Работа без интернета</h3>
          <p className="muted">
            {offlineReady
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
  );
}
