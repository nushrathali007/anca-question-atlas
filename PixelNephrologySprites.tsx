import React from 'react';

export type KidneyMood = 'idle' | 'happy' | 'inflamed' | 'trophy';

export interface PixelKidneyProps {
  mood?: KidneyMood;
  size?: number;
  className?: string;
}

export interface PixelFiltrateDropProps {
  size?: number;
  active?: boolean;
  className?: string;
}

export interface PixelBiopsySlideProps {
  size?: number;
  className?: string;
}

export interface PixelGlomerulusProps {
  size?: number;
  state?: 'healthy' | 'crescentic';
  className?: string;
}

export interface PixelANCAYAntibodyProps {
  size?: number;
  variant?: 'c-anca' | 'p-anca';
  className?: string;
}

export interface PixelMicroscopeProps {
  size?: number;
  active?: boolean;
  className?: string;
}

export interface PixelKidneyPairProps {
  size?: number;
  masteryPercent?: number;
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
        @keyframes pixel-halo-glint {
          0%, 100% { opacity: 0.85; transform: translateY(0px); }
          50% { opacity: 1; transform: translateY(-1px); }
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
        .pixel-hover-glint:hover .pixel-halo-group {
          animation: pixel-halo-glint 0.6s steps(3, end) 2;
        }
      `}</style>

      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        aria-hidden="true"
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
export const PixelFiltrateDrop: React.FC<PixelFiltrateDropProps> = ({
  size = 16,
  active = false,
  className = '',
}) => (
  <svg
    viewBox="0 0 12 12"
    width={size}
    height={size}
    shapeRendering="crispEdges"
    className={`inline-block transition-transform duration-300 ${
      active ? 'scale-110' : 'opacity-80'
    } ${className}`}
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
export const PixelBiopsySlide: React.FC<PixelBiopsySlideProps> = ({
  size = 32,
  className = '',
}) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    shapeRendering="crispEdges"
    className={`inline-block ${className}`}
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

/**
 * 1. 16x16 PixelGlomerulus
 * Coiled capillary tuft inside a Bowman's capsule ring.
 * - 'healthy': Crisp pink/coral capillary loops (#F29B9B / #D96B6B) inside a clean pale-blue capsule (#BAE6FD).
 * - 'crescentic': Adds a distinct yellow-amber cellular crescent (#FACC15 / #EAB308) compressing the tuft,
 *   visually nodding to ANCA pauci-immune crescentic glomerulonephritis.
 */
export const PixelGlomerulus: React.FC<PixelGlomerulusProps> = ({
  size = 16,
  state = 'healthy',
  className = '',
}) => {
  const isCrescentic = state === 'crescentic';
  const outline = '#2D1B2E';

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`inline-block select-none shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Bowman's Capsule Outer Outline (#2D1B2E) */}
      <rect x="5" y="1" width="6" height="1" fill={outline} />
      <rect x="3" y="2" width="2" height="1" fill={outline} />
      <rect x="11" y="2" width="2" height="1" fill={outline} />
      <rect x="2" y="3" width="1" height="2" fill={outline} />
      <rect x="13" y="3" width="1" height="2" fill={outline} />
      <rect x="1" y="5" width="1" height="6" fill={outline} />
      <rect x="14" y="5" width="1" height="6" fill={outline} />
      <rect x="2" y="11" width="1" height="2" fill={outline} />
      <rect x="13" y="11" width="1" height="2" fill={outline} />
      <rect x="3" y="13" width="3" height="1" fill={outline} />
      <rect x="10" y="13" width="3" height="1" fill={outline} />
      <rect x="5" y="14" width="1" height="1" fill={outline} />
      <rect x="10" y="14" width="1" height="1" fill={outline} />

      {/* Pale-Blue Bowman's Urinary Space (#BAE6FD) */}
      <rect x="5" y="2" width="6" height="1" fill="#BAE6FD" />
      <rect x="3" y="3" width="10" height="2" fill="#BAE6FD" />
      <rect x="2" y="5" width="12" height="6" fill="#BAE6FD" />
      <rect x="3" y="11" width="10" height="2" fill="#BAE6FD" />
      <rect x="6" y="13" width="4" height="1" fill="#BAE6FD" />
      {/* Specular Capsule Highlight */}
      <rect x="11" y="3" width="1" height="2" fill="#E0F2FE" />

      {isCrescentic ? (
        <>
          {/* Cellular Crescent (#FACC15 / #EAB308) Compressing the Glomerular Tuft */}
          <rect x="5" y="2" width="6" height="2" fill="#FACC15" />
          <rect x="3" y="3" width="3" height="3" fill="#FACC15" />
          <rect x="2" y="5" width="3" height="5" fill="#FACC15" />
          <rect x="3" y="10" width="2" height="2" fill="#EAB308" />
          <rect x="5" y="4" width="5" height="1" fill="#EAB308" />
          <rect x="4" y="5" width="2" height="3" fill="#EAB308" />
          <rect x="4" y="3" width="2" height="1" fill="#FEF08A" />

          {/* Compressed Capillary Tuft Shifted Lower-Right */}
          <rect x="7" y="6" width="5" height="5" fill="#D96B6B" />
          <rect x="6" y="7" width="6" height="4" fill="#D96B6B" />
          <rect x="8" y="6" width="3" height="1" fill="#F29B9B" />
          <rect x="7" y="8" width="2" height="2" fill="#F29B9B" />
          <rect x="9" y="9" width="2" height="2" fill="#B53838" />
        </>
      ) : (
        <>
          {/* Healthy Coiled Capillary Loops (#F29B9B / #D96B6B) */}
          <rect x="5" y="4" width="6" height="7" fill="#D96B6B" />
          <rect x="4" y="5" width="8" height="5" fill="#D96B6B" />
          {/* Loop Highlights (#F29B9B) */}
          <rect x="5" y="4" width="2" height="2" fill="#F29B9B" />
          <rect x="9" y="4" width="2" height="2" fill="#F29B9B" />
          <rect x="4" y="7" width="2" height="2" fill="#F29B9B" />
          <rect x="10" y="7" width="2" height="2" fill="#F29B9B" />
          {/* Capillary Lumen & Mesangial Core */}
          <rect x="7" y="5" width="2" height="1" fill="#BAE6FD" />
          <rect x="6" y="7" width="1" height="2" fill="#BAE6FD" />
          <rect x="9" y="7" width="1" height="2" fill="#BAE6FD" />
          <rect x="7" y="8" width="2" height="3" fill="#B54B4B" />
        </>
      )}

      {/* Afferent & Efferent Arterioles at Vascular Pole */}
      <rect x="6" y="11" width="1" height="4" fill="#D96B6B" />
      <rect x="9" y="11" width="1" height="4" fill="#B54B4B" />
    </svg>
  );
};

