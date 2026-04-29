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
      ...(method === 'POST' || method === 'PUT' ? { 'Prefer': 'return=representation' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  try {
    // ── LIST ──
    if (req.method === 'GET' && (!action || action === 'list')) {
      const r = await sb('GET', 'reference_packs?order=is_default.desc,name');
      if (!r.ok) throw new Error(await r.text());
      return res.json(await r.json());
    }

    // ── GET ONE ──
    if (req.method === 'GET' && action === 'get') {
      const { id } = req.query;
      const r = await sb('GET', `reference_packs?id=eq.${id}`);
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      return res.json(rows[0] || null);
    }

    // ── CREATE ──
    if (req.method === 'POST' && action === 'create') {
      const b = req.body;
      if (!b.name) return res.status(400).json({ error: 'name required' });

      const row: Record<string, any> = {
        name: b.name,
        type: b.type || 'person',
        face_front: b.faceFront || null,
        face_3quarter: b.face3quarter || null,
        face_profile: b.faceProfile || null,
        face_additional: b.faceAdditional || [],
        fish_audio_voice_id: b.fishAudioVoiceId || null,
        voice_sample_url: b.voiceSampleUrl || null,
        style_images: b.styleImages || [],
        motion_videos: b.motionVideos || [],
        lock_prompt: b.lockPrompt || '',
        face_influence: b.faceInfluence ?? 0.90,
        voice_influence: b.voiceInfluence ?? 0.80,
        style_influence: b.styleInfluence ?? 0.50,
        age: b.age || null,
        gender: b.gender || null,
        ethnicity: b.ethnicity || null,
        hair: b.hair || null,
        skin_tone: b.skinTone || null,
        distinguishing: b.distinguishing || null,
      };

      const r = await sb('POST', 'reference_packs', row);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      return res.status(201).json(Array.isArray(data) ? data[0] : data);
    }

    // ── UPDATE ──
    if (req.method === 'PUT' && action === 'update') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });

      const b = req.body;
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      const fields = ['name','type','face_front','face_3quarter','face_profile','face_additional',
        'fish_audio_voice_id','voice_sample_url','style_images','motion_videos','lock_prompt',
        'face_influence','voice_influence','style_influence','age','gender','ethnicity','hair',
        'skin_tone','distinguishing'];

      // Map camelCase body to snake_case DB
      const camelToSnake: Record<string, string> = {
        faceFront: 'face_front', face3quarter: 'face_3quarter', faceProfile: 'face_profile',
        faceAdditional: 'face_additional', fishAudioVoiceId: 'fish_audio_voice_id',
        voiceSampleUrl: 'voice_sample_url', styleImages: 'style_images', motionVideos: 'motion_videos',
        lockPrompt: 'lock_prompt', faceInfluence: 'face_influence', voiceInfluence: 'voice_influence',
        styleInfluence: 'style_influence', skinTone: 'skin_tone',
      };

      for (const [camel, snake] of Object.entries(camelToSnake)) {
        if (b[camel] !== undefined) updates[snake] = b[camel];
      }
      for (const f of fields) {
        if (b[f] !== undefined) updates[f] = b[f];
      }

      const r = await sb('PATCH', `reference_packs?id=eq.${id}`, updates);
      if (!r.ok) throw new Error(await r.text());
      return res.json({ updated: id });
    }

    // ── DUPLICATE ──
    if (req.method === 'POST' && action === 'duplicate') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });

      // Fetch original
      const getR = await sb('GET', `reference_packs?id=eq.${id}`);
      const rows = await getR.json();
      if (!rows.length) return res.status(404).json({ error: 'not found' });

      const orig = rows[0];
      delete orig.id;
      delete orig.created_at;
      delete orig.updated_at;
      orig.name = `${orig.name} (Copy)`;
      orig.is_default = false;
      orig.times_used = 0;
      orig.last_used_at = null;

      const r = await sb('POST', 'reference_packs', orig);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      return res.status(201).json(Array.isArray(data) ? data[0] : data);
    }

    // ── DELETE ──
    if (req.method === 'DELETE' && action === 'delete') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });

      // Check if default
      const getR = await sb('GET', `reference_packs?id=eq.${id}&select=is_default`);
      const rows = await getR.json();
      if (rows[0]?.is_default) return res.status(400).json({ error: 'Cannot delete default character' });

      const r = await fetch(`${SUPABASE_URL}/rest/v1/reference_packs?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY },
      });
      if (!r.ok) throw new Error(await r.text());
      return res.json({ deleted: id });
    }

    // ── UPLOAD (file as base64) ──
    if (req.method === 'POST' && action === 'upload') {
      const { data, filename, contentType } = req.body;
      if (!data) return res.status(400).json({ error: 'data required' });

      const base64 = data.includes(',') ? data.split(',')[1] : data;
      const buffer = Buffer.from(base64, 'base64');
      let mime = contentType || 'image/jpeg';
      if (data.startsWith('data:')) {
        const match = data.match(/^data:([^;]+);/);
        if (match) mime = match[1];
      }

      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const name = filename || `ref-${Date.now()}.${ext}`;
      const storagePath = `face-references/${name}`;

      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/ugc-assets/${storagePath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': mime, 'x-upsert': 'true' },
        body: new Uint8Array(buffer),
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

      return res.json({ url: `${SUPABASE_URL}/storage/v1/object/public/ugc-assets/${storagePath}` });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
