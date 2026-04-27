import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const FISH_AUDIO_VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || '14d07e89acda4214bd319865a7e1a888';

const headers = (key: string) => ({
  'Authorization': `Bearer ${key}`,
  'apikey': key,
  'Content-Type': 'application/json',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;
  const action = req.query.action as string;

  // GET /api/references?action=list — list all character packs
  if (method === 'GET' && (!action || action === 'list')) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/creative_assets?asset_type=eq.face_reference&is_approved=eq.true&order=name&select=id,name,description,external_url,storage_path,speaker,topic_tags`,
        { headers: headers(SUPABASE_SERVICE_KEY) }
      );
      const assets = await r.json();

      // Group by speaker into packs
      const packs: Record<string, any> = {};
      for (const a of assets) {
        const speaker = a.speaker || 'unknown';
        if (!packs[speaker]) {
          packs[speaker] = {
            id: speaker,
            name: speaker === 'jordan' ? 'Jordan Pham' : speaker.charAt(0).toUpperCase() + speaker.slice(1),
            speaker,
            faces: [],
            voiceId: speaker === 'jordan' ? FISH_AUDIO_VOICE_ID : null,
          };
        }
        packs[speaker].faces.push({
          id: a.id,
          name: a.name,
          url: a.external_url || (a.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/ugc-assets/${a.storage_path}` : null),
          description: a.description,
        });
      }

      return res.status(200).json({ packs: Object.values(packs) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/references?action=create — create a new character pack
  if (method === 'POST' && action === 'create') {
    const { name, speaker, voiceId, description } = req.body;
    if (!name || !speaker) return res.status(400).json({ error: 'name and speaker required' });

    try {
      // Create a placeholder face_reference asset
      const r = await fetch(`${SUPABASE_URL}/rest/v1/creative_assets`, {
        method: 'POST',
        headers: { ...headers(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          name: `${name} — Character Pack`,
          asset_type: 'face_reference',
          storage_type: 'supabase_storage',
          speaker: speaker.toLowerCase(),
          description: description || `Character pack for ${name}`,
          is_approved: true,
          topic_tags: ['face_reference', 'character_pack', speaker.toLowerCase()],
        }),
      });
      const data = await r.json();
      return res.status(201).json({ pack: { id: speaker.toLowerCase(), name, speaker: speaker.toLowerCase(), voiceId: voiceId || null, faces: [], asset: data } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/references?action=upload — upload a face image to a pack
  if (method === 'POST' && action === 'upload') {
    const { data, filename, speaker, contentType } = req.body;
    if (!data || !speaker) return res.status(400).json({ error: 'data and speaker required' });

    try {
      const base64 = data.includes(',') ? data.split(',')[1] : data;
      const buffer = Buffer.from(base64, 'base64');

      let mime = contentType || 'image/jpeg';
      if (data.startsWith('data:')) {
        const match = data.match(/^data:([^;]+);/);
        if (match) mime = match[1];
      }

      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const name = filename || `${speaker}-${Date.now()}.${ext}`;
      const storagePath = `face-references/${speaker.toLowerCase()}/${name}`;

      // Upload to storage
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/ugc-assets/${storagePath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': mime, 'x-upsert': 'true' },
        body: new Uint8Array(buffer),
      });

      if (!uploadRes.ok) throw new Error(`Storage upload failed: ${uploadRes.status}`);

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/ugc-assets/${storagePath}`;

      // Create asset record
      await fetch(`${SUPABASE_URL}/rest/v1/creative_assets`, {
        method: 'POST',
        headers: headers(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({
          name: `${speaker} — ${name}`,
          asset_type: 'face_reference',
          storage_type: 'supabase_storage',
          storage_path: storagePath,
          external_url: publicUrl,
          file_type: ext,
          speaker: speaker.toLowerCase(),
          description: `Face reference for ${speaker}`,
          is_approved: true,
          topic_tags: ['face_reference', speaker.toLowerCase()],
        }),
      });

      return res.status(200).json({ url: publicUrl, path: storagePath });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE /api/references?action=delete — delete a face from a pack
  if (method === 'DELETE' && action === 'delete') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/creative_assets?id=eq.${id}`, {
        method: 'DELETE',
        headers: headers(SUPABASE_SERVICE_KEY),
      });
      return res.status(200).json({ deleted: id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
