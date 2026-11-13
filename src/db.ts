import Dexie, { type Table } from "dexie";
import { type Workspace } from "./model";
import {
  appWorkspaceSchema,
  encodeBackup,
  initialAppWorkspace,
  migrateLegacy,
  type AppWorkspace,
} from "./workspace";

export type RecoverySnapshot = {
  id: string;
  createdAt: string;
  reason: "migration-v1" | "before-import";
  data: unknown;
};
export class WorkbenchDB extends Dexie {
  workspace!: Table<{ id: string; data: Workspace }, string>;
  documents!: Table<{ id: string; data: AppWorkspace }, string>;
  recovery!: Table<RecoverySnapshot, string>;
  constructor(name = "dnd-workbench") {
    super(name);
    this.version(1).stores({ workspace: "id" });
    this.version(2)
      .stores({ workspace: "id", documents: "id", recovery: "id,createdAt" })
      .upgrade(async (tx) => {
        const legacy = await tx.table("workspace").get("local");
        if (legacy) {
          const migrated = migrateLegacy(legacy.data);
          await tx.table("recovery").put({
            id: "migration-v1",
            createdAt: new Date().toISOString(),
            reason: "migration-v1",
            data: legacy.data,
          });
          await tx.table("documents").put({ id: "local", data: migrated });
        }
      });
  }
}
export const db = new WorkbenchDB();
export async function initialize(database = db) {
  await database.transaction("rw", database.documents, async () => {
    if (!(await database.documents.get("local")))
      await database.documents.add({
        id: "local",
        data: initialAppWorkspace(),
      });
  });
}
export async function changeWorkspace(
  update: (s: AppWorkspace) => AppWorkspace,
  database = db,
) {
  await database.transaction("rw", database.documents, async () => {
    const current = await database.documents.get("local");
    if (!current) throw new Error("Хранилище ещё не готово");
    const validated = appWorkspaceSchema.parse(update(current.data));
    encodeBackup(validated); // Every committed state must remain exportable.
    await database.documents.put({ id: "local", data: validated });
  });
}
export async function replaceWorkspace(imported: AppWorkspace, database = db) {
  const validated = appWorkspaceSchema.parse(imported);
  encodeBackup(validated);
  await database.transaction(
    "rw",
    database.documents,
    database.recovery,
    async () => {
      const current = await database.documents.get("local");
      if (!current) throw new Error("Хранилище ещё не готово");
      // Bounded retention: original migration and one previous import. Never include in exported workspace.
      await database.recovery.put({
        id: "before-import",
        createdAt: new Date().toISOString(),
        reason: "before-import",
        data: current.data,
      });
      await database.documents.put({ id: "local", data: validated });
    },
  );
}
