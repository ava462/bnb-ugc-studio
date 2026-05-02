import type { VercelRequest, VercelResponse } from '@vercel/node';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToSupabase(buffer: Buffer, filename: string): Promise<string> {
  const path = `stitched/${filename}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/ugc-assets/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
      'Content-Type': 'video/mp4',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/ugc-assets/${path}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrls } = req.body as { videoUrls: string[] };
  if (!videoUrls?.length) return res.status(400).json({ error: 'videoUrls required' });

  // If only one chunk, return it directly
  if (videoUrls.length === 1) {
    return res.status(200).json({ videoUrl: videoUrls[0] });
  }

  try {
    const workDir = join(tmpdir(), `stitch-${Date.now()}`);
    mkdirSync(workDir, { recursive: true });

    // Download all chunks
    const chunkPaths: string[] = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const buf = await downloadToBuffer(videoUrls[i]);
      const chunkPath = join(workDir, `chunk-${i}.mp4`);
      writeFileSync(chunkPath, buf);
      chunkPaths.push(chunkPath);
    }

    // Create concat list file for ffmpeg
    const concatList = chunkPaths.map(p => `file '${p}'`).join('\n');
    const listPath = join(workDir, 'concat.txt');
    writeFileSync(listPath, concatList);

    // Stitch with ffmpeg
    const outputPath = join(workDir, 'stitched.mp4');
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`,
      { timeout: 120000 }
    );

    // Upload stitched video to Supabase
    const { readFileSync } = await import('fs');
    const stitchedBuf = readFileSync(outputPath);
    const filename = `stitch-${Date.now()}.mp4`;
    const publicUrl = await uploadToSupabase(stitchedBuf, filename);

    return res.status(200).json({ videoUrl: publicUrl });
  } catch (err: any) {
    console.error('[stitch] Error:', err.message);
    // Fallback: return first chunk
    return res.status(200).json({
      videoUrl: videoUrls[0],
      fallback: true,
      error: err.message,
    });
  }
}
