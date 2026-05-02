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

const HUMAN_REALISM = `MANDATORY HUMAN REALISM — apply throughout the entire video:
Eye behavior: natural blink rate, gaze drifts slightly off-lens then returns, brief downward glance when recalling a thought, eyes narrow slightly when making a serious point.
Head and body: subtle weight shifts between feet, slight lean forward on key statements, one-shoulder micro-shrug on casual lines, chin dip when transitioning between thoughts.
Hands: idle fidget or light grip adjustment between spoken lines, open-palm gesture on emphasis words, brief touch of chin or collar during pauses.
Micro-expressions: asymmetric half-smile on confident lines, slight eyebrow raise before a reveal, lips press together briefly between sentences.
Pacing: natural breath pauses between sentences — not robotic continuous speech. One deliberate 0.5-second pause mid-video where the person collects their thought.
DO NOT overdo any single behavior. Each cue should appear once or twice across the video, spread naturally. The goal is a real person talking — not an actor performing.`;

function compose9LayerPrompt(params: any): string {
  const script = params.script?.dialogue || '';
  const scene = params.scene || {};
  const char = params.character || {};
  const setting = params.setting || {};
  const camera = params.camera || {};
  const lighting = params.lighting || {};
  const realism = params.realism || {};
  const api = params.apiParams || {};

  // Scene/context layer — what's HAPPENING visually (separate from dialogue)
  const sceneAction = scene.action ? `The person ${scene.action}.` : '';
  const sceneContext = scene.context ? `Visual context: ${scene.context}.` : '';

  return [
    // Layer 1: Format
    `${api.duration || 15} seconds UGC style video, filmed on ${camera.device || 'smartphone'}, ${lighting.source || 'natural window lighting'}, ${camera.angle || 'casual handheld selfie angle'}.`,
    // Layer 2: Person
    `A ${char.age || 'person in their mid-twenties'} ${char.gender || ''} with ${char.hair || 'natural hair'}, ${char.skinTone || 'natural skin'} with ${realism.skinCues || 'visible pores, slight unevenness in skin tone, faint undereye shadows'}, wearing ${char.wardrobe || 'casual clothes'}.`,
    // Layer 3: Setting
    `${setting.location || 'In a casual setting'}${setting.props ? ', ' + setting.props : ''}. ${setting.timeOfDay ? setting.timeOfDay + ' light.' : ''}`,
    // Layer 4: Scene/action (what they're DOING)
    sceneAction,
    sceneContext,
    // Human realism
    HUMAN_REALISM,
    // Layer 5: Dialogue (what they're SAYING)
    script ? `Speaking directly to camera: "${script}"` : '',
    // Layer 6-9: Tone, edit, flaws, vibe
    'Energy is authentic. Relaxed pace with natural pauses.',
    'Jump cuts between beats with slight angle shifts.',
    `${realism.cameraFlaws || 'Slight motion blur, phone mic audio quality, slightly overexposed highlights.'}`,
    `${(realism.motionCues || ['breaks eye contact briefly', 'head tilt', 'shifts weight']).join(', ')}. Raw, relatable, real — not a polished ad. No subtitles, no captions, no text overlays.`,
  ].filter(Boolean).join(' ');
}

// ── Path 1: UGC (Seedance, with optional reference images) ──

async function generateUGC(params: any): Promise<{ assetId: string; pollType: 'arcads_asset' }> {
  const prompt = compose9LayerPrompt(params);
  const api = params.apiParams || {};

  // Upload reference images if provided (from frontend)
  const referenceImages: string[] = [];
  const refUrls: string[] = params.referenceImageUrls || [];
  if (params.referenceImageUrl) refUrls.push(params.referenceImageUrl);

  for (const url of refUrls.slice(0, 3)) {
    const path = await arcadsUploadUrl(url);
    referenceImages.push(path);
  }

  // Clamp duration to valid Seedance 2.0 range (4-15s, integer)
  const duration = Math.max(4, Math.min(15, Math.round(api.duration || 15)));

  // Truncate prompt to 2000 chars to avoid Arcads failures from oversized prompts
  const truncatedPrompt = prompt.length > 2000 ? prompt.slice(0, 2000) : prompt;

  const genRes = await fetch('https://external-api.arcads.ai/v2/videos/generate', {
    method: 'POST',
    headers: { 'Authorization': ARCADS_BASIC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'seedance-2.0',
      prompt: truncatedPrompt,
      aspectRatio: api.aspectRatio || '9:16',
      duration,
      resolution: api.resolution || '720p',
      productId: ARCADS_PRODUCT_ID,
      ...(referenceImages.length ? { referenceImages } : {}),
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

  // Step 2: Upload face + generate voice IN PARALLEL (saves ~8s)
  // Only upload 1 face reference (front-facing) — more refs = slower Seedance queue
  // Use the pack's voice ID if configured. Don't auto-fallback to Jordan's voice.
  const vid = voiceId || params.voiceId || null;
  const faceUrl = faceUrls[0] || JORDAN_FACE_URL;

  const [faceResult, audioResult] = await Promise.allSettled([
    arcadsUploadUrl(faceUrl),
    vid && dialogue.length > 20
      ? generateFishAudio(dialogue, vid).then(buf => arcadsUploadBuffer(buf, 'audio/mpeg'))
      : Promise.resolve(null),
  ]);

  const referenceImages: string[] = [];
  if (faceResult.status === 'fulfilled') referenceImages.push(faceResult.value);

  let referenceAudios: string[] | undefined;
  if (audioResult.status === 'fulfilled' && audioResult.value) {
    referenceAudios = [audioResult.value];
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

  // Scene/context layer (separate from dialogue)
  const scene = params.scene || {};
  const sceneAction = scene.action ? `The person ${scene.action}.` : '';
  const sceneContext = scene.context ? `Visual context: ${scene.context}.` : '';

  const prompt = [
    `${api.duration || 15} seconds UGC style testimonial video, filmed on smartphone, ${setting.timeOfDay || 'natural'} lighting, casual handheld selfie angle.`,
    `IMPORTANT: The person MUST match the reference image exactly — same face, same features throughout. ${lockPrompt}`,
    `${setting.location ? setting.location + '.' : 'Casual indoor setting.'}`,
    sceneAction,
    sceneContext,
    HUMAN_REALISM,
    scriptBeats,
    'Energy is authentic. Relaxed pace with natural pauses.',
    'Jump cuts between beats. Slight motion blur, phone mic audio, subtle camera jitter, slightly off-center framing.',
    'Raw, relatable, real — not a polished ad. No subtitles, no captions, no text overlays.',
  ].filter(Boolean).join(' ');

  // Step 5: Send to Seedance
  // Clamp duration to valid Seedance 2.0 range (4-15s, integer)
  const duration = Math.max(4, Math.min(15, Math.round(api.duration || 15)));
  // Truncate prompt to 2000 chars to avoid Arcads failures from oversized prompts
  const truncatedPrompt = prompt.length > 2000 ? prompt.slice(0, 2000) : prompt;

  const genBody: Record<string, unknown> = {
    model: 'seedance-2.0',
    prompt: truncatedPrompt,
    aspectRatio: api.aspectRatio || '9:16',
    duration,
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
