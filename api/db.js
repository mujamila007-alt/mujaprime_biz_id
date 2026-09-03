import { Pool } from '@neondatabase/serverless';
import { readAdminSession } from './_auth.js';

const COLLECTIONS = new Set([
  'access_tokens','ai_chat_logs','app_installs','app_stats','collection_items','deleted_accounts',
  'email_logs','leaderboard','manual_members','orders','poin_products','poin_redeems','products',
  'registered_emails','registrations','sections','settings','user_poins'
]);

const PUBLIC_READ_ALL = new Set(['products','collection_items','settings','sections','leaderboard','poin_products']);
const PUBLIC_ADD = new Set(['registrations','registered_emails','orders','access_tokens','user_poins','poin_redeems','ai_chat_logs']);
const PUBLIC_UPDATE = new Set(['registrations','registered_emails','access_tokens','poin_products','ai_chat_logs']);
const PUBLIC_SET = new Set(['poin_redeems','ai_chat_logs']);

function jsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body;
}

function validateCollection(name) {
  if (!COLLECTIONS.has(name)) {
    const e = new Error('Collection tidak diizinkan: ' + name);
    e.status = 400;
    throw e;
  }
}

function validateId(id) {
  if (!id || !/^[A-Za-z0-9_.:@+-]{1,220}$/.test(String(id))) {
    const e = new Error('Document ID tidak valid.');
    e.status = 400;
    throw e;
  }
}

function timestampNow() {
  return { __mujaType: 'timestamp', iso: new Date().toISOString() };
}

function deepClone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

function sameJson(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
}

function resolveValue(incoming, previous) {
  if (Array.isArray(incoming)) return incoming.map(v => resolveValue(v, undefined));
  if (incoming && typeof incoming === 'object') {
    if (incoming.__mujaFieldValue === 'serverTimestamp') return timestampNow();
    if (incoming.__mujaFieldValue === 'increment') return (Number(previous) || 0) + (Number(incoming.amount) || 0);
    if (incoming.__mujaFieldValue === 'arrayUnion') {
      const base = Array.isArray(previous) ? deepClone(previous) : [];
      const values = Array.isArray(incoming.values) ? incoming.values : [];
      for (const value of values) {
        const resolved = resolveValue(value, undefined);
        if (!base.some(item => sameJson(item, resolved))) base.push(resolved);
      }
      return base;
    }
    const out = {};
    for (const [k, v] of Object.entries(incoming)) out[k] = resolveValue(v, previous && previous[k]);
    return out;
  }
  return incoming;
}

function applyPatch(existing, patch) {
  const next = { ...(existing || {}) };
  for (const [key, value] of Object.entries(patch || {})) next[key] = resolveValue(value, existing && existing[key]);
  return next;
}

function applySet(existing, incoming, merge) {
  const resolved = resolveValue(incoming || {}, existing || {});
  return merge ? { ...(existing || {}), ...resolved } : resolved;
}

function getField(data, field) {
  const parts = String(field || '').split('.');
  let v = data;
  for (const p of parts) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[p];
  }
  return v;
}

function comparable(v) {
  if (v && typeof v === 'object' && v.__mujaType === 'timestamp' && v.iso) return new Date(v.iso).getTime();
  if (typeof v === 'string') {
    const n = Number(v);
    if (v.trim() !== '' && Number.isFinite(n)) return n;
  }
  return v;
}

function matchesFilter(data, f) {
  if (!f || f.op !== '==') return false;
  return sameJson(comparable(getField(data, f.field)), comparable(f.value));
}

function sortValue(v) {
  v = comparable(v);
  if (v == null) return '';
  return v;
}

function hasFilter(filters, fields) {
  return (filters || []).some(f => fields.includes(f.field) && f.op === '==' && String(f.value || '').length > 0);
}

function publicReadAllowed(action, collection, payload) {
  if (PUBLIC_READ_ALL.has(collection)) return true;
  if (action === 'getDoc' && collection === 'ai_chat_logs') return true;
  if (action !== 'query') return false;
  const filters = payload.filters || [];
  if (collection === 'registrations') return hasFilter(filters, ['email','whatsapp']) && (!payload.limit || payload.limit <= 10);
  if (collection === 'registered_emails') return hasFilter(filters, ['email']) && (!payload.limit || payload.limit <= 20);
  if (collection === 'access_tokens') return hasFilter(filters, ['token']) && (!payload.limit || payload.limit <= 5);
  if (collection === 'deleted_accounts') return hasFilter(filters, ['email','whatsapp']) && (!payload.limit || payload.limit <= 10);
  return false;
}

