import type { VercelRequest, VercelResponse } from '@vercel/node';

const ARCADS_BASIC_AUTH = process.env.ARCADS_BASIC_AUTH!;
const FAL_KEY = process.env.FAL_KEY!;

async function pollArcadsAsset(assetId: string) {
  const res = await fetch(`https://external-api.arcads.ai/v1/assets/${assetId}`, {
    headers: { 'Authorization': ARCADS_BASIC_AUTH },
  });
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` };
  const data = await res.json();

  if (data.status === 'generated') {
    return { status: 'complete', videoUrl: data.url || data.videoUrl, progress: 100 };
  }
  if (data.status === 'failed') {
    return { status: 'failed', error: data.error || 'Generation failed', progress: 0 };
  }
  return { status: 'generating', progress: 50 };
}

async function pollArcadsTalking(assetId: string) {
  const res = await fetch(`https://external-api.arcads.ai/v2/talking-actors/${assetId}`, {
    headers: { 'Authorization': ARCADS_BASIC_AUTH },
  });
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` };
  const data = await res.json();

  if (data.status === 'completed') {
    // Get the watch URL
    const watchRes = await fetch(`https://external-api.arcads.ai/v2/talking-actors/${assetId}/watch`, {
      headers: { 'Authorization': ARCADS_BASIC_AUTH },
      redirect: 'manual',
    });
    const videoUrl = watchRes.headers.get('location') || `https://external-api.arcads.ai/v2/talking-actors/${assetId}/watch`;
    return { status: 'complete', videoUrl, progress: 100 };
  }
  if (data.status === 'failed') {
    return { status: 'failed', error: data.error || 'Generation failed', progress: 0 };
  }
  return { status: 'generating', progress: 50, statusText: 'Processing with OmniHuman...' };
}

async function pollFal(statusUrl: string, responseUrl: string) {
  const res = await fetch(statusUrl, {
    headers: { 'Authorization': `Key ${FAL_KEY}` },
  });
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` };
  const data = await res.json();
  const status = data.status?.toUpperCase();

  if (status === 'COMPLETED') {
    const resultRes = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${FAL_KEY}` },
    });
    const resultData = await resultRes.json();
    const videoUrl = resultData.video?.url;
    return { status: 'complete', videoUrl, progress: 100 };
  }
  if (status === 'FAILED') {
    return { status: 'failed', error: data?.detail || 'fal.ai generation failed', progress: 0 };
  }
  return { status: 'generating', progress: 50, statusText: `fal.ai: ${data.status}` };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { pollType, assetId, requestId, statusUrl, responseUrl } = req.query;

  try {
    let result: any;

    switch (pollType) {
      case 'arcads_asset':
        result = await pollArcadsAsset(assetId as string);
        break;
      case 'arcads_talking':
        result = await pollArcadsTalking(assetId as string);
        break;
      case 'fal':
        result = await pollFal(statusUrl as string, responseUrl as string);
        break;
      default:
        return res.status(400).json({ error: `Unknown pollType: ${pollType}` });
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
