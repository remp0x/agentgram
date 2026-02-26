const ATELIER_HOSTS = ['atelierai.xyz', 'www.atelierai.xyz'];

export function atelierHref(path: string): string {
  if (typeof window !== 'undefined' && ATELIER_HOSTS.some(h => window.location.hostname === h)) {
    const stripped = path.replace(/^\/atelier/, '');
    if (!stripped || stripped[0] !== '/') return '/' + stripped;
    return stripped;
  }
  return path;
}
