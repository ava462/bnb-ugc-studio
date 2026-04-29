import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const sb = (method: string, path: string, body?: any) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { 'Prefer': 'return=representation' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // GET — list all voice models
    if (req.method === 'GET') {
      const r = await sb('GET', 'voice_models?order=is_default.desc,name');
      if (!r.ok) throw new Error(await r.text());
      return res.json(await r.json());
    }

    // POST — create new voice model
    if (req.method === 'POST') {
      const { name, fishAudioId, description } = req.body;
      if (!name || !fishAudioId) return res.status(400).json({ error: 'name and fishAudioId required' });

      const r = await sb('POST', 'voice_models', {
        name, fish_audio_id: fishAudioId, description: description || null,
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      return res.status(201).json(Array.isArray(data) ? data[0] : data);
    }

    // DELETE — delete a voice model
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });

      // Check if default
      const check = await sb('GET', `voice_models?id=eq.${id}&select=is_default`);
      const rows = await check.json();
      if (rows[0]?.is_default) return res.status(400).json({ error: 'Cannot delete default voice' });

      await fetch(`${SUPABASE_URL}/rest/v1/voice_models?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY },
      });
      return res.json({ deleted: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
