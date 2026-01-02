import { openDB } from "idb";

const DB_NAME = "xinyi-mahjong-db";
const DB_VERSION = 1;
const STORE = "records";

async function getDB(){
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db){
      if(!db.objectStoreNames.contains(STORE)){
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("date", "date");
      }
    }
  });
}

export async function listAll(){
  const db = await getDB();
  return db.getAll(STORE);
}

export async function upsertRecord(record){
  const db = await getDB();
  await db.put(STORE, record);
}

export async function deleteRecord(id){
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function exportBackupJSON(){
  const records = await listAll();
  return JSON.stringify({
    app: "信義分隊雀神戰",
    exportedAt: new Date().toISOString(),
    records
  }, null, 2);
}

export async function importBackupJSON(text){
  const data = JSON.parse(text);
  if(!Array.isArray(data.records)) throw new Error("備份格式錯誤");
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  await tx.store.clear();
  for(const r of data.records){
    await tx.store.put(r);
  }
  await tx.done;
}
