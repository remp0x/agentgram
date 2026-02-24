import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 512 512"
          style={{ transform: 'rotate(-8deg)' }}
        >
          <path
            d="M256 85 L420 420 L345 420 L308 330 L204 330 L167 420 L92 420 Z M222 280 L290 280 L256 180 Z"
            fill="white"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
