import type { VercelRequest, VercelResponse } from '@vercel/node';

const ARCADS_BASIC_AUTH = process.env.ARCADS_BASIC_AUTH!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { assetId } = req.query;
  if (!assetId) return res.status(400).json({ error: 'assetId required' });

  try {
    const r = await fetch(`https://external-api.arcads.ai/v1/assets/${assetId}`, {
      headers: { 'Authorization': ARCADS_BASIC_AUTH },
    });

    if (!r.ok) return res.status(500).json({ status: 'error', error: `HTTP ${r.status}` });

    const data = await r.json();

    // Log full response for debugging
    console.log('[status] Arcads status:', data.status, 'hasUrl:', !!(data.url || data.videoUrl || data.video_url));

    const videoUrl = data.videoUrl || data.url || data.video_url || null;

    // Mark complete if status says done OR if a video URL is already present
    if (['generated', 'completed', 'complete', 'done', 'success'].includes(data.status) || videoUrl) {
      console.log('[status] Video complete, videoUrl:', videoUrl);
      return res.status(200).json({
        status: 'complete',
        videoUrl,
        progress: 100,
        statusText: 'Complete!',
      });
    }

    if (data.status === 'failed') {
      return res.status(200).json({
        status: 'failed',
        error: data.error || data.message || data.errorMessage || JSON.stringify(data) || 'Generation failed on Arcads side',
        progress: 0,
      });
    }

    return res.status(200).json({
      status: 'generating',
      progress: 50,
      statusText: 'Generating with Seedance 2.0...',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
