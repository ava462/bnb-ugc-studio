import type { VercelRequest, VercelResponse } from '@vercel/node';

const RENDER_SERVER = process.env.RENDER_SERVER_URL || 'http://localhost:4100';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrls, chunks } = req.body as { videoUrls: string[]; chunks?: any[] };
  if (!videoUrls?.length) return res.status(400).json({ error: 'videoUrls required' });
  if (videoUrls.length === 1) return res.json({ videoUrl: videoUrls[0] });

  // Use edit-aware endpoint if chunks have edit cues
  const hasEdits = chunks?.some((c: any) => c?.editCues?.length > 0);
  const endpoint = hasEdits ? '/stitch-with-edits' : '/stitch';

  try {
    const stitchRes = await fetch(`${RENDER_SERVER}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ videoUrls, chunks }),
    });

    if (stitchRes.ok) {
      const contentType = stitchRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Cloudflare tunnel returned HTML challenge instead of JSON
        const body = await stitchRes.text();
        console.error(`[stitch] Got non-JSON response (${contentType}): ${body.slice(0, 200)}`);
        return res.json({
          videoUrl: videoUrls[0],
          allChunks: videoUrls,
          fallback: true,
          note: `Render server returned HTML instead of JSON (Cloudflare tunnel challenge). Content-Type: ${contentType}`,
        });
      }
      const data = await stitchRes.json();
      if (data.videoUrl) return res.json(data);
    } else {
      const body = await stitchRes.text().catch(() => '');
      console.error(`[stitch] Render server error ${stitchRes.status}: ${body.slice(0, 200)}`);
    }

    // Render server unavailable — fallback to first chunk
    return res.json({
      videoUrl: videoUrls[0],
      allChunks: videoUrls,
      fallback: true,
      note: 'Render server unavailable for stitching. Showing first chunk. Start render server: cd ~/Projects/bnb-video-engine && npx tsx render/server.ts',
    });
  } catch (err: any) {
    console.error(`[stitch] Fetch error: ${err.message}`);
    return res.json({
      videoUrl: videoUrls[0],
      allChunks: videoUrls,
      fallback: true,
      error: err.message,
    });
  }
}
