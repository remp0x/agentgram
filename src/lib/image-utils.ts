import sharp from 'sharp';
import { put } from '@vercel/blob';

// Size limits for security
const MAX_SVG_SIZE = 500 * 1024; // 500KB
const MAX_ASCII_LINES = 200;
const MAX_ASCII_LINE_LENGTH = 200;
const MAX_ASCII_TOTAL_SIZE = 100 * 1024; // 100KB
const MAX_BASE64_SIZE = 10 * 1024 * 1024; // 10MB encoded
const MAX_DECODED_SIZE = 7.5 * 1024 * 1024; // ~7.5MB decoded
const MAX_IMAGE_DIMENSION = 4096; // 4096x4096 max

/**
 * Upload buffer to Vercel Blob and return public URL
 */
async function uploadToBlob(buffer: Buffer, filename: string): Promise<string> {
  try {
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });
    return blob.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading to Vercel Blob:', message, error);
    throw new Error(`Blob upload failed: ${message}`);
  }
}

/**
 * Convert SVG string to PNG and upload to Vercel Blob
 */
export async function svgToPng(svgString: string): Promise<string> {
  try {
    // Check size before processing
    const sizeInBytes = Buffer.byteLength(svgString, 'utf8');
    if (sizeInBytes > MAX_SVG_SIZE) {
      throw new Error(`SVG too large (max ${MAX_SVG_SIZE / 1024}KB, got ${Math.round(sizeInBytes / 1024)}KB)`);
    }

    // Use sharp to convert SVG to PNG
    const pngBuffer = await sharp(Buffer.from(svgString))
      .png()
      .toBuffer();

    // Upload to Vercel Blob
    const filename = `svg-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    return await uploadToBlob(pngBuffer, filename);
  } catch (error) {
    console.error('Error converting SVG to PNG:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to convert SVG to PNG');
  }
}

/**
 * Convert ASCII art to PNG and upload to Vercel Blob
 * This creates an SVG from the ASCII text and then converts to PNG
 */
export async function asciiToPng(asciiArt: string): Promise<string> {
  try {
    // Check total size
    const sizeInBytes = Buffer.byteLength(asciiArt, 'utf8');
    if (sizeInBytes > MAX_ASCII_TOTAL_SIZE) {
      throw new Error(`ASCII art too large (max ${MAX_ASCII_TOTAL_SIZE / 1024}KB, got ${Math.round(sizeInBytes / 1024)}KB)`);
    }

    // Prepare the ASCII text for SVG
    const lines = asciiArt.split('\n');

    // Check line count
    if (lines.length > MAX_ASCII_LINES) {
      throw new Error(`Too many lines (max ${MAX_ASCII_LINES}, got ${lines.length})`);
    }

    // Check line lengths
    const maxLineLength = Math.max(...lines.map(line => line.length));
    if (maxLineLength > MAX_ASCII_LINE_LENGTH) {
      throw new Error(`Line too long (max ${MAX_ASCII_LINE_LENGTH} characters, got ${maxLineLength})`);
    }

    const fontSize = 14;
    const charWidth = fontSize * 0.6; // Monospace approximation
    const lineHeight = fontSize * 1.3;

    const width = Math.ceil(maxLineLength * charWidth) + 40;
    const height = Math.ceil(lines.length * lineHeight) + 40;

    // Sanity check on dimensions
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      throw new Error(`Resulting image dimensions too large (${width}x${height}, max ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION})`);
    }

    // Escape XML special characters
    const escapeXml = (str: string) =>
      str.replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&apos;');

    // Create SVG with ASCII art
    const svgLines = lines.map((line, index) => {
      const y = 20 + (index * lineHeight);
      return `<text x="20" y="${y}" font-family="monospace" font-size="${fontSize}" fill="#00FF00">${escapeXml(line)}</text>`;
    }).join('\n    ');

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#000000"/>
  <g>
    ${svgLines}
  </g>
</svg>`;

    // Convert SVG to PNG
    const pngBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    // Upload to Vercel Blob
    const filename = `ascii-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    return await uploadToBlob(pngBuffer, filename);
  } catch (error) {
    console.error('Error converting ASCII to PNG:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to convert ASCII to PNG');
  }
}

/**
 * Validate SVG string with security checks
 */
export function isValidSvg(svgString: string): boolean {
  const trimmed = svgString.trim();

  // Basic structure check
  if (!trimmed.startsWith('<svg') || !trimmed.includes('</svg>')) {
    return false;
  }

  // Check for forbidden elements (XSS vectors)
  const forbiddenElements = [
    '<script',
    '<foreignObject',
    '<embed',
    '<object',
    '<iframe',
    '<frame',
    '<applet',
  ];

  for (const forbidden of forbiddenElements) {
    if (trimmed.toLowerCase().includes(forbidden.toLowerCase())) {
      console.warn(`SVG contains forbidden element: ${forbidden}`);
      return false;
    }
  }

  // Check for event handlers (XSS vectors)
  const eventHandlerPattern = /\son\w+\s*=/i;
  if (eventHandlerPattern.test(trimmed)) {
    console.warn('SVG contains event handler attributes');
    return false;
  }

  // Check for external references (SSRF vectors)
  const externalRefPatterns = [
    /href\s*=\s*["']https?:\/\//i,
    /xlink:href\s*=\s*["']https?:\/\//i,
    /src\s*=\s*["']https?:\/\//i,
  ];

  for (const pattern of externalRefPatterns) {
    if (pattern.test(trimmed)) {
      console.warn('SVG contains external HTTP references');
      return false;
    }
  }

  // Check for data URIs with scripts
  if (trimmed.includes('data:text/html') || trimmed.includes('data:image/svg+xml')) {
    console.warn('SVG contains potentially dangerous data URIs');
    return false;
  }

  // Count total elements to detect SVG bombs
  // This is a rough count - actual bombs could be more sophisticated
  const elementCount = (trimmed.match(/<\w+/g) || []).length;
  if (elementCount > 1000) {
    console.warn(`SVG has too many elements: ${elementCount}`);
    return false;
  }

  // Check for excessive <use> elements (common in SVG bombs)
  const useCount = (trimmed.match(/<use/gi) || []).length;
  if (useCount > 50) {
    console.warn(`SVG has excessive <use> elements: ${useCount}`);
    return false;
  }

  return true;
}

/**
 * Validate ASCII art (basic check)
 */
export function isValidAscii(asciiString: string): boolean {
  // Check if it's not empty and has multiple lines
  const lines = asciiString.trim().split('\n');
  return lines.length > 0 && asciiString.length > 10;
}

/**
 * Upload base64 image directly to Vercel Blob
 * For images generated by agents (OpenAI, Gemini, etc.)
 */
export async function uploadBase64Image(base64String: string): Promise<string> {
  try {
    // Check size before decoding
    if (base64String.length > MAX_BASE64_SIZE) {
      throw new Error(`Base64 string too large (max ${MAX_BASE64_SIZE / 1024 / 1024}MB encoded, got ${Math.round(base64String.length / 1024 / 1024)}MB)`);
    }

    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    let base64Data = base64String.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    // Remove whitespace/newlines that some encoders add
    base64Data = base64Data.replace(/\s/g, '');

    // Validate base64 format (after cleaning)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      throw new Error('Invalid base64 format');
    }

    // Check if we have any data
    if (base64Data.length === 0) {
      throw new Error('Empty base64 string');
    }

    // Calculate decoded size (base64 is ~4/3 of original)
    const decodedSize = (base64Data.length * 3) / 4;
    if (decodedSize > MAX_DECODED_SIZE) {
      throw new Error(`Decoded image too large (max ${MAX_DECODED_SIZE / 1024 / 1024}MB, estimated ${Math.round(decodedSize / 1024 / 1024)}MB)`);
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate it's actually an image
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format || !['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(metadata.format)) {
      throw new Error('Invalid image format (must be PNG, JPEG, WebP, or GIF)');
    }

    // Optimize image with sharp (resize if too large, compress)
    const optimizedBuffer = await sharp(buffer)
      .resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ quality: 90 })
      .toBuffer();

    // Upload to Vercel Blob
    const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    return await uploadToBlob(optimizedBuffer, filename);
  } catch (error) {
    console.error('Error uploading base64 image:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to upload base64 image');
  }
}
