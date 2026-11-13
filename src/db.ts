import Dexie, { type Table } from "dexie";
import { initialWorkspace, workspaceSchema, type Workspace } from "./model";
class WorkbenchDB extends Dexie {
  workspace!: Table<{ id: string; data: Workspace }, string>;
  constructor() {
    super("dnd-workbench");
    this.version(1).stores({ workspace: "id" });
  }
}
export const db = new WorkbenchDB();
export async function initialize() {
  await db.transaction("rw", db.workspace, async () => {
    if (!(await db.workspace.get("local")))
      await db.workspace.add({
        id: "local",
        data: structuredClone(initialWorkspace),
      });
  });
}
export async function changeWorkspace(
  update: (current: Workspace) => Workspace,
) {
  await db.transaction("rw", db.workspace, async () => {
    const current = await db.workspace.get("local");
    if (!current) throw new Error("Хранилище ещё не готово");
    await db.workspace.put({
      id: "local",
      data: workspaceSchema.parse(update(current.data)),
    });
  });
}
