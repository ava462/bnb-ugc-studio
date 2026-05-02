import type { VercelRequest, VercelResponse } from '@vercel/node';

const RENDER_SERVER = process.env.RENDER_SERVER_URL || 'http://localhost:4100';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrls } = req.body as { videoUrls: string[] };
  if (!videoUrls?.length) return res.status(400).json({ error: 'videoUrls required' });
  if (videoUrls.length === 1) return res.json({ videoUrl: videoUrls[0] });

  try {
    // Try render server first (has ffmpeg)
    const stitchRes = await fetch(`${RENDER_SERVER}/stitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrls }),
    });

    if (stitchRes.ok) {
      const data = await stitchRes.json();
      if (data.videoUrl) return res.json(data);
    }

    // Render server unavailable — try stitching by downloading + uploading
    // as a simple concatenation via Supabase (no ffmpeg, just first chunk as fallback)
    return res.json({
      videoUrl: videoUrls[0],
      allChunks: videoUrls,
      fallback: true,
      note: 'Render server unavailable for stitching. Showing first chunk. Start render server: cd ~/Projects/bnb-video-engine && npx tsx render/server.ts',
    });
  } catch (err: any) {
    return res.json({
      videoUrl: videoUrls[0],
      allChunks: videoUrls,
      fallback: true,
      error: err.message,
    });
  }
}