function publicWriteAllowed(op, existing) {
  if (op.type === 'add') return PUBLIC_ADD.has(op.collection);
  if (op.type === 'set') {
    if (PUBLIC_SET.has(op.collection)) return true;
    if (op.collection === 'settings' && op.id === 'canva_config' && !existing) return true;
    return false;
  }
  if (op.type === 'update') {
    if (!PUBLIC_UPDATE.has(op.collection)) return false;
    if (op.collection === 'access_tokens') {
      return !!op.expectedVersion && existing && existing.status === 'unused' && op.data && op.data.status === 'used';
    }
    if (op.collection === 'poin_products') {
      const keys = Object.keys(op.data || {});
      const allowed = keys.every(k => ['stock','updatedAt'].includes(k));
      const newStock = Number(op.data && op.data.stock);
      return allowed && Number.isFinite(newStock) && newStock >= 0 && existing && newStock <= Number(existing.stock || 0);
    }
    return true;
  }
  return false;
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS muja_documents (
      collection_name TEXT NOT NULL,
      document_id TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      version BIGINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection_name, document_id)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS muja_documents_collection_idx ON muja_documents (collection_name);`);
  await client.query(`CREATE INDEX IF NOT EXISTS muja_documents_data_gin_idx ON muja_documents USING GIN (data);`);
}

async function readRow(client, collection, id, lock = false) {
  const q = `SELECT document_id AS id, data, version FROM muja_documents WHERE collection_name=$1 AND document_id=$2${lock ? ' FOR UPDATE' : ''}`;
  const { rows } = await client.query(q, [collection, id]);
  return rows[0] || null;
}

async function writeOp(client, op, isAdmin, lock = false) {
  validateCollection(op.collection);
  validateId(op.id);
  const current = await readRow(client, op.collection, op.id, lock);
  const existing = current ? current.data : null;

  if (!isAdmin && !publicWriteAllowed(op, existing)) {
    const e = new Error('Operasi database ini memerlukan login admin.');
    e.status = 403;
    throw e;
  }

  if (op.expectedVersion != null) {
    if (!current || Number(current.version) !== Number(op.expectedVersion)) {
      const e = new Error('DATA_CHANGED');
      e.status = 409;
      e.code = 'DATA_CHANGED';
      throw e;
    }
  }

  if (op.type === 'delete') {
    if (!isAdmin) {
      const e = new Error('Hapus data memerlukan login admin.');
      e.status = 403;
      throw e;
    }
    await client.query('DELETE FROM muja_documents WHERE collection_name=$1 AND document_id=$2', [op.collection, op.id]);
    return { id: op.id, deleted: true };
  }

  let next;
  if (op.type === 'update') {
    if (!current) {
      const e = new Error('Dokumen tidak ditemukan.');
      e.status = 404;
      throw e;
    }
    next = applyPatch(existing, op.data || {});
  } else if (op.type === 'set') {
    next = applySet(existing, op.data || {}, !!op.merge);
  } else if (op.type === 'add') {
    if (current) {
      const e = new Error('Document ID sudah ada.');
      e.status = 409;
      throw e;
    }
    next = resolveValue(op.data || {}, {});
  } else {
    const e = new Error('Operasi tulis tidak dikenal.');
    e.status = 400;
    throw e;
  }

  const { rows } = await client.query(`
    INSERT INTO muja_documents (collection_name, document_id, data, version, created_at, updated_at)
    VALUES ($1,$2,$3::jsonb,1,NOW(),NOW())
    ON CONFLICT (collection_name, document_id)
    DO UPDATE SET data=EXCLUDED.data, version=muja_documents.version+1, updated_at=NOW()
    RETURNING document_id AS id, version
  `, [op.collection, op.id, JSON.stringify(next)]);
  return rows[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL belum dikonfigurasi di Vercel.' });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const payload = jsonBody(req);
    const action = String(payload.action || '');
    const session = readAdminSession(req);
    const isAdmin = !!session;

    if (action === 'getDoc') {
      validateCollection(payload.collection); validateId(payload.id);
      if (!isAdmin && !publicReadAllowed(action, payload.collection, payload)) return res.status(403).json({ error: 'Data ini memerlukan login admin.' });
      const row = await readRow(client, payload.collection, payload.id, false);
      return res.status(200).json({ doc: row ? { id: row.id, data: row.data, version: Number(row.version), exists: true } : { id: payload.id, exists: false } });
    }

    if (action === 'query') {
      validateCollection(payload.collection);
      if (!isAdmin && !publicReadAllowed(action, payload.collection, payload)) return res.status(403).json({ error: 'Query ini memerlukan login admin.' });
      const { rows } = await client.query('SELECT document_id AS id, data, version FROM muja_documents WHERE collection_name=$1', [payload.collection]);
      let docs = rows.map(r => ({ id: r.id, data: r.data, version: Number(r.version), exists: true }));
      const filters = Array.isArray(payload.filters) ? payload.filters : [];
      docs = docs.filter(d => filters.every(f => matchesFilter(d.data, f)));
      if (payload.orderBy && payload.orderBy.field) {
        const dir = payload.orderBy.direction === 'desc' ? -1 : 1;
        const field = payload.orderBy.field;
        docs.sort((a,b) => {
          const av = sortValue(getField(a.data, field));
          const bv = sortValue(getField(b.data, field));
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
      }
      const max = isAdmin ? 5000 : 500;
      const limit = Math.min(Math.max(Number(payload.limit) || docs.length || 1, 1), max);
      docs = docs.slice(0, limit);
      return res.status(200).json({ docs });
    }

    if (['add','set','update','delete'].includes(action)) {
      const result = await writeOp(client, { type: action, collection: payload.collection, id: payload.id, data: payload.data, merge: payload.merge, expectedVersion: payload.expectedVersion }, isAdmin, false);
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === 'batch') {
      const ops = Array.isArray(payload.ops) ? payload.ops : [];
      if (!ops.length || ops.length > 500) return res.status(400).json({ error: 'Batch kosong atau terlalu besar.' });
      await client.query('BEGIN');
      try {
        const results = [];
        for (const op of ops) results.push(await writeOp(client, op, isAdmin, true));
        await client.query('COMMIT');
        return res.status(200).json({ ok: true, results });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    return res.status(400).json({ error: 'Action database tidak dikenal.' });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || 'Database error.', code: e.code || undefined });
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}
