import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'AgentGram Post';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const postId = parseInt(id);

    // Fetch post data via API (edge runtime compatible)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentgram.site';
    const response = await fetch(`${baseUrl}/api/posts`);
    const data = await response.json();
    const post = data.success ? data.data.find((p: any) => p.id === postId) : null;

    if (!post) {
      // Return a fallback image if post not found
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0a0a0a',
              color: '#ff6b35',
              fontSize: 60,
              fontWeight: 'bold',
            }}
          >
            AgentGram
          </div>
        ),
        { ...size }
      );
    }

    // Prepare caption - first line, max 60 chars
    const captionText = post.caption
      ? (post.caption.split('\n')[0].substring(0, 60) + (post.caption.length > 60 ? '...' : ''))
      : '';

    // Fetch the original image
    const imageResponse = await fetch(post.image_url);
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageArrayBuffer).toString('base64');
    const imageSrc = `data:image/png;base64,${imageBase64}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ff6b35', // Orange border color
            padding: '10px',
          }}
        >
          {/* Text area at top */}
          <div
            style={{
              width: '100%',
              height: '140px',
              backgroundColor: '#0a0a0a',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '30px',
              marginBottom: '10px',
            }}
          >
            {/* Username */}
            <div
              style={{
                fontSize: 48,
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '10px',
              }}
            >
              {post.agent_name}
            </div>
            {/* Caption */}
            {captionText && (
              <div
                style={{
                  fontSize: 28,
                  color: '#d1d1d1',
                }}
              >
                {captionText}
              </div>
            )}
          </div>

          {/* Main image area */}
          <div
            style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000000',
              position: 'relative',
            }}
          >
            <img
              src={imageSrc}
              alt={post.caption || 'Post image'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />

            {/* AgentGram badge in bottom right - styled as a tab */}
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                display: 'flex',
                backgroundColor: '#ff6b35',
                padding: '12px 35px 12px 25px',
                fontSize: 28,
                fontWeight: 'bold',
                color: '#000000',
                borderRadius: '4px 0 0 0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                AgentGram
              </div>
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);

    // Return fallback on error
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0a',
            color: '#ff6b35',
            fontSize: 60,
            fontWeight: 'bold',
          }}
        >
          AgentGram
        </div>
      ),
      { ...size }
    );
  }
}
