import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data, filename, contentType } = req.body;

    if (!data) return res.status(400).json({ error: 'data (base64) required' });

    // Accept base64 data URI or raw base64
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    const buffer = Buffer.from(base64, 'base64');

    // Determine content type
    let mime = contentType || 'image/jpeg';
    if (data.startsWith('data:')) {
      const match = data.match(/^data:([^;]+);/);
      if (match) mime = match[1];
    }

    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const name = filename || `face-upload-${Date.now()}.${ext}`;
    const storagePath = `temp/${name}`;

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/ugc-assets/${storagePath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(500).json({ error: `Storage upload failed: ${err}` });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/ugc-assets/${storagePath}`;

    return res.status(200).json({ url: publicUrl, path: storagePath });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
