import React from 'react';

export type KidneyMood = 'idle' | 'happy' | 'inflamed' | 'trophy';

interface PixelKidneyProps {
  mood?: KidneyMood;
  size?: number;
  className?: string;
}

/**
 * 16x16 Pixel-Art Kidney Companion
 * - Completely static in 'idle' mode so it never distracts while reading clinical vignettes.
 * - Animates smoothly on 'happy', 'inflamed', or 'trophy' states.
 */
export const PixelKidneyMascot: React.FC<PixelKidneyProps> = ({
  mood = 'idle',
  size = 32,
  className = '',
}) => {
  const isInflamed = mood === 'inflamed';
  const isHappy = mood === 'happy' || mood === 'trophy';

  // Color palette tuned for high contrast in both light & dark modes
  const c = {
    outline: '#2D1B2E',
    body: isInflamed ? '#E05A5A' : '#D96B6B',
    shade: isInflamed ? '#B53838' : '#B54B4B',
    highlight: isInflamed ? '#F4978E' : '#F29B9B',
    ureter: '#E8B878',
    ureterShade: '#C7924E',
    eye: '#1E1420',
    blush: '#FF8FA3',
    sparkle: '#FACC15',
    bandage: '#F8FAFC',
    bandagePad: '#CBD5E1',
  };

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes pixel-bounce {
          0%, 100% { transform: translateY(0px); }
          35% { transform: translateY(-4px); }
          70% { transform: translateY(-1px); }
        }
        @keyframes pixel-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes pixel-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .animate-pixel-happy {
          animation: pixel-bounce 0.65s steps(4, end) 2;
        }
        .animate-pixel-inflamed {
          animation: pixel-wobble 0.45s steps(3, end) 2;
        }
        .animate-pixel-sparkle {
          animation: pixel-twinkle 0.8s steps(2, end) infinite;
        }
      `}</style>

      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        className={
          mood === 'happy' || mood === 'trophy'
            ? 'animate-pixel-happy'
            : mood === 'inflamed'
            ? 'animate-pixel-inflamed'
            : ''
        }
      >
        {/* Top & Bottom Bean Outline */}
        <rect x="5" y="1" width="5" height="1" fill={c.outline} />
        <rect x="4" y="2" width="1" height="1" fill={c.outline} />
        <rect x="10" y="2" width="1" height="1" fill={c.outline} />
        <rect x="3" y="3" width="1" height="2" fill={c.outline} />
        <rect x="11" y="3" width="1" height="3" fill={c.outline} />
        <rect x="2" y="5" width="1" height="6" fill={c.outline} />
        {/* Hilum Indentation */}
        <rect x="10" y="6" width="1" height="1" fill={c.outline} />
        <rect x="9" y="7" width="1" height="2" fill={c.outline} />
        <rect x="10" y="9" width="1" height="1" fill={c.outline} />
        <rect x="11" y="10" width="1" height="3" fill={c.outline} />
        <rect x="3" y="11" width="1" height="2" fill={c.outline} />
        <rect x="4" y="13" width="1" height="1" fill={c.outline} />
        <rect x="10" y="13" width="1" height="1" fill={c.outline} />
        <rect x="5" y="14" width="5" height="1" fill={c.outline} />

        {/* Kidney Main Fill */}
        <rect x="5" y="2" width="5" height="1" fill={c.body} />
        <rect x="4" y="3" width="7" height="2" fill={c.body} />
        <rect x="3" y="5" width="8" height="1" fill={c.body} />
        <rect x="3" y="6" width="7" height="1" fill={c.body} />
        <rect x="3" y="7" width="6" height="2" fill={c.body} />
        <rect x="3" y="9" width="7" height="1" fill={c.body} />
        <rect x="3" y="10" width="8" height="1" fill={c.body} />
        <rect x="4" y="11" width="7" height="2" fill={c.body} />
        <rect x="5" y="13" width="5" height="1" fill={c.body} />

        {/* Cortex Highlight (Top-Left) */}
        <rect x="5" y="3" width="3" height="1" fill={c.highlight} />
        <rect x="4" y="4" width="1" height="3" fill={c.highlight} />

        {/* Medulla Shading (Bottom-Right) */}
        <rect x="5" y="13" width="5" height="1" fill={c.shade} />
        <rect x="9" y="12" width="2" height="1" fill={c.shade} />
        <rect x="10" y="10" width="1" height="2" fill={c.shade} />

        {/* Ureter & Renal Pelvis */}
        <rect x="10" y="7" width="2" height="1" fill={c.ureter} />
        <rect x="11" y="8" width="2" height="1" fill={c.ureter} />
        <rect x="12" y="9" width="1" height="4" fill={c.ureter} />
        <rect x="13" y="9" width="1" height="4" fill={c.ureterShade} />

        {/* Facial Expressions */}
        {isHappy ? (
          <>
            {/* Happy ^ ^ Eyes */}
            <rect x="4" y="7" width="1" height="1" fill={c.eye} />
            <rect x="5" y="6" width="1" height="1" fill={c.eye} />
            <rect x="6" y="7" width="1" height="1" fill={c.eye} />

            <rect x="7" y="7" width="1" height="1" fill={c.eye} />
            <rect x="8" y="6" width="1" height="1" fill={c.eye} />
            <rect x="9" y="7" width="1" height="1" fill={c.eye} />

            {/* Rosy Cheeks & Smile */}
            <rect x="4" y="8" width="1" height="1" fill={c.blush} />
            <rect x="9" y="8" width="1" height="1" fill={c.blush} />
            <rect x="6" y="9" width="2" height="1" fill={c.eye} />
          </>
        ) : isInflamed ? (
          <>
            {/* Squinting > < Eyes */}
            <rect x="4" y="6" width="1" height="1" fill={c.eye} />
            <rect x="5" y="7" width="1" height="1" fill={c.eye} />
            <rect x="4" y="8" width="1" height="1" fill={c.eye} />

            <rect x="9" y="6" width="1" height="1" fill={c.eye} />
            <rect x="8" y="7" width="1" height="1" fill={c.eye} />
            <rect x="9" y="8" width="1" height="1" fill={c.eye} />

            {/* Wavy Frown */}
            <rect x="6" y="10" width="2" height="1" fill={c.eye} />
            <rect x="5" y="11" width="1" height="1" fill={c.eye} />
            <rect x="8" y="11" width="1" height="1" fill={c.eye} />

            {/* Tiny Pixel Bandage on Forehead */}
            <rect x="6" y="3" width="3" height="2" fill={c.bandage} />
            <rect x="7" y="3" width="1" height="2" fill={c.bandagePad} />
          </>
        ) : (
          <>
            {/* Calm Idle Eyes */}
            <rect x="5" y="7" width="1" height="2" fill={c.eye} />
            <rect x="8" y="7" width="1" height="2" fill={c.eye} />
            <rect x="6" y="10" width="2" height="1" fill={c.eye} />
          </>
        )}

        {/* Sparkles for Correct Answer / Trophy */}
        {isHappy && (
          <g className="animate-pixel-sparkle">
            <rect x="1" y="2" width="1" height="3" fill={c.sparkle} />
            <rect x="0" y="3" width="3" height="1" fill={c.sparkle} />
            <rect x="13" y="2" width="1" height="3" fill={c.sparkle} />
            <rect x="12" y="3" width="3" height="1" fill={c.sparkle} />
          </g>
        )}
      </svg>
    </div>
  );
};

/**
 * 12x12 Pixel Filtrate Droplet (for progress bars & streaks)
 */
export const PixelFiltrateDrop: React.FC<{ size?: number; active?: boolean }> = ({
  size = 16,
  active = false,
}) => (
  <svg
    viewBox="0 0 12 12"
    width={size}
    height={size}
    shapeRendering="crispEdges"
    className={`inline-block transition-transform duration-300 ${
      active ? 'scale-110' : 'opacity-80'
    }`}
    aria-hidden="true"
  >
    <rect x="5" y="1" width="2" height="2" fill="#38BDF8" />
    <rect x="4" y="3" width="4" height="2" fill="#38BDF8" />
    <rect x="3" y="5" width="6" height="4" fill="#0284C7" />
    <rect x="4" y="9" width="4" height="1" fill="#0284C7" />
    {/* Specular pixel highlight */}
    <rect x="4" y="5" width="1" height="2" fill="#BAE6FD" />
  </svg>
);

/**
 * 16x16 Pixel Pathology / Biopsy Slide (for empty states & clinical pearls)
 */
export const PixelBiopsySlide: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    shapeRendering="crispEdges"
    className="inline-block"
    aria-hidden="true"
  >
    {/* Glass Slide */}
    <rect x="1" y="4" width="14" height="8" fill="#E2E8F0" />
    <rect x="1" y="4" width="14" height="1" fill="#94A3B8" />
    <rect x="1" y="11" width="14" height="1" fill="#64748B" />
    {/* Frosted Label End */}
    <rect x="2" y="5" width="3" height="6" fill="#CBD5E1" />
    {/* Coverslip & Glomerular Sample */}
    <rect x="6" y="5" width="7" height="6" fill="#F8FAFC" />
    <rect x="8" y="7" width="3" height="2" fill="#EC4899" />
    <rect x="9" y="6" width="1" height="4" fill="#DB2777" />
  </svg>
);
