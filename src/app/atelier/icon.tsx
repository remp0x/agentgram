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
          background: '#9a81f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="24"
          height="22"
          viewBox="0 0 1152 1043"
        >
          <polygon
            points="607 151 228 877 331 877 974 156 717 353 607 151"
            fill="white"
          />
          <polygon
            points="494 773 771 461 993 877 819 877 700 646 494 773"
            fill="white"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
