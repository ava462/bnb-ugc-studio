import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const SEGMENTATION_SYSTEM_PROMPT = `You are a professional video editor and UGC ad producer for BNB Success, an Australian short-term rental mentorship. You segment scripts for Seedance 2.0 AI video generation.

Given a script longer than 15 seconds, split it into production-ready chunks.

RETURN JSON ONLY. No markdown, no preamble, no backticks.

TIMING:
- Each chunk: 8-15 seconds max (Seedance limit is 15s)
- ~2.5 words per second (150 wpm)
- Never below 5 seconds
- Chunks cover the full script with no gaps

BREAKPOINTS — split at:
- Sentence boundaries (NEVER mid-sentence)
- Emotional shifts
- Topic shifts
- Rhetorical pauses
- Before "but," "however," "the thing is," "here's what happened"

USER TRANSITION TAGS — if the script contains these inline tags, ALWAYS split at that exact point and use the specified transition type:
- [CUT] → force a hard cut here (transitionIn: "cut", transitionDuration: 0)
- [CROSSFADE] → force a crossfade here (transitionIn: "crossfade", transitionDuration: 12)
- [SLIDE] → force a slide transition (transitionIn: "slide-left", transitionDuration: 8)
- [FADE] → force a fade-to-black/fade-from-black (transitionIn: "fade-from-black", transitionDuration: 10)
Strip these tags from the scriptText in each chunk — they're instructions, not dialogue.

STRUCTURE:
- First chunk: HOOK (attention grab)
- Middle chunks: Story, context, proof
- Last chunk: CTA

FOR EACH CHUNK:

chunkIndex: sequential from 0
startTimeSec / endTimeSec / durationSec: based on word count at 2.5 words/sec
scriptText: exact dialogue for this chunk

continuityNote: How this chunk connects visually to the previous.
  Chunk 0: empty string. Chunk 1+: character's physical state at START matching END of previous.

seedancePromptAdditions: Extra Seedance prompt text for visual continuity.

seedanceRealismCues: Array of 2-3 realism cues. Choose based on shot type:
  Close-up: skin texture, eye behaviour, micro-expressions
  Medium: weight shifts, fabric physics, hand fidgets
  Always include 1 camera realism cue (grain, focus, handheld motion)

transitionIn: "fade-from-black" (chunk 0 only), "cut", "crossfade", "slide-left"
transitionDuration: frames at 30fps (cut=0, crossfade=10-15, slide=8-10, fade=8-12)

editCues: Array of edit instructions (1-3 per chunk max):
  type: "b-roll" | "zoom" | "text-overlay" | "emphasis" | "pause-beat"
  startSec / endSec: relative to chunk start
  description: specific instruction
  style: for text-overlay — "hook" | "stat" | "cta" | "quote"
  zoomPercent: for zoom — target (e.g. 108 = 108%)

audioEditCues: Array of audio instructions (0-2 per chunk):
  type: "duck" | "emphasis-eq" | "room-shift" | "music-swell"
  startSec / endSec: relative to chunk start
  description, volumeDb`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { script, path, parameters } = req.body;
  if (!script) return res.status(400).json({ error: 'Script is required' });

  const words = script.replace(/\[.*?\]\s*/g, '').split(/\s+/).filter((w: string) => w.length > 0).length;
  const estDuration = Math.round((words / 150) * 60);

  // Short scripts don't need segmentation
  if (estDuration <= 15) {
    return res.json({
      needsSegmentation: false,
      totalDurationSec: estDuration,
      chunks: [{
        chunkIndex: 0, startTimeSec: 0, endTimeSec: estDuration, durationSec: estDuration,
        scriptText: script, continuityNote: '', seedancePromptAdditions: '',
        seedanceRealismCues: [], transitionIn: 'fade-from-black', transitionDuration: 8,
        editCues: [], audioEditCues: [],
      }],
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SEGMENTATION_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Segment this script. Estimated total: ${estDuration} seconds, ${words} words.

Path: ${path || 'ugc'}
Character: ${JSON.stringify(parameters?.character || {})}
Setting: ${JSON.stringify(parameters?.setting || {})}

Full script:
---
${script}
---`
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Claude API error: ${err}` });
    }

    const data = await response.json();
    const text = data.content[0].text;
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    // Build markedScript: full script with inline cut/transition markers
    // so the user can see exactly where cuts happen
    if (result.chunks?.length > 1) {
      const transitionLabels: Record<string, string> = {
        'cut': '✂️ CUT',
        'crossfade': '🔀 CROSSFADE',
        'slide-left': '➡️ SLIDE',
        'slide-right': '⬅️ SLIDE',
        'fade-from-black': '⬛ FADE IN',
        'fade-to-black': '⬛ FADE OUT',
      };

      let marked = '';
      for (let i = 0; i < result.chunks.length; i++) {
        const chunk = result.chunks[i];
        if (i > 0) {
          const label = transitionLabels[chunk.transitionIn] || '✂️ CUT';
          marked += `\n\n--- ${label} (${chunk.transitionDuration || 0} frames) ---\n\n`;
        }
        marked += chunk.scriptText;
      }
      result.markedScript = marked;
    }

    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: `Segmentation failed: ${e.message}` });
  }
}
