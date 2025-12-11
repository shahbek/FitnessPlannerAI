import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface FitnessPlannerDB extends DBSchema {
    keyval: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'fitness-planner-db';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FitnessPlannerDB>> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<FitnessPlannerDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return dbPromise;
}

export const dbRequest = {
    async get(key: string) {
        const db = await getDB();
        return db.get(STORE_NAME, key);
    },
    async set(key: string, val: any) {
        const db = await getDB();
        return db.put(STORE_NAME, val, key);
    },
    async del(key: string) {
        const db = await getDB();
        return db.delete(STORE_NAME, key);
    },
    async clear() {
        const db = await getDB();
        return db.clear(STORE_NAME);
    },
};
