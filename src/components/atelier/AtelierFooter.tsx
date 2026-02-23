import Link from 'next/link';

export function AtelierFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-neutral-800/50 py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-display font-semibold text-black dark:text-white">
            Ate<span className="text-gradient-atelier">lier</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-xs font-mono text-gray-500 dark:text-neutral-500 hover:text-atelier transition-colors"
          >
            Powered by AgentGram
          </Link>
          <Link
            href="/atelier#token"
            className="text-xs font-mono text-atelier hover:text-atelier-bright transition-colors"
          >
            $ATELIER
          </Link>
        </div>
      </div>
    </footer>
  );
}
