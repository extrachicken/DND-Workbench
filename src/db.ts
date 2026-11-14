import { jsonBytes, jsonSizeDelta } from "./backup-size";
import Dexie, { type Table } from "dexie";
import {
  appWorkspaceSchema,
  serializeBackup,
  MAX_BACKUP_BYTES,
  initialAppWorkspace,
  type AppWorkspace,
} from "./workspace";
import { migrateLegacy, migrateV2, migrateV3 } from "./migrations";

export type RecoverySnapshot = {
  id: string;
  createdAt: string;
  reason: "migration-v1" | "migration-v2" | "migration-v3" | "before-import";
  data: unknown;
};
export class WorkbenchDB extends Dexie {
  documents!: Table<
    { id: string; data: AppWorkspace; backupBytes?: number },
    string
  >;
  recovery!: Table<RecoverySnapshot, string>;
  constructor(name = "dnd-workbench") {
    super(name);
    // Historical schemas are only upgrade paths. Runtime uses documents alone.
    this.version(1).stores({ workspace: "id" });
    this.version(2).stores({
      workspace: "id",
      documents: "id",
      recovery: "id,createdAt",
    });
    this.version(3)
      .stores({ workspace: "id", documents: "id", recovery: "id,createdAt" })
      .upgrade(async (tx) => {
        const document = await tx.table("documents").get("local");
        const legacy = await tx.table("workspace").get("local");
        if (legacy && !(await tx.table("recovery").get("migration-v1"))) {
          await tx.table("recovery").put({
            id: "migration-v1",
            createdAt: new Date().toISOString(),
            reason: "migration-v1",
            data: legacy.data,
          });
        }
        if (document) {
          const migrated = migrateV2(document.data);
          serializeBackup(migrated);
          await tx.table("recovery").put({
            id: "migration-v2",
            createdAt: new Date().toISOString(),
            reason: "migration-v2",
            data: document.data,
          });
          await tx.table("documents").put({
            id: "local",
            data: migrated,
            backupBytes: jsonBytes(migrated),
          });
        } else if (legacy) {
          const migrated = migrateLegacy(legacy.data);
          serializeBackup(migrated);
          await tx.table("documents").put({
            id: "local",
            data: migrated,
            backupBytes: jsonBytes(migrated),
          });
        }
      });
    // Drop the obsolete store only after its snapshot and migration succeeded.
    // Dexie needs a separate schema step to read a store before removing it.
    this.version(4).stores({
      workspace: null,
      documents: "id",
      recovery: "id,createdAt",
    });
    this.version(5)
      .stores({ documents: "id", recovery: "id,createdAt" })
      .upgrade(async (tx) => {
        const document = await tx.table("documents").get("local");
        // Earlier upgrade paths already produce the current model.
        if (!document || document.data.version === 4) return;
        const migrated = migrateV3(document.data);
        serializeBackup(migrated);
        await tx.table("recovery").put({
          id: "migration-v3",
          createdAt: new Date().toISOString(),
          reason: "migration-v3",
          data: document.data,
        });
        await tx.table("documents").put({
          id: "local",
          data: migrated,
          backupBytes: jsonBytes(migrated),
        });
      });
  }
}
export const db = new WorkbenchDB();
export async function initialize(database = db) {
  await database.transaction("rw", database.documents, async () => {
    if (!(await database.documents.get("local"))) {
      const data = initialAppWorkspace();
      await database.documents.add({
        id: "local",
        data,
        backupBytes: jsonBytes(data),
      });
    }
  });
}
// Update callbacks must return new objects. Guard the byte-size baseline against
// accidental in-place mutation before computing its delta.
function freezeJson(value: unknown): void {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeJson(child);
  }
}
export async function changeWorkspace(
  update: (s: AppWorkspace) => AppWorkspace,
  database = db,
) {
  await database.transaction("rw", database.documents, async () => {
    const current = await database.documents.get("local");
    if (!current) throw new Error("Хранилище ещё не готово");
    freezeJson(current.data);
    const validated = appWorkspaceSchema.parse(update(current.data));
    const backupBytes =
      (current.backupBytes ?? jsonBytes(current.data)) +
      jsonSizeDelta(current.data, validated);
    if (backupBytes > MAX_BACKUP_BYTES)
      throw new Error("Копия превышает 50 МБ. Уменьшите портреты.");
    await database.documents.put({ id: "local", data: validated, backupBytes });
  });
}
export async function replaceWorkspace(imported: AppWorkspace, database = db) {
  const validated = appWorkspaceSchema.parse(imported);
  serializeBackup(validated);
  await database.transaction(
    "rw",
    database.documents,
    database.recovery,
    async () => {
      const current = await database.documents.get("local");
      if (!current) throw new Error("Хранилище ещё не готово");
      await database.recovery.put({
        id: "before-import",
        createdAt: new Date().toISOString(),
        reason: "before-import",
        data: current.data,
      });
      await database.documents.put({
        id: "local",
        data: validated,
        backupBytes: jsonBytes(validated),
      });
    },
  );
}
