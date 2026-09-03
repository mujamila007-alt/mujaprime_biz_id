import { Pool } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, database: 'not_configured', message: 'DATABASE_URL belum tersedia.' });
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query('SELECT NOW() AS now');
    return res.status(200).json({ ok: true, database: 'postgresql', now: result.rows[0]?.now || null });
  } catch (e) {
    return res.status(500).json({ ok: false, database: 'error', message: e.message || 'Database connection failed' });
  } finally {
    await pool.end().catch(() => {});
  }
}
