import type { VercelRequest, VercelResponse } from '@vercel/node';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY!;
const DEFAULT_VOICE = '14d07e89acda4214bd319865a7e1a888';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { script, voiceId, temperature, topP, speed, format, sampleRate, bitrate } = req.body;
  if (!script) return res.status(400).json({ error: 'script required' });

  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/json',
        'model': 's2-pro',
      },
      body: JSON.stringify({
        text: script,
        reference_id: voiceId || DEFAULT_VOICE,
        temperature: temperature ?? 0.7,
        top_p: topP ?? 0.7,
        format: format || 'mp3',
        sample_rate: sampleRate ?? 44100,
        mp3_bitrate: bitrate ?? 128,
        latency: 'normal',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `Fish Audio error: ${err}` });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Return as base64 data URI for browser playback
    const base64 = audioBuffer.toString('base64');
    const mime = format === 'wav' ? 'audio/wav' : format === 'flac' ? 'audio/flac' : 'audio/mp3';

    return res.status(200).json({
      audio: `data:${mime};base64,${base64}`,
      size: audioBuffer.length,
      format: format || 'mp3',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
