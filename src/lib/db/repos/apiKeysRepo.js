import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function normalizeAllowedConnectionIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean))];
  return ids.length > 0 ? ids : null;
}

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    allowedConnectionIds: row.allowedConnectionIds ? JSON.parse(row.allowedConnectionIds) : null,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
  };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function getApiKeyByKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, allowedConnectionIds = null) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const normalizedAllowedConnectionIds = normalizeAllowedConnectionIds(allowedConnectionIds);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    allowedConnectionIds: normalizedAllowedConnectionIds,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, allowedConnectionIds, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, apiKey.allowedConnectionIds ? JSON.stringify(apiKey.allowedConnectionIds) : null, 1, apiKey.createdAt]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    merged.allowedConnectionIds = normalizeAllowedConnectionIds(merged.allowedConnectionIds);
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, allowedConnectionIds = ?, isActive = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.allowedConnectionIds ? JSON.stringify(merged.allowedConnectionIds) : null, merged.isActive ? 1 : 0, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}
