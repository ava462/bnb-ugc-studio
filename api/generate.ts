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

// ── Path 2: Custom (Seedance + face reference + dialogue in prompt) ──
//
// KEY INSIGHT: Seedance 2.0 generates speech FROM THE PROMPT TEXT when
// audioEnabled=true. referenceAudios is a voice STYLE reference, not lip-sync.
// The dialogue MUST be in the prompt as script beats for the person to speak it.
// Fish Audio MP3 is passed as referenceAudios so Seedance matches that voice tone.

async function generateCustom(params: any): Promise<{ assetId: string; pollType: 'arcads_asset' }> {
  const dialogue = params.script?.dialogue || '';
  const faceUrls: string[] = params.faceImageUrls || [];
  const singleFace: string | undefined = params.faceImageUrl;

  // Step 1: Generate Fish Audio voice as a VOICE STYLE reference
  // Seedance will use this to match the voice tone/style, not as the actual audio track
  const audioBuffer = await generateFishAudio(dialogue, params.voiceId);
  const audioFilePath = await arcadsUploadBuffer(audioBuffer, 'audio/mpeg');

  // Step 2: Upload face reference images to Arcads
  const referenceImages: string[] = [];
  const allFaceUrls = faceUrls.length > 0 ? faceUrls : singleFace ? [singleFace] : [JORDAN_FACE_URL];

  for (const url of allFaceUrls.slice(0, 3)) {
    const filePath = await arcadsUploadUrl(url);
    referenceImages.push(filePath);
  }

  // Step 3: Compose the 9-layer UGC prompt WITH DIALOGUE IN SCRIPT BEATS
  const char = params.character || {};
  const setting = params.setting || {};
  const api = params.apiParams || {};

  const characterLock = char.description || 'The same person shown in the reference image — maintain exact face, features, and build throughout the entire video.';

  // Split dialogue into script beats for natural delivery
  const sentences = dialogue.replace(/\[.*?\]\s*/g, '').split(/(?<=[.!?])\s+/).filter(Boolean);
  let scriptBeats = '';
  if (sentences.length >= 3) {
    scriptBeats = [
      `The video opens with the person looking into camera: "${sentences[0]}"`,
      `Jump cut — slightly different angle, the person gestures with one hand: "${sentences.slice(1, -1).join(' ')}"`,
      `Final shot — person leans closer to camera with a knowing look: "${sentences[sentences.length - 1]}"`,
    ].join(' ');
  } else {
    scriptBeats = `The person looks directly at camera and says: "${dialogue.replace(/\[.*?\]\s*/g, '')}"`;
  }

  const prompt = [
    // Layer 1: Format header
    `${api.duration || 15} seconds UGC style testimonial video, filmed on smartphone, ${setting.timeOfDay || 'natural'} lighting, casual handheld selfie angle.`,
    // Layer 2: Person (character lock to reference image)
    `IMPORTANT: The person in this video MUST match the reference image exactly — same face, same features, same person throughout. ${characterLock}`,
    // Layer 3: Setting
    `${setting.location ? setting.location + '.' : 'Casual indoor setting.'}`,
    // Layer 5: Script beats WITH DIALOGUE
    scriptBeats,
    // Layer 6: Tone
    'Energy is authentic — like telling a friend something genuinely exciting. Relaxed pace with natural pauses.',
    // Layer 7+8: Edit style + technical flaws
    'Jump cuts between beats with slight angle shifts. Slight motion blur, phone mic audio quality, subtle camera jitter, slightly off-center framing.',
    // Layer 9: Vibe
    'Raw, relatable, real — not a polished ad. No subtitles, no captions, no text overlays.',
  ].join(' ');

  // Step 4: Send to Seedance — dialogue is in prompt, Fish Audio is voice style reference
  const genBody: Record<string, unknown> = {
    model: 'seedance-2.0',
    prompt,
    aspectRatio: api.aspectRatio || '9:16',
    duration: api.duration || 15,
    resolution: api.resolution || '720p',
    audioEnabled: true,
    productId: ARCADS_PRODUCT_ID,
    referenceImages,
    referenceAudios: [audioFilePath],
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