/**
 * 2. 16x16 PixelANCA_Y_Antibody
 * Crisp 16x16 Y-shaped IgG antibody pixel sprite:
 * - 'c-anca' (PR3): Warm coral/amber antigen-binding tips (#FB923C).
 * - 'p-anca' (MPO): Cool cyan/teal antigen-binding tips (#2DD4BF).
 */
export const PixelANCA_Y_Antibody: React.FC<PixelANCAYAntibodyProps> = ({
  size = 14,
  variant = 'c-anca',
  className = '',
}) => {
  const outline = '#2D1B2E';
  const tipMain = variant === 'p-anca' ? '#2DD4BF' : '#FB923C';
  const tipLight = variant === 'p-anca' ? '#99F6E4' : '#FDBA74';

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`inline-block select-none shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Left Fab Arm Outline & Fill */}
      <rect x="1" y="1" width="3" height="1" fill={outline} />
      <rect x="1" y="2" width="1" height="3" fill={outline} />
      <rect x="4" y="2" width="1" height="2" fill={outline} />
      <rect x="2" y="5" width="1" height="1" fill={outline} />
      <rect x="5" y="4" width="1" height="1" fill={outline} />
      <rect x="3" y="6" width="1" height="1" fill={outline} />
      <rect x="6" y="5" width="1" height="1" fill={outline} />
      <rect x="4" y="7" width="1" height="1" fill={outline} />

      {/* Right Fab Arm Outline */}
      <rect x="12" y="1" width="3" height="1" fill={outline} />
      <rect x="14" y="2" width="1" height="3" fill={outline} />
      <rect x="11" y="2" width="1" height="2" fill={outline} />
      <rect x="13" y="5" width="1" height="1" fill={outline} />
      <rect x="10" y="4" width="1" height="1" fill={outline} />
      <rect x="12" y="6" width="1" height="1" fill={outline} />
      <rect x="9" y="5" width="1" height="1" fill={outline} />
      <rect x="11" y="7" width="1" height="1" fill={outline} />

      {/* Central Hinge & Fc Stem Outline */}
      <rect x="7" y="6" width="2" height="1" fill={outline} />
      <rect x="5" y="8" width="1" height="6" fill={outline} />
      <rect x="10" y="8" width="1" height="6" fill={outline} />
      <rect x="6" y="14" width="4" height="1" fill={outline} />

      {/* Antigen-Binding Variable Tips (Fab Terminals) */}
      <rect x="2" y="2" width="2" height="2" fill={tipMain} />
      <rect x="2" y="2" width="1" height="1" fill={tipLight} />
      <rect x="12" y="2" width="2" height="2" fill={tipMain} />
      <rect x="12" y="2" width="1" height="1" fill={tipLight} />

      {/* Fab Arms & Fc Constant Stem Fill */}
      <rect x="3" y="4" width="2" height="2" fill="#CBD5E1" />
      <rect x="5" y="6" width="2" height="2" fill="#CBD5E1" />
      <rect x="11" y="4" width="2" height="2" fill="#CBD5E1" />
      <rect x="9" y="6" width="2" height="2" fill="#94A3B8" />
      <rect x="6" y="7" width="4" height="2" fill="#CBD5E1" />
      <rect x="6" y="9" width="2" height="5" fill="#E2E8F0" />
      <rect x="8" y="9" width="2" height="5" fill="#94A3B8" />
    </svg>
  );
};

/**
 * 3. 16x16 PixelMicroscope
 * Classic dark-slate (#334155 / #64748B) bench microscope with a glowing
 * cyan/emerald eyepiece & stage light (#38BDF8 / #34D399 when active={true}).
 */
export const PixelMicroscope: React.FC<PixelMicroscopeProps> = ({
  size = 16,
  active = false,
  className = '',
}) => {
  const outline = '#2D1B2E';
  const lensColor = active ? '#38BDF8' : '#94A3B8';
  const beamColor = active ? '#34D399' : '#64748B';

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`inline-block select-none shrink-0 transition-transform duration-200 ${
        active ? 'scale-105' : ''
      } ${className}`}
      aria-hidden="true"
    >
      {/* Eyepiece & Optical Tube */}
      <rect x="4" y="1" width="3" height="1" fill={outline} />
      <rect x="4" y="2" width="3" height="1" fill={lensColor} />
      <rect x="5" y="3" width="3" height="2" fill="#334155" />
      <rect x="6" y="3" width="1" height="2" fill="#64748B" />

      {/* Objective Turret & Lens */}
      <rect x="6" y="5" width="4" height="2" fill="#334155" />
      <rect x="6" y="7" width="2" height="2" fill="#64748B" />
      <rect x="6" y="9" width="2" height="1" fill={beamColor} />

      {/* Curved C-Arm Body (#334155 / #64748B) */}
      <rect x="10" y="5" width="2" height="2" fill="#64748B" />
      <rect x="11" y="7" width="2" height="5" fill="#334155" />
      <rect x="10" y="11" width="2" height="2" fill="#334155" />
      <rect x="12" y="7" width="1" height="4" fill="#64748B" />

      {/* Specimen Stage & Active Condenser Light */}
      <rect x="3" y="10" width="7" height="1" fill={outline} />
      <rect x="4" y="11" width="6" height="1" fill="#64748B" />
      {active && (
        <>
          <rect x="5" y="9" width="3" height="1" fill="#A7F3D0" />
          <rect x="6" y="12" width="2" height="1" fill="#34D399" />
        </>
      )}

      {/* Heavy Base & Outline */}
      <rect x="3" y="13" width="10" height="1" fill="#334155" />
      <rect x="2" y="14" width="12" height="1" fill={outline} />
    </svg>
  );
};

/**
 * 4. 16x16 PixelKidneyPair
 * Twin symmetrical 16x16 kidneys linked by a central aorta/vena cava pixel bridge
 * (#EF4444 / #3B82F6), with a subtle golden pixel halo above them when masteryPercent >= 80.
 */
export const PixelKidneyPair: React.FC<PixelKidneyPairProps> = ({
  size = 24,
  masteryPercent = 0,
  className = '',
}) => {
  const outline = '#2D1B2E';
  const showHalo = masteryPercent >= 80;

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`inline-block select-none shrink-0 pixel-hover-glint ${className}`}
      aria-hidden="true"
    >
      {/* Subtle Golden Pixel Halo when masteryPercent >= 80 */}
      {showHalo && (
        <g className="pixel-halo-group">
          <rect x="5" y="1" width="6" height="1" fill="#FACC15" />
          <rect x="4" y="2" width="1" height="1" fill="#FACC15" />
          <rect x="11" y="2" width="1" height="1" fill="#FACC15" />
          <rect x="6" y="1" width="3" height="1" fill="#FEF08A" />
        </g>
      )}

      {/* Left Kidney Outline & Fill */}
      <rect x="2" y="4" width="3" height="1" fill={outline} />
      <rect x="1" y="5" width="1" height="7" fill={outline} />
      <rect x="2" y="12" width="3" height="1" fill={outline} />
      <rect x="5" y="5" width="1" height="2" fill={outline} />
      <rect x="5" y="10" width="1" height="2" fill={outline} />
      <rect x="2" y="5" width="3" height="7" fill="#D96B6B" />
      <rect x="2" y="5" width="2" height="2" fill="#F29B9B" />
      <rect x="3" y="10" width="2" height="2" fill="#B54B4B" />

      {/* Right Kidney Outline & Fill */}
      <rect x="11" y="4" width="3" height="1" fill={outline} />
      <rect x="14" y="5" width="1" height="7" fill={outline} />
      <rect x="11" y="12" width="3" height="1" fill={outline} />
      <rect x="10" y="5" width="1" height="2" fill={outline} />
      <rect x="10" y="10" width="1" height="2" fill={outline} />
      <rect x="11" y="5" width="3" height="7" fill="#D96B6B" />
      <rect x="12" y="5" width="2" height="2" fill="#F29B9B" />
      <rect x="11" y="10" width="2" height="2" fill="#B54B4B" />

      {/* Central Aorta (#EF4444) & Vena Cava (#3B82F6) Pixel Bridge */}
      <rect x="7" y="4" width="1" height="9" fill="#EF4444" />
      <rect x="8" y="4" width="1" height="9" fill="#3B82F6" />
      <rect x="5" y="7" width="6" height="1" fill="#EF4444" />
      <rect x="5" y="8" width="6" height="1" fill="#3B82F6" />

      {/* Twin Ureters (#E8B878) */}
      <rect x="5" y="9" width="1" height="5" fill="#E8B878" />
      <rect x="10" y="9" width="1" height="5" fill="#E8B878" />
    </svg>
  );
};
