import type { VercelRequest, VercelResponse } from '@vercel/node';

const ARCADS_BASIC_AUTH = process.env.ARCADS_BASIC_AUTH!;
const ARCADS_PRODUCT_ID = process.env.ARCADS_PRODUCT_ID!;
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY!;
const FISH_AUDIO_VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || '14d07e89acda4214bd319865a7e1a888';
const JORDAN_FACE_URL = process.env.JORDAN_FACE_URL || 'https://zyiidveeixbbjpswruyn.supabase.co/storage/v1/object/public/ugc-assets/face-references/jordan-pham-hero.jpg';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

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

  // Mandatory human realism block — applied to ALL prompts
  const humanRealism = 'NATURAL HUMAN BEHAVIOR: The person behaves like a real human — they blink at a normal relaxed rate (not exaggerated or forced), occasionally glance away from camera for a split second then return naturally. Subtle, understated micro-movements only: a slight head tilt here, a small shift in posture there. Less is more — do NOT overdo expressions or gestures. The goal is a calm, natural person talking, not an animated performance.';

  return [
    // Layer 1: Format header
    `${api.duration || 15} seconds UGC style honest review video, filmed on ${camera.device || 'smartphone'}, ${lighting.source || 'natural window lighting'}, ${camera.angle || 'casual handheld selfie angle'}.`,
    // Layer 2: Person
    `A ${char.age || 'person in their mid-twenties'} ${char.gender || ''} with ${char.hair || 'natural hair'}, ${char.skinTone || 'natural skin'} with ${realism.skinCues || 'visible pores, slight unevenness in skin tone, faint undereye shadows'}, wearing ${char.wardrobe || 'casual clothes'}.`,
    // Layer 3: Setting
    `${setting.location || 'In a casual setting'}${setting.props ? ', ' + setting.props : ''}. ${setting.timeOfDay ? setting.timeOfDay + ' light.' : ''}`,
    // Human realism block
    humanRealism,
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

// ── Path 2: Custom (Seedance + character pack from reference_packs table) ──
//
// Flow: Fetch pack from Supabase → build prompt with dialogue + lock_prompt →
// upload face refs to Arcads → optionally generate Fish Audio voice ref →
// send to Seedance 2.0

async function fetchPack(packId: string): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/reference_packs?id=eq.${packId}&limit=1`, {
    headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

async function generateCustom(params: any): Promise<{ assetId: string; pollType: 'arcads_asset' }> {
  const dialogue = params.script?.dialogue || '';
  const api = params.apiParams || {};
  const setting = params.setting || {};

  // Step 1: Get character pack (from packId or use face URLs directly)
  let faceUrls: string[] = [];
  let lockPrompt = '';
  let voiceId: string | null = null;

  if (params.packId) {
    const pack = await fetchPack(params.packId);
    if (pack) {
      faceUrls = [pack.face_front, pack.face_3quarter, pack.face_profile, ...(pack.face_additional || [])].filter(Boolean);
      lockPrompt = pack.lock_prompt || '';
      voiceId = pack.fish_audio_voice_id || null;
    }
  }

  // Fallback to params if no pack
  if (!faceUrls.length) {
    const urls = params.faceImageUrls || [];
    const single = params.faceImageUrl;
    faceUrls = urls.length ? urls : single ? [single] : [JORDAN_FACE_URL];
  }
  if (!lockPrompt) {
    lockPrompt = params.lockPrompt || params.character?.description || 'The same person shown in the reference image — maintain exact face, features, and build throughout the entire video.';
  }

  // Step 2: Upload face references to Arcads (max 3)
  const referenceImages: string[] = [];
  for (const url of faceUrls.slice(0, 3)) {
    const filePath = await arcadsUploadUrl(url);
    referenceImages.push(filePath);
  }

  // Step 3: Optionally generate Fish Audio voice style reference
  let referenceAudios: string[] | undefined;
  const vid = voiceId || params.voiceId || FISH_AUDIO_VOICE_ID;
  if (vid && dialogue.length > 20) {
    try {
      const audioBuffer = await generateFishAudio(dialogue, vid);
      const audioPath = await arcadsUploadBuffer(audioBuffer, 'audio/mpeg');
      referenceAudios = [audioPath];
    } catch {
      // Fish Audio failed — continue without voice reference, Seedance will use its own voice
    }
  }

  // Step 4: Build prompt with dialogue as script beats
  const cleanDialogue = dialogue.replace(/\[.*?\]\s*/g, '');
  const sentences = cleanDialogue.split(/(?<=[.!?])\s+/).filter(Boolean);
  let scriptBeats: string;
  if (sentences.length >= 3) {
    scriptBeats = [
      `The video opens with the person looking into camera: "${sentences[0]}"`,
      `Jump cut — slightly different angle, the person gestures naturally: "${sentences.slice(1, -1).join(' ')}"`,
      `Final shot — person leans slightly closer: "${sentences[sentences.length - 1]}"`,
    ].join(' ');
  } else {
    scriptBeats = `The person looks at camera and says: "${cleanDialogue}"`;
  }

  const humanRealism = 'NATURAL HUMAN BEHAVIOR: The person blinks at a normal relaxed rate, occasionally glances away then back. Subtle micro-movements only: a slight head tilt, a small posture shift. Less is more — calm, natural person talking, not an animated performance.';

  const prompt = [
    `${api.duration || 15} seconds UGC style testimonial video, filmed on smartphone, ${setting.timeOfDay || 'natural'} lighting, casual handheld selfie angle.`,
    `IMPORTANT: The person MUST match the reference image exactly — same face, same features throughout. ${lockPrompt}`,
    `${setting.location ? setting.location + '.' : 'Casual indoor setting.'}`,
    humanRealism,
    scriptBeats,
    'Energy is authentic — like telling a friend something genuinely exciting. Relaxed pace with natural pauses.',
    'Jump cuts between beats. Slight motion blur, phone mic audio, subtle camera jitter, slightly off-center framing.',
    'Raw, relatable, real — not a polished ad. No subtitles, no captions, no text overlays.',
  ].join(' ');

  // Step 5: Send to Seedance
  const genBody: Record<string, unknown> = {
    model: 'seedance-2.0',
    prompt,
    aspectRatio: api.aspectRatio || '9:16',
    duration: api.duration || 15,
    resolution: api.resolution || '720p',
    audioEnabled: true,
    productId: ARCADS_PRODUCT_ID,
    referenceImages,
    ...(referenceAudios ? { referenceAudios } : {}),
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
