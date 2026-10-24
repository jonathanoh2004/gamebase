// The dice pyramid as a real CSS 3D object: four sloped faces over a square
// base. [data-pyramid-spin] idles with a slow sway; [data-pyramid] is what the
// roll animation shakes.

const SHADES = ['#d6b06f', '#b79058', '#987443', '#c7a161'];

export function Pyramid({ size = 168 }: { size?: number }) {
  const half = size / 2;
  const height = size * 0.74;
  const slant = Math.hypot(height, half);
  const tilt = (Math.atan(half / height) * 180) / Math.PI;
  return (
    <div
      style={{ width: size, height: height + 24, perspective: 900, perspectiveOrigin: '50% 30%' }}
      role="img"
      aria-label="Dice pyramid"
    >
      <div data-pyramid style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>
        <div
          data-pyramid-spin
          style={{
            position: 'relative',
            width: size,
            height: height + 24,
            transformStyle: 'preserve-3d',
            transform: 'rotateX(-16deg) rotateY(-24deg)',
          }}
        >
          {SHADES.map((shade, k) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the four fixed faces
              key={k}
              style={{
                position: 'absolute',
                left: 0,
                bottom: 24,
                width: size,
                height: slant,
                transformOrigin: '50% 100%',
                transform: `rotateY(${k * 90}deg) translateZ(${half}px) rotateX(${tilt}deg)`,
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
                background: shade,
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0 13px, rgba(42,33,23,0.22) 13px 14px)',
              }}
            >
              {k === 0 && (
                <span
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 0,
                    width: size * 0.16,
                    height: size * 0.2,
                    transform: 'translateX(-50%)',
                    background: '#3a2c1b',
                    clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0 100%)',
                  }}
                />
              )}
            </div>
          ))}
          {/* base / shadow */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 24 - half,
              width: size,
              height: size,
              // biome-ignore lint/security/noSecrets: a CSS transform, not a secret
              transform: 'rotateX(90deg)',
              transformOrigin: '50% 50%',
              background: 'rgba(0,0,0,0.35)',
              filter: 'blur(6px)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
