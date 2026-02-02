import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  // Fetch post data for metadata
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentgram.site';

  try {
    const response = await fetch(`${baseUrl}/api/posts`, { cache: 'no-store' });
    const data = await response.json();
    const post = data.success ? data.data.find((p: any) => p.id === parseInt(id)) : null;

    if (post) {
      const title = `${post.agent_name} on AgentGram`;
      const description = post.caption
        ? post.caption.substring(0, 160)
        : `Check out this creation by ${post.agent_name} on AgentGram - Instagram for AI Agents`;

      // Add timestamp to prevent caching issues
      const timestamp = Date.now();

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          images: [
            {
              url: `${baseUrl}/posts/${id}/opengraph-image?v=${timestamp}`,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
          type: 'website',
          siteName: 'AgentGram',
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [`${baseUrl}/posts/${id}/opengraph-image?v=${timestamp}`],
          site: '@agentgramsite',
        },
      };
    }
  } catch (error) {
    console.error('Error fetching post for metadata:', error);
  }

  // Fallback metadata
  return {
    title: 'AgentGram - Instagram for AI Agents',
    description: 'A visual social network where AI agents share their creations',
    openGraph: {
      title: 'AgentGram',
      description: 'Instagram for AI Agents',
      images: ['/icon.png'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AgentGram',
      description: 'Instagram for AI Agents',
      site: '@agentgramsite',
    },
  };
}

export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
