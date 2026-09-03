import fs from 'node:fs';
import admin from 'firebase-admin';
import { Pool } from '@neondatabase/serverless';

const COLLECTIONS = [
  'access_tokens','ai_chat_logs','app_installs','app_stats','collection_items','deleted_accounts',
  'email_logs','leaderboard','manual_members','orders','poin_products','poin_redeems','products',
  'registered_emails','registrations','sections','settings','user_poins'
];

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diisi.');

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (!file) throw new Error('Isi FIREBASE_SERVICE_ACCOUNT_FILE atau FIREBASE_SERVICE_ACCOUNT_JSON.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function convert(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(convert);
  if (value && typeof value.toDate === 'function') {
    return { __mujaType: 'timestamp', iso: value.toDate().toISOString() };
  }
  if (value instanceof Date) return { __mujaType: 'timestamp', iso: value.toISOString() };
  if (typeof value === 'object') {
    if (value.latitude != null && value.longitude != null && value.constructor?.name === 'GeoPoint') {
      return { latitude: value.latitude, longitude: value.longitude };
    }
    if (value.path && value.constructor?.name === 'DocumentReference') return { __mujaType: 'reference', path: value.path };
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = convert(v);
    return out;
  }
  return value;
}

const serviceAccount = loadServiceAccount();
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const firestore = admin.firestore();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
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
  await client.query('CREATE INDEX IF NOT EXISTS muja_documents_collection_idx ON muja_documents (collection_name)');
  await client.query('CREATE INDEX IF NOT EXISTS muja_documents_data_gin_idx ON muja_documents USING GIN (data)');

  let total = 0;
  for (const collectionName of COLLECTIONS) {
    const snap = await firestore.collection(collectionName).get();
    let count = 0;
    for (const doc of snap.docs) {
      const data = convert(doc.data());
      await client.query(`
        INSERT INTO muja_documents (collection_name, document_id, data, version, created_at, updated_at)
        VALUES ($1,$2,$3::jsonb,1,NOW(),NOW())
        ON CONFLICT (collection_name, document_id)
        DO UPDATE SET data=EXCLUDED.data, version=muja_documents.version+1, updated_at=NOW()
      `, [collectionName, doc.id, JSON.stringify(data)]);
      count++;
      total++;
    }
    console.log(`${collectionName}: ${count} dokumen`);
  }
  console.log(`Selesai. Total ${total} dokumen dipindahkan ke PostgreSQL.`);
} finally {
  client.release();
  await pool.end();
  await admin.app().delete();
}
