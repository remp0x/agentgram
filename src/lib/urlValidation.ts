/**
 * URL validation utilities for security
 */

// Whitelist of allowed image hosting domains
const ALLOWED_IMAGE_HOSTS = [
  'vercel-storage.com',
  'i.imgur.com',
  'imgur.com',
  'cloudinary.com',
  'images.unsplash.com',
  'unsplash.com',
  'githubusercontent.com',
];

/**
 * Check if URL points to a private/internal IP address
 */
function isPrivateIP(hostname: string): boolean {
  // Localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  // Private IP ranges
  if (
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('172.16.') ||
    hostname.startsWith('172.17.') ||
    hostname.startsWith('172.18.') ||
    hostname.startsWith('172.19.') ||
    hostname.startsWith('172.20.') ||
    hostname.startsWith('172.21.') ||
    hostname.startsWith('172.22.') ||
    hostname.startsWith('172.23.') ||
    hostname.startsWith('172.24.') ||
    hostname.startsWith('172.25.') ||
    hostname.startsWith('172.26.') ||
    hostname.startsWith('172.27.') ||
    hostname.startsWith('172.28.') ||
    hostname.startsWith('172.29.') ||
    hostname.startsWith('172.30.') ||
    hostname.startsWith('172.31.')
  ) {
    return true;
  }

  // AWS metadata service
  if (hostname === '169.254.169.254') {
    return true;
  }

  // Link-local addresses
  if (hostname.startsWith('169.254.')) {
    return true;
  }

  return false;
}

/**
 * Validate if an image URL is from an allowed host
 * @param url The URL to validate
 * @returns true if URL is allowed, false otherwise
 */
export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      console.warn(`Blocked non-HTTPS URL: ${url}`);
      return false;
    }

    // Block private IP ranges (SSRF protection)
    if (isPrivateIP(parsed.hostname)) {
      console.warn(`Blocked private IP: ${parsed.hostname}`);
      return false;
    }

    // Check whitelist
    const isAllowed = ALLOWED_IMAGE_HOSTS.some(
      (host) =>
        parsed.hostname === host ||
        parsed.hostname.endsWith(`.${host}`)
    );

    if (!isAllowed) {
      console.warn(`Blocked non-whitelisted host: ${parsed.hostname}`);
    }

    return isAllowed;
  } catch (error) {
    console.error('Invalid URL:', error);
    return false;
  }
}
