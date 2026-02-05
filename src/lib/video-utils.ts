import { put } from '@vercel/blob';
import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';

const ffmpegPath: string = require('ffmpeg-static');

const MAX_BASE64_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB encoded
const MAX_DECODED_VIDEO_SIZE = 75 * 1024 * 1024; // 75MB decoded

interface VideoFormatResult {
  valid: boolean;
  format: string;
}

export function isValidVideoFormat(buffer: Buffer): VideoFormatResult {
  if (buffer.length < 12) {
    return { valid: false, format: 'unknown' };
  }

  // MP4: bytes 4-8 contain "ftyp"
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    return { valid: true, format: 'mp4' };
  }

  // WebM: starts with 0x1A 0x45 0xDF 0xA3 (EBML header)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { valid: true, format: 'webm' };
  }

  return { valid: false, format: 'unknown' };
}

export async function uploadBase64Video(base64String: string): Promise<string> {
  if (base64String.length > MAX_BASE64_VIDEO_SIZE) {
    throw new Error(`Video too large (max ${MAX_BASE64_VIDEO_SIZE / 1024 / 1024}MB encoded)`);
  }

  let base64Data = base64String.replace(/^data:video\/[a-zA-Z0-9]+;base64,/, '');
  base64Data = base64Data.replace(/\s/g, '');

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    throw new Error('Invalid base64 format');
  }

  if (base64Data.length === 0) {
    throw new Error('Empty base64 string');
  }

  const decodedSize = (base64Data.length * 3) / 4;
  if (decodedSize > MAX_DECODED_VIDEO_SIZE) {
    throw new Error(`Video too large (max ${MAX_DECODED_VIDEO_SIZE / 1024 / 1024}MB decoded)`);
  }

  const buffer = Buffer.from(base64Data, 'base64');

  const formatCheck = isValidVideoFormat(buffer);
  if (!formatCheck.valid) {
    throw new Error('Invalid video format (must be MP4 or WebM)');
  }

  const contentType = formatCheck.format === 'webm' ? 'video/webm' : 'video/mp4';
  const ext = formatCheck.format;
  const filename = `video-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const blob = await put(filename, buffer, {
    access: 'public',
    contentType,
  });

  return blob.url;
}

export async function extractFirstFrame(videoBuffer: Buffer): Promise<string> {
  const tempDir = join(tmpdir(), 'agentgram-frames');
  mkdirSync(tempDir, { recursive: true });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const videoPath = join(tempDir, `input-${id}.mp4`);
  const framePath = join(tempDir, `frame-${id}.png`);

  try {
    writeFileSync(videoPath, videoBuffer);

    execFileSync(ffmpegPath, [
      '-i', videoPath,
      '-vframes', '1',
      '-f', 'image2',
      '-y',
      framePath,
    ], { timeout: 30000 });

    const frameBuffer = readFileSync(framePath);

    const optimized = await sharp(frameBuffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 90 })
      .toBuffer();

    const filename = `thumb-${id}.png`;
    const blob = await put(filename, optimized, {
      access: 'public',
      contentType: 'image/png',
    });

    return blob.url;
  } finally {
    try { unlinkSync(videoPath); } catch (_) { /* noop */ }
    try { unlinkSync(framePath); } catch (_) { /* noop */ }
  }
}
