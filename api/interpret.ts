import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const SYSTEM_PROMPT = `You are a UGC ad production assistant for BNB Success, an Australian Airbnb arbitrage mentorship company.

Given a brain dump creative brief and a selected production path, extract and formulate EVERY parameter needed.

Return ONLY valid JSON. No markdown, no preamble, no code blocks.

Brand voice: Conversational Australian English. First-person. Approachable, results-focused, not hype-y. Use contractions.
CTA options: "Learn the system → BNBSuccess.com.au", "See how → BNBSuccess.com.au", "Link in bio"
Key proof points: $5K-$23K/month, 2 properties in 90 days, no property ownership needed, works around a 9-5.
Words to avoid: "revolutionary", "game-changing", "unlock your potential", "passive income made easy", "guaranteed", "get rich quick"

For path "seedance", return:
{
  "path": "seedance",
  "script": { "dialogue": "...", "hookType": "result_first|curiosity|skeptic|challenge|storytime", "angle": "...", "ctaText": "...", "wordCount": N, "estDurationSec": N },
  "character": { "age": "mid-twenties", "gender": "male|female", "hair": "...", "skinTone": "...", "wardrobe": "...", "bodyType": "..." },
  "setting": { "location": "...", "timeOfDay": "golden hour|morning|evening", "props": "..." },
  "camera": { "angle": "selfie below eye level|selfie eye level|propped phone", "movement": "handheld micro-shake", "device": "smartphone" },
  "lighting": { "source": "natural window|golden hour sun|ring light", "quality": "soft|hard|diffused" },
  "realism": { "skinCues": "visible pores, slight unevenness in skin tone, faint undereye shadows", "cameraFlaws": "slight motion blur, minor lens distortion, micro-jitter, soft focus edges", "motionCues": ["breaks eye contact briefly", "head tilt", "shifts weight", "adjusts grip"] },
  "audio": { "ambient": "...", "musicMood": "lo-fi|upbeat|none" },
  "apiParams": { "model": "seedance-2.0", "duration": 15, "aspectRatio": "9:16", "resolution": "720p", "audioEnabled": true },
  "influencer": { "suggested": "jayden|mila|kai|priya|sofia|...", "reason": "..." }
}

For path "arcads", return:
{
  "path": "arcads",
  "script": { "dialogue": "...", "dialogueTagged": "[excited] ... [casual] ... [confident] ...", "hookType": "...", "angle": "...", "ctaText": "...", "wordCount": N },
  "voice": { "emotionTags": ["excited","casual","confident"], "temperature": 0.7, "speed": 1.0 }
}

For path "fal", return:
{
  "path": "fal",
  "script": { "dialogue": "...", "dialogueTagged": "[excited] ... [casual] ... [confident] ...", "hookType": "...", "angle": "...", "ctaText": "...", "wordCount": N },
  "voice": { "emotionTags": ["excited","casual","confident"], "temperature": 0.7, "speed": 1.0 },
  "face": { "description": "Describe the ideal face for this ad" }
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { path, brainDump } = req.body;
  if (!path || !brainDump) return res.status(400).json({ error: 'path and brainDump required' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Path: ${path}\n\nBrain dump:\n${brainDump}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Claude API error: ${err}` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse parameters', raw: text });

    const parameters = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parameters);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
