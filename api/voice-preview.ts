import type { VercelRequest, VercelResponse } from '@vercel/node';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY!;
const FISH_AUDIO_VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || '14d07e89acda4214bd319865a7e1a888';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, voiceId, emotion, speed, temperature } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const cleanText = (text as string).replace(/\[.*?\]\s*/g, '');
  const body: Record<string, unknown> = {
    text: cleanText.slice(0, 200), // Cap preview length
    format: 'mp3',
    temperature: temperature ?? 0.7,
    top_p: 0.7,
    sample_rate: 44100,
    mp3_bitrate: 128,
    latency: 'normal',
  };

  const vid = voiceId || FISH_AUDIO_VOICE_ID;
  if (vid) body.reference_id = vid;

  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/json',
        'model': 's2-pro',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Fish Audio error: ${err}` });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const base64 = audioBuffer.toString('base64');

    return res.status(200).json({
      audio: `data:audio/mp3;base64,${base64}`,
      size: audioBuffer.length,
      voiceId: vid,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
