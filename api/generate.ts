import type { VercelRequest, VercelResponse } from '@vercel/node';

const ARCADS_BASIC_AUTH = process.env.ARCADS_BASIC_AUTH!;
const ARCADS_PRODUCT_ID = process.env.ARCADS_PRODUCT_ID!;
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY!;
const FISH_AUDIO_VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || '14d07e89acda4214bd319865a7e1a888';
const JORDAN_FACE_URL = process.env.JORDAN_FACE_URL || 'https://zyiidveeixbbjpswruyn.supabase.co/storage/v1/object/public/ugc-assets/face-references/jordan-pham-hero.jpg';

// ── Helpers ──

async function arcadsUploadUrl(imageUrl: string): Promise<string> {
  // Download image from URL, then upload to Arcads via presigned URL
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

  const presign = await fetch('https://external-api.arcads.ai/v1/file-upload/get-presigned-url', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileType: contentType }),
  });
  if (!presign.ok) throw new Error(`Presign error: ${presign.status}`);
  const { presignedUrl, filePath } = await presign.json() as { presignedUrl: string; filePath: string };

  await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: new Uint8Array(buffer) });
  return filePath;
}

async function arcadsUploadBuffer(buffer: Buffer, fileType: string): Promise<string> {
  const presign = await fetch('https://external-api.arcads.ai/v1/file-upload/get-presigned-url', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileType }),
  });
  if (!presign.ok) throw new Error(`Presign error: ${presign.status}`);
  const { presignedUrl, filePath } = await presign.json() as { presignedUrl: string; filePath: string };

  await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': fileType }, body: new Uint8Array(buffer) });
  return filePath;
}

