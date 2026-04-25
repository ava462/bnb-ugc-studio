import type { VercelRequest, VercelResponse } from '@vercel/node';

const ARCADS_BASIC_AUTH = process.env.ARCADS_BASIC_AUTH!;
const ARCADS_PRODUCT_ID = process.env.ARCADS_PRODUCT_ID!;
const JORDAN_SITUATION_ID = process.env.JORDAN_SITUATION_ID!;
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY!;
const FISH_AUDIO_VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || '';
const FAL_KEY = process.env.FAL_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// ── Helpers ──

async function arcadsUpload(buffer: Buffer, fileType: string): Promise<string> {
  const presign = await fetch('https://external-api.arcads.ai/v1/file-upload/get-presigned-url', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileType }),
  });
  const { presignedUrl, filePath } = await presign.json() as { presignedUrl: string; filePath: string };
  await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': fileType }, body: new Uint8Array(buffer) });
  return filePath;
}

async function supabaseUpload(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
  await fetch(`${SUPABASE_URL}/storage/v1/object/ugc-assets/temp/${fileName}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': contentType },
    body: new Uint8Array(buffer),
  });
  return `${SUPABASE_URL}/storage/v1/object/public/ugc-assets/temp/${fileName}`;
}

async function generateFishAudio(script: string): Promise<Buffer> {
  const cleanScript = script.replace(/\[.*?\]\s*/g, '');
  const body: Record<string, unknown> = { text: cleanScript, format: 'mp3', temperature: 0.7, sample_rate: 44100, mp3_bitrate: 128 };
  if (FISH_AUDIO_VOICE_ID) body.reference_id = FISH_AUDIO_VOICE_ID;

  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`, 'Content-Type': 'application/json', 'model': 's2-pro' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fish Audio error: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Path Generators ──

async function generateSeedance(params: any): Promise<{ assetId: string; pollType: 'arcads_asset' }> {
  // Compose the 9-layer prompt from parameters
  const p = params;
  const script = p.script?.dialogue || '';
  const char = p.character || {};
  const setting = p.setting || {};
  const camera = p.camera || {};
  const lighting = p.lighting || {};
  const realism = p.realism || {};
  const api = p.apiParams || {};

  const prompt = [
    `${api.duration || 15} seconds UGC style honest review video, filmed on ${camera.device || 'smartphone'}, ${lighting.source || 'natural window lighting'}, ${camera.angle || 'casual handheld selfie angle'}.`,
    `A ${char.age || 'person in their mid-twenties'} ${char.gender || ''} with ${char.hair || 'natural hair'}, ${char.skinTone || 'natural skin'} with ${realism.skinCues || 'visible pores, slight unevenness'}, wearing ${char.wardrobe || 'casual clothes'}.`,
    `${setting.location || 'In a casual setting'}${setting.props ? ', ' + setting.props : ''}. ${setting.timeOfDay ? setting.timeOfDay + ' light.' : ''}`,
    `Speaking directly to camera with genuine energy. ${script}`,
    `${(realism.motionCues || []).join(', ')}. ${realism.cameraFlaws || 'Slight motion blur, phone mic audio quality.'}`,
    `Raw, relatable, real — not a polished ad. No subtitles, no captions, no text overlays.`,
  ].join(' ');

  // Upload influencer reference if specified
  let referenceImages: string[] | undefined;
  // For now, skip reference image upload from serverless — would need pre-uploaded URL

  const genRes = await fetch('https://external-api.arcads.ai/v2/videos/generate', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: api.model || 'seedance-2.0',
      prompt,
      aspectRatio: api.aspectRatio || '9:16',
      duration: api.duration || 15,
      resolution: api.resolution || '720p',
      audioEnabled: api.audioEnabled !== false,
      productId: ARCADS_PRODUCT_ID,
      ...(referenceImages ? { referenceImages } : {}),
    }),
  });

  if (!genRes.ok) throw new Error(`Arcads error: ${await genRes.text()}`);
  const data = await genRes.json();
  return { assetId: data.id, pollType: 'arcads_asset' };
}

async function generateArcadsOmniHuman(params: any): Promise<{ assetId: string; pollType: 'arcads_talking' }> {
  const script = params.script?.dialogueTagged || params.script?.dialogue || '';

  // Generate voice with Fish Audio
  const audioBuffer = await generateFishAudio(script);

  // Upload audio to Arcads
  const audioPath = await arcadsUpload(audioBuffer, 'audio/mpeg');

  // Generate via talking-actors
  const genRes = await fetch('https://external-api.arcads.ai/v2/talking-actors/generate', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'omnihuman',
      productId: ARCADS_PRODUCT_ID,
      actors: [{ situationId: JORDAN_SITUATION_ID }],
      referenceAudios: [audioPath],
    }),
  });

  if (!genRes.ok) throw new Error(`Arcads error: ${await genRes.text()}`);
  const data = await genRes.json();
  const assetId = Array.isArray(data) ? data[0]?.id : data.id;
  return { assetId, pollType: 'arcads_talking' };
}

async function generateFalOmniHuman(params: any): Promise<{ requestId: string; pollType: 'fal'; statusUrl: string; responseUrl: string }> {
  const script = params.script?.dialogueTagged || params.script?.dialogue || '';

  // Generate voice with Fish Audio
  const audioBuffer = await generateFishAudio(script);

  // Upload audio to Supabase CDN (fal.ai needs public URLs)
  const audioUrl = await supabaseUpload(audioBuffer, `fal-audio-${Date.now()}.mp3`, 'audio/mpeg');

  // Face image URL — expect it passed in params
  const faceUrl = params.faceImageUrl;
  if (!faceUrl) throw new Error('Face image URL required for fal.ai path');

  // Submit to fal.ai
  const submitRes = await fetch('https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: faceUrl, audio_url: audioUrl }),
  });

  if (!submitRes.ok) throw new Error(`fal.ai error: ${await submitRes.text()}`);
  const data = await submitRes.json();
  return {
    requestId: data.request_id,
    pollType: 'fal',
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  };
}

// ── Main Handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { path, parameters } = req.body;
  if (!path || !parameters) return res.status(400).json({ error: 'path and parameters required' });

  try {
    let result: any;

    switch (path) {
      case 'seedance':
        result = await generateSeedance(parameters);
        break;
      case 'arcads':
        result = await generateArcadsOmniHuman(parameters);
        break;
      case 'fal':
        result = await generateFalOmniHuman(parameters);
        break;
      default:
        return res.status(400).json({ error: `Unknown path: ${path}` });
    }

    return res.status(200).json({ ...result, status: 'generating' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
