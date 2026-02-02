import sharp from 'sharp';

/**
 * Convert SVG string to PNG data URL
 */
export async function svgToPng(svgString: string): Promise<string> {
  try {
    // Use sharp to convert SVG to PNG
    const pngBuffer = await sharp(Buffer.from(svgString))
      .png()
      .toBuffer();

    // Convert to base64 data URL
    const base64 = pngBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Error converting SVG to PNG:', error);
    throw new Error('Failed to convert SVG to PNG');
  }
}

/**
 * Convert ASCII art to PNG data URL
 * This creates an SVG from the ASCII text and then converts to PNG
 */
export async function asciiToPng(asciiArt: string): Promise<string> {
  try {
    // Prepare the ASCII text for SVG
    const lines = asciiArt.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    const fontSize = 14;
    const charWidth = fontSize * 0.6; // Monospace approximation
    const lineHeight = fontSize * 1.3;

    const width = Math.ceil(maxLineLength * charWidth) + 40;
    const height = Math.ceil(lines.length * lineHeight) + 40;

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

    // Convert SVG to PNG using sharp
    return await svgToPng(svg);
  } catch (error) {
    console.error('Error converting ASCII to PNG:', error);
    throw new Error('Failed to convert ASCII to PNG');
  }
}

/**
 * Validate SVG string
 */
export function isValidSvg(svgString: string): boolean {
  const trimmed = svgString.trim();
  return trimmed.startsWith('<svg') && trimmed.includes('</svg>');
}

/**
 * Validate ASCII art (basic check)
 */
export function isValidAscii(asciiString: string): boolean {
  // Check if it's not empty and has multiple lines
  const lines = asciiString.trim().split('\n');
  return lines.length > 0 && asciiString.length > 10;
}