async function generateFishAudio(script: string, voiceId?: string): Promise<Buffer> {
  const cleanScript = script.replace(/\[.*?\]\s*/g, '');
  const vid = voiceId || FISH_AUDIO_VOICE_ID;
  const body: Record<string, unknown> = {
    text: cleanScript,
    format: 'mp3',
    temperature: 0.7,
    sample_rate: 44100,
    mp3_bitrate: 128,
  };
  if (vid) body.reference_id = vid;

  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`, 'Content-Type': 'application/json', 'model': 's2-pro' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fish Audio error: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function compose9LayerPrompt(params: any): string {
  const script = params.script?.dialogue || '';
  const char = params.character || {};
  const setting = params.setting || {};
  const camera = params.camera || {};
  const lighting = params.lighting || {};
  const realism = params.realism || {};
  const api = params.apiParams || {};

  return [
    // Layer 1: Format header
    `${api.duration || 15} seconds UGC style honest review video, filmed on ${camera.device || 'smartphone'}, ${lighting.source || 'natural window lighting'}, ${camera.angle || 'casual handheld selfie angle'}.`,
    // Layer 2: Person
    `A ${char.age || 'person in their mid-twenties'} ${char.gender || ''} with ${char.hair || 'natural hair'}, ${char.skinTone || 'natural skin'} with ${realism.skinCues || 'visible pores, slight unevenness in skin tone, faint undereye shadows'}, wearing ${char.wardrobe || 'casual clothes'}.`,
    // Layer 3: Setting
    `${setting.location || 'In a casual setting'}${setting.props ? ', ' + setting.props : ''}. ${setting.timeOfDay ? setting.timeOfDay + ' light.' : ''}`,
    // Layer 4+5: Script beats + product intro
    `Speaking directly to camera with genuine energy. ${script}`,
    // Layer 6: Tone direction
    'Energy is authentic and slightly incredulous — like telling a mate something unbelievable that actually happened. Pacing is relaxed, natural pauses between sentences.',
    // Layer 7: Edit style
    'Jump cuts between beats with slight angle shifts.',
    // Layer 8: Technical flaws
    `${realism.cameraFlaws || 'Slight motion blur on hand gestures, minor lens distortion, phone mic audio quality with faint ambient noise, slightly overexposed highlights.'}`,
    // Layer 9: Vibe statement + motion cues
    `${(realism.motionCues || ['breaks eye contact briefly', 'head tilt', 'shifts weight', 'natural hand gesture']).join(', ')}. Raw, relatable, real — not a polished ad. No subtitles, no captions, no text overlays.`,
  ].join(' ');
}

// ── Path 1: UGC (Seedance, AI influencer, no voice clone) ──

async function generateUGC(params: any): Promise<{ assetId: string; pollType: 'arcads_asset' }> {
  const prompt = compose9LayerPrompt(params);
  const api = params.apiParams || {};

  const genRes = await fetch('https://external-api.arcads.ai/v2/videos/generate', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'seedance-2.0',
      prompt,
      aspectRatio: api.aspectRatio || '9:16',
      duration: api.duration || 15,
      resolution: api.resolution || '720p',
      audioEnabled: true,
      productId: ARCADS_PRODUCT_ID,
    }),
  });

  if (!genRes.ok) throw new Error(`Seedance error: ${await genRes.text()}`);
  const data = await genRes.json();
  return { assetId: data.id, pollType: 'arcads_asset' };
}

// ── Path 2: Custom (Seedance + Fish Audio voice + face references) ──

async function generateCustom(params: any): Promise<{ assetId: string; pollType: 'arcads_asset' }> {
  const script = params.script?.dialogueTagged || params.script?.dialogue || '';
  const faceUrls: string[] = params.faceImageUrls || [];
  const singleFace: string | undefined = params.faceImageUrl;

  // Step 1: Generate voice with Fish Audio
  const audioBuffer = await generateFishAudio(script, params.voiceId);

  // Step 2: Upload voice MP3 to Arcads
  const audioFilePath = await arcadsUploadBuffer(audioBuffer, 'audio/mpeg');

  // Step 3: Upload face reference images to Arcads
  const referenceImages: string[] = [];

  // Collect face URLs — from pack faces or single uploaded face or Jordan default
  const allFaceUrls = faceUrls.length > 0 ? faceUrls : singleFace ? [singleFace] : [JORDAN_FACE_URL];

  for (const url of allFaceUrls.slice(0, 3)) { // Max 3 reference images
    const filePath = await arcadsUploadUrl(url);
    referenceImages.push(filePath);
  }

  // Step 4: Compose the 9-layer prompt with character lock
  const char = params.character || {};
  const setting = params.setting || {};
  const api = params.apiParams || {};
  const weights = params.influenceWeights || { face: 0.8, style: 0.5 };

  // Character lock: describe the person from the reference to maintain consistency
  const characterLock = char.description || 'The same person shown in the reference image — maintain exact face, features, and build throughout the entire video.';

  const prompt = [
    `${api.duration || 15} seconds UGC style testimonial video, filmed on smartphone, natural lighting, casual handheld selfie angle.`,
    `IMPORTANT: The person in this video MUST match the reference image exactly — same face, same features, same person throughout. ${characterLock}`,
    `${setting.location ? setting.location + '.' : 'Casual indoor setting.'} ${setting.timeOfDay ? setting.timeOfDay + ' light.' : ''}`,
    `Person is speaking directly to camera with genuine energy, natural hand gestures, breaking eye contact occasionally.`,
    `Slight motion blur, phone mic audio quality, subtle camera jitter, slightly off-center framing.`,
    `Raw, relatable, real — not a polished ad. No subtitles, no captions, no text overlays.`,
  ].join(' ');

  // Step 5: Send to Seedance with referenceImages + referenceAudios
  const genBody: Record<string, unknown> = {
    model: 'seedance-2.0',
    prompt,
    aspectRatio: api.aspectRatio || '9:16',
    duration: api.duration || 15,
    resolution: api.resolution || '720p',
    audioEnabled: true,
    productId: ARCADS_PRODUCT_ID,
    referenceImages,
  };

  const genRes = await fetch('https://external-api.arcads.ai/v2/videos/generate', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(genBody),
  });

  if (!genRes.ok) throw new Error(`Seedance error: ${await genRes.text()}`);
  const data = await genRes.json();
  return { assetId: data.id, pollType: 'arcads_asset' };
}

// ── Main Handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { path, parameters } = req.body;
  if (!path || !parameters) return res.status(400).json({ error: 'path and parameters required' });

  try {
    let result: { assetId: string; pollType: 'arcads_asset' };

    switch (path) {
      case 'seedance':
        result = await generateUGC(parameters);
        break;
      case 'custom':
        result = await generateCustom(parameters);
        break;
      default:
        return res.status(400).json({ error: `Unknown path: ${path}` });
    }

    return res.status(200).json({ ...result, status: 'generating' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
