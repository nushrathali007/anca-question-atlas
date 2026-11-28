import React, { useState, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { SearchToolbar } from './SearchToolbar'
import { questionFields, migrateAnswerOrder } from './fields'
import { seed, sources, topics } from './seed'
import {
  PixelKidneyMascot,
  PixelFiltrateDrop,
  PixelBiopsySlide,
  PixelGlomerulus,
  PixelANCA_Y_Antibody,
  PixelMicroscope,
  PixelKidneyPair,
} from './PixelNephrologySprites'
import {
  StatsBand,
  WaffleUnitChart,
  VasculitisDomainRadar,
  CommandMenuModal,
  MasteryAtlasDrawer,
  computeSixAxisVasculitisMetrics,
} from './Atlas21stComponents'

type Q = typeof seed[number] & {
  disease?: string
}

// Exact 8 Vasculitis Question Targets from GitHub bank.json
const VASCULITIS_TARGETS = [
  'Treatment selection',
  'Dosing & timing',
  'Evidence interpretation',
  'Endpoint definitions',
  'Trial applicability',
  'Disease assessment',
  'Diagnostic reasoning',
  'Safety & monitoring',
]

// Exact 12 Vasculitis Guidelines & Clinical Trials from GitHub bank.json
const VASCULITIS_SOURCES = [
  'KDIGO 2024',
  'RAVE',
  'IMPROVE',
  'RITUXVAS',
  'NORAM',
  'WEGENT',
  'CYCAZAREM',
  'CYCLOPS',
  'MYCYC',
  'PEXIVAS',
  'LoVAS',
  'MAINRITSAN',
]

// ANCA-Associated Vasculitis Clinical Domains (KDIGO 2024 + 11 Landmark Trials)
// Preserves 100% ANCA-associated vasculitis focus without non-ANCA placeholders
const GLOMERULAR_MODULES = [
  {
    id: 'ANCA-Associated Vasculitis',
    shortName: 'All ANCA Vasculitis',
    active: true,
    description: 'Complete 228-question library spanning KDIGO 2024 guideline recommendations and 11 landmark ANCA vasculitis clinical trials',
    plannedTargets: VASCULITIS_TARGETS,
    plannedSources: VASCULITIS_SOURCES,
  },
  {
    id: 'KDIGO 2024 ANCA Guideline',
    shortName: 'KDIGO 2024 Guideline',
    active: true,
    description: 'Diagnostic workup, kidney biopsy indications, avacopan C5aR inhibition, glucocorticoid taper, and plasma exchange criteria',
    plannedTargets: [
      'Diagnostic reasoning',
      'Treatment selection',
      'Dosing & timing',
      'Disease assessment',
      'Safety & monitoring',
    ],
    plannedSources: ['KDIGO 2024'],
  },
  {
    id: 'Induction Therapy Trials',
    shortName: 'Induction Trials',
    active: true,
    description: 'Rituximab vs cyclophosphamide, reduced-dose steroid regimens, mycophenolate mofetil, and plasma exchange in severe AAV',
    plannedTargets: [
      'Treatment selection',
      'Evidence interpretation',
      'Endpoint definitions',
      'Trial applicability',
      'Dosing & timing',
      'Safety & monitoring',
    ],
    plannedSources: ['RAVE', 'PEXIVAS', 'RITUXVAS', 'CYCLOPS', 'MYCYC', 'LoVAS', 'NORAM'],
  },
  {
    id: 'Maintenance & Relapse Trials',
    shortName: 'Maintenance Trials',
    active: true,
    description: 'Remission maintenance with rituximab vs azathioprine, methotrexate, or mycophenolate and relapse prevention strategies',
    plannedTargets: [
      'Treatment selection',
      'Dosing & timing',
      'Evidence interpretation',
      'Endpoint definitions',
      'Disease assessment',
      'Safety & monitoring',
    ],
    plannedSources: ['MAINRITSAN', 'IMPROVE', 'WEGENT', 'CYCAZAREM'],
  },
]

const statuses = ['Finalized', 'Draft', 'In review', 'Verified']

const DEFAULT_NEW_QUESTION_TEMPLATE = `A 62-year-old patient presents with rapidly progressive glomerulonephritis and positive ANCA serology.
Which of the following is the most appropriate next management step?
A. First option choice
B. Second option choice
C. Third option choice
D. Fourth option choice
E. Fifth option choice
PART B - Correct Answer
Correct Answer: A. First option choice
PART C - Explanation
Provide detailed guideline or clinical trial rationale supporting the correct answer.`

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * Extracts the correct option letter ('A'–'E') from a question's full text,
 * as well as an incorrect letter so we can deterministically seed the 85% Correct / 10% Wrong / 5% Flagged baseline.
 */
function getQuestionAnswerKeys(fullText: string): { correctLetter: string; wrongLetter: string } {
  const fields = questionFields(fullText)
  if (!fields.length) return { correctLetter: 'A', wrongLetter: 'B' }
  const answer = fields[6].value.trim().replace(/^Correct Answer:\s*/i, '')
  const key = answer.match(/^(?:Correct Answer:\s*)?([A-E])(?:[.)\s]|$)/i)?.[1]?.toUpperCase() || 'A'
  const wrongLetter = key === 'A' ? 'B' : 'A'
  return { correctLetter: key, wrongLetter }
}

/**
 * Randomized Data Initialization Script:
 * Populates the 228 questions with randomized statistics reflecting a real-world usage scenario:
 * - ~85% Correct (194 questions = 85.1%)
 * - ~10% Incorrect (23 questions = 10.1%)
 * - ~5% Flagged for review (11 questions = 4.8%)
 * Shuffles questions within each sub-topic using a Fisher-Yates shuffle and distributes accuracy
 * so weak areas fall strictly below 60% correctness for the Study Plan Logic and Radar Chart:
 *   Weak Areas (< 60%):
 *   1. Safety & monitoring (10 QS): 4 Correct, 4 Wrong, 2 Flagged -> 40% Correctness (< 60%)
 *   2. Diagnostic reasoning (11 QS): 5 Correct, 5 Wrong, 1 Flagged -> 45% Correctness (< 60%)
 *   3. Disease assessment (14 QS): 8 Correct, 5 Wrong, 1 Flagged -> 57% Correctness (< 60%)
 *   Moderate / Needs Review (60–79%):
 *   4. Trial applicability (16 QS): 11 Correct, 4 Wrong, 1 Flagged -> 69% Correctness
 *   Strong Areas (>= 80%):
 *   5. Endpoint definitions (19 QS): 16 Correct, 1 Wrong, 2 Flagged -> 84% Correctness
 *   6. Evidence interpretation (41 QS): 37 Correct, 2 Wrong, 2 Flagged -> 90% Correctness
 *   7. Dosing & timing (54 QS): 51 Correct, 1 Wrong, 2 Flagged -> 94% Correctness
 *   8. Treatment selection (63 QS): 62 Correct, 1 Wrong, 0 Flagged -> 98% Correctness
 */
function buildPopulatedBaselineStats(allQuestions: Q[]) {
  const quotasByTarget: Record<string, { correct: number; wrong: number; flagged: number }> = {
    'Safety & monitoring': { correct: 4, wrong: 4, flagged: 2 },
    'Diagnostic reasoning': { correct: 5, wrong: 5, flagged: 1 },
    'Disease assessment': { correct: 8, wrong: 5, flagged: 1 },
    'Trial applicability': { correct: 11, wrong: 4, flagged: 1 },
    'Endpoint definitions': { correct: 16, wrong: 1, flagged: 2 },
    'Evidence interpretation': { correct: 37, wrong: 2, flagged: 2 },
    'Dosing & timing': { correct: 51, wrong: 1, flagged: 2 },
    'Treatment selection': { correct: 62, wrong: 1, flagged: 0 },
  }

  const seededAttempts: Record<number, { choice: string; correct: boolean }> = {}
  const seededFlags: number[] = []
  const seededNotes: Record<number, string> = {}

  const byTarget: Record<string, Q[]> = {}
  for (const q of allQuestions) {
    const t = q.target || 'Treatment selection'
    if (!byTarget[t]) byTarget[t] = []
    byTarget[t].push(q)
  }

  for (const [targetName, rawList] of Object.entries(byTarget)) {
    // Fisher-Yates shuffle to randomize which questions in each sub-topic are marked correct, incorrect, or flagged
    const list = [...rawList]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = list[i]
      list[i] = list[j]
      list[j] = temp
    }

    const quota = quotasByTarget[targetName] || {
      correct: Math.round(list.length * 0.85),
      wrong: Math.round(list.length * 0.1),
      flagged: Math.max(0, list.length - Math.round(list.length * 0.85) - Math.round(list.length * 0.1)),
    }

    list.forEach((q, idx) => {
      const { correctLetter, wrongLetter } = getQuestionAnswerKeys(q.full)
      if (idx < quota.wrong) {
        seededAttempts[q.id] = { choice: wrongLetter, correct: false }
        if (
          idx === 0 &&
          (targetName === 'Safety & monitoring' ||
            targetName === 'Diagnostic reasoning' ||
            targetName === 'Disease assessment' ||
            targetName === 'Trial applicability')
        ) {
          seededNotes[q.id] = `High-yield weak area (${targetName} · ${q.source}): Review criteria and guideline threshold before next timed block.`
        }
      } else if (idx < quota.wrong + quota.flagged) {
        // Flagged for review (~5% of bank = 11 questions)
        seededFlags.push(q.id)
        if (idx === quota.wrong && (targetName === 'Safety & monitoring' || targetName === 'Endpoint definitions')) {
          seededNotes[q.id] = `Flagged during review (${q.source}): Double-check protocol definition and steroid tapering schedule.`
        }
      } else {
        // Correct (~85% of bank = 194 questions)
        seededAttempts[q.id] = { choice: correctLetter, correct: true }
      }
    })
  }

  return { seededAttempts, seededFlags, seededNotes }
}

/**
 * Generates a smooth, rounded-corner annular pie sector (donut wedge) along an upper semicircle
 * (where 180° is left, 90° is top, and 0° is right).
 */
function createRoundedAnnularWedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
  cornerRadius = 7
): string {
  const span = Math.max(2, startDeg - endDeg)
  const cr = Math.min(cornerRadius, (rOuter - rInner) / 2.4)
  const degOffsetOuter = Math.min(span / 3.2, (cr / rOuter) * (180 / Math.PI))
  const degOffsetInner = Math.min(span / 3.2, (cr / rInner) * (180 / Math.PI))

  const pt = (deg: number, r: number): [number, number] => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)]
  }

  const [cOuterStartX, cOuterStartY] = pt(startDeg, rOuter)
  const [cOuterEndX, cOuterEndY] = pt(endDeg, rOuter)
  const [cInnerEndX, cInnerEndY] = pt(endDeg, rInner)
  const [cInnerStartX, cInnerStartY] = pt(startDeg, rInner)

  const [p1x, p1y] = pt(startDeg, rOuter - cr)
  const [p2x, p2y] = pt(startDeg - degOffsetOuter, rOuter)
  const [p3x, p3y] = pt(endDeg + degOffsetOuter, rOuter)
  const [p4x, p4y] = pt(endDeg, rOuter - cr)
  const [p5x, p5y] = pt(endDeg, rInner + cr)
  const [p6x, p6y] = pt(endDeg + degOffsetInner, rInner)
  const [p7x, p7y] = pt(startDeg - degOffsetInner, rInner)
  const [p8x, p8y] = pt(startDeg, rInner + cr)

  const largeArcOuter = startDeg - degOffsetOuter - (endDeg + degOffsetOuter) > 180 ? 1 : 0
  const largeArcInner = startDeg - degOffsetInner - (endDeg + degOffsetInner) > 180 ? 1 : 0

  return [
    `M ${p1x.toFixed(2)} ${p1y.toFixed(2)}`,
    `Q ${cOuterStartX.toFixed(2)} ${cOuterStartY.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcOuter} 1 ${p3x.toFixed(2)} ${p3y.toFixed(2)}`,
    `Q ${cOuterEndX.toFixed(2)} ${cOuterEndY.toFixed(2)} ${p4x.toFixed(2)} ${p4y.toFixed(2)}`,
    `L ${p5x.toFixed(2)} ${p5y.toFixed(2)}`,
    `Q ${cInnerEndX.toFixed(2)} ${cInnerEndY.toFixed(2)} ${p6x.toFixed(2)} ${p6y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArcInner} 0 ${p7x.toFixed(2)} ${p7y.toFixed(2)}`,
    `Q ${cInnerStartX.toFixed(2)} ${cInnerStartY.toFixed(2)} ${p8x.toFixed(2)} ${p8y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function BarcodeTicks({ total = 22, filled, tone }: { total?: number; filled: number; tone: 'green' | 'blue' | 'amber' }) {
  return (
    <div className="barcodeStrip" aria-hidden="true">
      {Array.from({ length: total }).map((_, idx) => (
        <span key={idx} className={`barcodeTick ${idx < filled ? tone : ''}`} />
      ))}
    </div>
  )
}

function StatusBadgeTriple({ labels, palette }: { labels: [string, string, string]; palette: [string, string, string] }) {
  return (
    <div className="avatarStack" aria-hidden="true">
      {palette.map((bg, i) => (
        <span key={i} style={{ backgroundColor: bg }}>
          {labels[i]}
        </span>
      ))}
    </div>
  )
}

export type SubtopicMetric = {
  name: string
  shortLabel: string
  total: number
  attempted: number
  correct: number
  wrong: number
  flagged: number
  unused: number
  accuracy: number
}

/**
 * Subject-wise Performance Dashboard Component:
 * Visualizes correctness rates (%) for each vasculitis sub-topic using an SVG Radar Chart
 * alongside an interactive sub-topic breakdown list showing Weak Areas vs Strong Areas.
 */
function SubjectWisePerformanceRadar({
  metrics,
  radarDimension,
  onChangeDimension,
  onSelectSubtopic,
  onOpenStudyPlan,
  onOpenStudyPlanLogic,
}: {
  metrics: SubtopicMetric[]
  radarDimension: 'target' | 'source'
  onChangeDimension: (dim: 'target' | 'source') => void
  onSelectSubtopic: (name: string) => void
  onOpenStudyPlan?: () => void
  onOpenStudyPlanLogic?: () => void
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const cx = 210
  const cy = 156
  const maxR = 80
  const levels = [25, 50, 75, 100]
  const count = metrics.length || 1

  const getPoint = (idx: number, pct: number): [number, number] => {
    const angleDeg = -90 + (idx * 360) / count
    const rad = (angleDeg * Math.PI) / 180
    const r = (Math.max(0, Math.min(100, pct)) / 100) * maxR
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }

  const dataPolygonPoints = metrics
    .map((m, idx) => {
      const visualPct = m.total > 0 ? Math.max(8, m.accuracy) : 6
      const [x, y] = getPoint(idx, visualPct)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const activeMetric = hoveredIdx !== null ? metrics[hoveredIdx] : null

  return (
    <section className="dashboardCard" style={{ marginBottom: 20 }} aria-label="Subject-wise Performance Radar Chart">
      <div className="cardHeaderRow" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="cardTitle">Subject-wise Performance · Weak vs. Strong Sub-Topic Radar</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Correctness rates (%) across each sub-topic. Red vertices highlight weak areas (&lt;60% accuracy); emerald vertices indicate strong mastery (&ge;80%).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="seg" style={{ marginBottom: 0, padding: 3 }}>
            <button
              type="button"
              style={{ padding: '5px 12px', fontSize: 12 }}
              aria-pressed={radarDimension === 'target'}
              onClick={() => onChangeDimension('target')}
            >
              8 Vasculitis Sub-Topics
            </button>
            <button
              type="button"
              style={{ padding: '5px 12px', fontSize: 12 }}
              aria-pressed={radarDimension === 'source'}
              onClick={() => onChangeDimension('source')}
            >
              Landmark Trials &amp; KDIGO
            </button>
          </div>

          {onOpenStudyPlanLogic && (
            <button type="button" className="secondaryPillBtn" onClick={onOpenStudyPlanLogic}>
              <span>ℹ</span>
              <span>Study Plan Logic</span>
            </button>
          )}

          {onOpenStudyPlan && (
            <button type="button" className="studyPlanBtn" onClick={onOpenStudyPlan}>
              <span>✦</span>
              <span>Create Study Plan</span>
            </button>
          )}
        </div>
      </div>

      <div className="radarPerformanceGrid">
        {/* Left: SVG Radar Chart — generous internal margin around maxR=80 inside 420x312 viewBox guarantees zero label clipping on mobile */}
        <div className="radarSvgWrap">
          <svg className="radarSvg" viewBox="0 0 420 312" aria-label="Vasculitis sub-topic accuracy radar chart">
            {/* Concentric Octagonal Grid Rings (25%, 50%, 75%, 100%) */}
            {levels.map((lvl) => {
              const ringPts = metrics
                .map((_, idx) => {
                  const [x, y] = getPoint(idx, lvl)
                  return `${x.toFixed(1)},${y.toFixed(1)}`
                })
                .join(' ')
              return (
                <g key={lvl}>
                  <polygon
                    points={ringPts}
                    fill={lvl === 100 ? 'rgba(235, 245, 239, 0.35)' : 'none'}
                    stroke="#d7e2da"
                    strokeWidth={lvl === 100 ? '1.4' : '1'}
                    strokeDasharray={lvl === 50 || lvl === 100 ? undefined : '3 3'}
                  />
                  <text
                    x={cx + 5}
                    y={cy - (lvl / 100) * maxR + 10}
                    fontSize="9"
                    fill="#7e8881"
                    fontWeight="600"
                  >
                    {lvl}%
                  </text>
                </g>
              )
            })}

            {/* Axis Spokes & Outer Sub-Topic Labels */}
            {metrics.map((m, idx) => {
              const [endX, endY] = getPoint(idx, 100)
              const [labelX, labelY] = getPoint(idx, 118)
              const angleDeg = -90 + (idx * 360) / count
              const cosVal = Math.cos((angleDeg * Math.PI) / 180)
              const textAnchor = Math.abs(cosVal) < 0.22 ? 'middle' : cosVal > 0 ? 'start' : 'end'
              const isHovered = hoveredIdx === idx
              const isWeak = m.accuracy < 60

              return (
                <g key={m.name}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={endX}
                    y2={endY}
                    stroke={isHovered ? '#19b368' : '#d2ded6'}
                    strokeWidth={isHovered ? '2' : '1.1'}
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fontSize="10.5"
                    fontWeight={isHovered ? '700' : '600'}
                    fill={isHovered ? 'var(--emerald)' : isWeak ? 'var(--coral)' : 'var(--text-primary)'}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectSubtopic(m.name)}
                  >
                    {m.shortLabel} ({m.accuracy}%)
                  </text>
                </g>
              )
            })}

            {/* Primary Polygon: Correctness Rate (%) */}
            <polygon
              points={dataPolygonPoints}
              fill="rgba(25, 179, 104, 0.24)"
              stroke="#19b368"
              strokeWidth="2.4"
            />

            {/* Interactive Vertices for each Sub-Topic */}
            {metrics.map((m, idx) => {
              const visualPct = m.total > 0 ? Math.max(8, m.accuracy) : 6
              const [vx, vy] = getPoint(idx, visualPct)
              const isHovered = hoveredIdx === idx
              const vertexColor = m.accuracy >= 80 ? '#19b368' : m.accuracy >= 60 ? '#f7a61c' : '#ea582c'
              return (
                <circle
                  key={m.name}
                  cx={vx}
                  cy={vy}
                  r={isHovered ? 6 : 4.5}
                  fill={vertexColor}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="radarVertex"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectSubtopic(m.name)}
                >
                  <title>{`${m.name}: ${m.accuracy}% Correct (${m.correct} Correct · ${m.wrong} Wrong · ${m.flagged} Flagged)`}</title>
                </circle>
              )
            })}
          </svg>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--border-inner)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="legendItem">
                <i className="legendSwatch" style={{ background: '#19b368' }} />
                <span>Strong (&ge;80%)</span>
              </span>
              <span className="legendItem">
                <i className="legendSwatch" style={{ background: '#f7a61c' }} />
                <span>Needs Review (60–79%)</span>
              </span>
              <span className="legendItem">
                <i className="legendSwatch" style={{ background: '#ea582c' }} />
                <span>Weak Area (&lt;60%)</span>
              </span>
            </div>
            <span>
              {activeMetric
                ? `${activeMetric.name}: ${activeMetric.accuracy}% (${activeMetric.correct} Correct, ${activeMetric.wrong} Wrong, ${activeMetric.flagged} Flagged)`
                : 'Tap any sub-topic to practice'}
            </span>
          </div>
        </div>

        {/* Right: Sub-Topic Correctness Rate & Weakest Area Breakdown (Sorted Weakest -> Strongest) */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <span>SUB-TOPIC (WEAKEST TO STRONGEST)</span>
            <span>CORRECTNESS RATE</span>
          </div>

          <div className="subjectAccuracyList">
            {[...metrics]
              .sort((a, b) => a.accuracy - b.accuracy)
              .map((m) => {
                const origIdx = metrics.findIndex((item) => item.name === m.name)
                const barColor = m.accuracy >= 80 ? '#19b368' : m.accuracy >= 60 ? '#f7a61c' : '#ea582c'
                const tierLabel = m.accuracy >= 80 ? 'Strong Area' : m.accuracy >= 60 ? 'Moderate / Needs Review' : 'Weak Area'

                return (
                  <div
                    key={m.name}
                    className="subjectAccuracyRow"
                    onMouseEnter={() => setHoveredIdx(origIdx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectSubtopic(m.name)}
                    style={{
                      cursor: 'pointer',
                      borderColor: hoveredIdx === origIdx ? '#19b368' : undefined,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{m.name}</span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '1px 7px',
                            borderRadius: 999,
                            background: m.accuracy >= 80 ? 'var(--emerald-soft)' : m.accuracy >= 60 ? 'var(--amber-soft)' : 'var(--coral-soft)',
                            color: m.accuracy >= 80 ? 'var(--emerald)' : m.accuracy >= 60 ? 'var(--amber)' : 'var(--coral)',
                          }}
                        >
                          {tierLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {m.correct} Correct · {m.wrong} Wrong · {m.flagged} Flagged of {m.total} QS
                      </div>
                    </div>

                    <div className="subjectBarTrack" aria-hidden="true">
                      <div
                        className="subjectBarFill"
                        style={{
                          width: `${Math.max(8, m.accuracy)}%`,
                          background: barColor,
                        }}
                      />
                    </div>

                    <div style={{ textAlign: 'right', minWidth: 68 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: barColor,
                        }}
                      >
                        {m.accuracy}%
                      </span>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{m.correct}/{m.total} Correct</div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Focus Timer component for Active Timed Exam Sessions:
 * Shown ONLY in Timed Mode.
 */
function FocusTimer({
  questionId,
  questionNumber,
  elapsedMap,
  setElapsedMap,
  recommendedSeconds,
  isFlagged,
  onToggleFlag,
  onNextQuestion,
  hasNextQuestion,
}: {
  questionId: number
  questionNumber: number
  elapsedMap: Record<number, number>
  setElapsedMap: React.Dispatch<React.SetStateAction<Record<number, number>>>
  recommendedSeconds: number
  isFlagged: boolean
  onToggleFlag: (qId: number) => void
  onNextQuestion: () => void
  hasNextQuestion: boolean
}) {
  const [paused, setPaused] = useState(false)
  const currentSeconds = elapsedMap[questionId] || 0
  const totalBlockSeconds = useMemo(
    () => Object.values(elapsedMap).reduce((acc, s) => acc + s, 0),
    [elapsedMap]
  )
  const exceeded = currentSeconds > recommendedSeconds
  const overageSeconds = Math.max(0, currentSeconds - recommendedSeconds)
  const progressPct = Math.min(100, Math.round((currentSeconds / Math.max(1, recommendedSeconds)) * 100))

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      setElapsedMap((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || 0) + 1,
      }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [questionId, paused, setElapsedMap])

  return (
    <div className="focusTimerBar" data-exceeded={exceeded}>
      <div className="focusTimerMetrics">
        <div className="focusTimerClock">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          <span>
            Q{questionNumber} Time: {formatDuration(currentSeconds)} / {formatDuration(recommendedSeconds)}
          </span>
        </div>

        <div className="focusTimerTrack" aria-hidden="true">
          <div className="focusTimerFill" style={{ width: `${progressPct}%` }} />
        </div>

        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          Total Block Time: <strong>{formatDuration(totalBlockSeconds)}</strong>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
          Pace: {recommendedSeconds}s/Q
        </span>
        <button
          type="button"
          className="qcardSolveBtn"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {exceeded && (
        <div className="focusTimerAlert" role="alert">
          <span>
            Pace Alert: You have exceeded the {formatDuration(recommendedSeconds)} target pace for this
            question by +{formatDuration(overageSeconds)}.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFlagged && (
              <button
                type="button"
                className="flagToggleBtn"
                onClick={() => onToggleFlag(questionId)}
              >
                ★ Flag for Review
              </button>
            )}
            {hasNextQuestion && (
              <button
                type="button"
                className="qcardSolveBtn"
                onClick={onNextQuestion}
              >
                Skip to Next Question →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Reader({
  question,
  savedChoice,
  isFlagged,
  hasNote,
  examMode = 'Tutor',
  isReviewMode = false,
  showCompanionIcons = true,
  questionNumberLabel,
  peerAccuracyRate,
  elapsedSeconds,
  onOpenNoteModal,
  onToggleFlag,
  onPickChoice,
}: {
  question: Q
  savedChoice?: string
  isFlagged?: boolean
  hasNote?: boolean
  examMode?: 'Tutor' | 'Timed'
  isReviewMode?: boolean
  showCompanionIcons?: boolean
  questionNumberLabel?: string
  peerAccuracyRate?: number
  elapsedSeconds?: number
  onOpenNoteModal?: () => void
  onToggleFlag?: (qId: number) => void
  onPickChoice?: (qId: number, letter: string, isCorrect: boolean) => void
}) {
  const [picked, setPicked] = useState(savedChoice || '')
  const [showMetaFooter, setShowMetaFooter] = useState(false)
  const [showPearlsDrawer, setShowPearlsDrawer] = useState(false)

  const fields = questionFields(question.full)

  // Sync with savedChoice for the current block/session
  useEffect(() => {
    setPicked(savedChoice || '')
    setShowPearlsDrawer(false)
  }, [question.id, savedChoice, examMode, isReviewMode])

  const answer = fields.length ? fields[6].value.trim().replace(/^Correct Answer:\s*/i, '') : ''
  const key = answer.match(/^(?:Correct Answer:\s*)?([A-E])(?:[.)\s]|$)/i)?.[1]?.toUpperCase() || 'A'
  const explanationText = fields.length ? fields[7].value.trim() : ''

  const isTimedActive = examMode === 'Timed' && !isReviewMode
  const showResultAndExplanation = isReviewMode || (examMode === 'Tutor' && Boolean(picked))
  const isChoiceLocked = isReviewMode || (examMode === 'Tutor' && Boolean(picked))

  // Keyboard shortcuts: 1-5 or A-E to answer when question is active and unlocked
  useEffect(() => {
    if (!fields.length || isChoiceLocked) return
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const upper = e.key.toUpperCase()
      let chosenLetter = ''
      if (['A', 'B', 'C', 'D', 'E'].includes(upper)) {
        chosenLetter = upper
      } else if (['1', '2', '3', '4', '5'].includes(upper)) {
        chosenLetter = 'ABCDE'[parseInt(upper, 10) - 1] || ''
      }
      if (chosenLetter) {
        e.preventDefault()
        setPicked(chosenLetter)
        if (onPickChoice) {
          onPickChoice(question.id, chosenLetter, chosenLetter === key)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fields.length, isChoiceLocked, question.id, key, onPickChoice])

  if (!fields.length) {
    return (
      <article className="reader animateQuestionSlide">
        <p>{question.full}</p>
      </article>
    )
  }

  const questionCode = question.title.split(' · ')[0] || `Q${String(question.id).padStart(3, '0')}`

  return (
    <article className="reader animateQuestionSlide" key={question.id}>
      {/* ====================================================================
          FOCAL POINT 1: Concise Metadata Header (Question # + 1 Subtle Topic)
         ==================================================================== */}
      <header className="cleanReaderHeader">
        <div className="cleanReaderMetaLeft">
          <span className="cleanReaderQNum">{questionNumberLabel || questionCode}</span>
          <span className="cleanReaderMetaDivider" aria-hidden="true">·</span>
          <span className="cleanReaderSubtleTopic">{question.target || question.topic}</span>
        </div>

        <div className="cleanReaderActionsRight">
          {onOpenNoteModal && (
            <button
              type="button"
              className="noteBadgeBtn"
              onClick={onOpenNoteModal}
              title="Open personal study notes for this question"
            >
              <span>📝 {hasNote ? 'Note' : '+ Note'}</span>
            </button>
          )}

          {onToggleFlag && (
            <button
              type="button"
              className="flagToggleBtn"
              aria-pressed={Boolean(isFlagged)}
              onClick={() => onToggleFlag(question.id)}
              title="Flag question for review"
            >
              <span aria-hidden="true">{isFlagged ? '★' : '☆'}</span>
              <span>{isFlagged ? 'Flagged' : 'Flag'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ====================================================================
          FOCAL POINT 2: 100% Verbatim Clinical Stem / Vignette
         ==================================================================== */}
      <div className="clinicalVignetteProse">
        <p>{fields[0].value}</p>
      </div>

      {/* ====================================================================
          FOCAL POINT 3: Left-Aligned Answer Option Rows (with 1-5 / A-E Shortcuts)
         ==================================================================== */}
      <ol className="quizChoices" aria-label="Answer choices">
        {fields.slice(1, 6).map((field, i) => {
          const letter = 'ABCDE'[i]
          const isPickedLetter = picked === letter
          const result =
            showResultAndExplanation && key
              ? letter === key
                ? 'Correct'
                : isPickedLetter
                ? 'Incorrect'
                : ''
              : ''

          const badgeLabel = showResultAndExplanation
            ? result
              ? isPickedLetter && result === 'Correct'
                ? '✓ Correct'
                : isPickedLetter && result === 'Incorrect'
                ? '✕ Your Choice'
                : '✓ Correct Answer'
              : ''
            : isTimedActive && isPickedLetter
            ? 'Selected'
            : ''

          return (
            <li key={letter}>
              <button
                type="button"
                data-result={result || undefined}
                data-selected={isTimedActive && isPickedLetter ? 'true' : undefined}
                data-locked={isChoiceLocked ? 'true' : undefined}
                disabled={isChoiceLocked}
                aria-pressed={isPickedLetter}
                onClick={() => {
                  if (isChoiceLocked) return
                  setPicked(letter)
                  if (onPickChoice) {
                    onPickChoice(question.id, letter, key ? letter === key : false)
                  }
                }}
              >
                <div className="choiceOptionLeft">
                  <strong className="choiceLetterBadge" title={`Keyboard shortcut: ${letter} or ${i + 1}`}>
                    {letter}.
                  </strong>
                  <span className="choiceOptionText">{field.value}</span>
                </div>
                {badgeLabel && (
                  <b
                    className="choiceStatusTag"
                    data-tone={
                      result === 'Correct'
                        ? 'correct'
                        : result === 'Incorrect'
                        ? 'incorrect'
                        : 'neutral'
                    }
                  >
                    {badgeLabel}
                  </b>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {/* ====================================================================
          SINGLE UNIFIED EXPLANATION (100% Verbatim from Question Bank)
          Shows the complete Correct Answer and full Explanation in one go
          without splitting into "Why Option Fits" and "Why Other Options Are Wrong"
         ==================================================================== */}
      {isTimedActive ? (
        <div className="examModeInlineNotice" data-mode="timed">
          {picked ? (
            <span>
              <strong>Option {picked} Recorded:</strong> Answers and explanations remain hidden during active Timed Mode.
              Use <strong>Next Question →</strong> (or <kbd className="kbdHint">→</kbd>) to continue.
            </span>
          ) : (
            <span>
              <strong>Timed Mode:</strong> Select an option (<kbd className="kbdHint">A</kbd>–<kbd className="kbdHint">E</kbd> or{' '}
              <kbd className="kbdHint">1</kbd>–<kbd className="kbdHint">5</kbd>), then press <strong>Next Question →</strong>.
            </span>
          )}
        </div>
      ) : showResultAndExplanation ? (
        <div className="explanationBox animateQuestionSlide" aria-live="polite">
          <div
            className="readerResultStatusBanner"
            data-status={!picked ? 'unanswered' : picked === key ? 'correct' : 'incorrect'}
          >
            {showCompanionIcons && Boolean(picked) && (
              <PixelKidneyMascot
                size={32}
                mood={picked === key ? 'happy' : 'inflamed'}
                className="feedbackKidneyMascot"
              />
            )}
            <div className="readerResultBannerText">
              <span className="readerResultCoreLabel">Core Takeaway</span>
              <strong>
                {!picked
                  ? `Unanswered · Correct Answer: ${key}`
                  : picked === key
                  ? `✓ Correct! You selected ${picked}.`
                  : `✕ Incorrect. You selected ${picked} (Locked). The correct answer is ${key}.`}
              </strong>
            </div>
          </div>

          <h3>Correct Answer</h3>
          <p>{answer}</p>

          <h3>Explanation</h3>
          <p>{explanationText}</p>

          {/* Post-Answer Collapsible Accordion: Clinical Pearls, Biopsy Findings & Serology */}
          {(() => {
            const haystack = `${question.title} ${question.body} ${question.full} ${(question.tags || []).join(' ')}`.toLowerCase()
            const isMpo = haystack.includes('mpo') || haystack.includes('p-anca') || haystack.includes('microscopic polyangiitis') || haystack.includes('mpa')
            const ancaVariant: 'c-anca' | 'p-anca' = isMpo ? 'p-anca' : 'c-anca'
            const ancaLabel = isMpo ? 'p-ANCA / MPO-ANCA' : 'c-ANCA / PR3-ANCA'
            return (
              <div
                style={{
                  marginTop: 16,
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 12,
                }}
              >
                <button
                  type="button"
                  aria-expanded={showPearlsDrawer}
                  onClick={() => setShowPearlsDrawer((prev) => !prev)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {showCompanionIcons && (
                      <PixelMicroscope size={16} active={showPearlsDrawer} />
                    )}
                    <span>Clinical Pearls &amp; Biopsy Findings</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        fontSize: 11.5,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {showCompanionIcons && (
                        <PixelANCA_Y_Antibody size={14} variant={ancaVariant} />
                      )}
                      <span>Serology &amp; Pathophysiology · {ancaLabel}</span>
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {showPearlsDrawer ? 'Hide ▴' : 'Expand ▾'}
                    </span>
                  </span>
                </button>

                {showPearlsDrawer && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <span className="metaDrawerChip">
                        <strong>Serology Context:</strong> {ancaLabel}
                      </span>
                      <span className="metaDrawerChip">
                        <strong>Decision Target:</strong> {question.target || 'Treatment selection'}
                      </span>
                      <span className="metaDrawerChip">
                        <strong>Evidence Source:</strong> {question.source}
                      </span>
                      <span className="metaDrawerChip">
                        <strong>Clinical Topic:</strong> {question.topic}
                      </span>
                    </div>
                    {question.tags && question.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {question.tags.map((tag) => (
                          <span key={tag} className="metaDrawerTag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="examModeInlineNotice" data-mode="tutor">
          <span>
            <strong>Tutor Mode:</strong> Select an option (<kbd className="kbdHint">A</kbd>–<kbd className="kbdHint">E</kbd> or{' '}
            <kbd className="kbdHint">1</kbd>–<kbd className="kbdHint">5</kbd>) to lock your choice and reveal the explanation.
          </span>
        </div>
      )}

      {/* ====================================================================
          MUTED COLLAPSIBLE FOOTER: Secondary Metadata (Source, Tags, Stats)
         ==================================================================== */}
      <footer className="cleanReaderFooter">
        <button
          type="button"
          className="cleanReaderFooterToggle"
          aria-expanded={showMetaFooter}
          onClick={() => setShowMetaFooter((prev) => !prev)}
        >
          <span>
            Question Metadata &amp; Clinical Tags ({question.source} · {question.topic})
          </span>
          <span aria-hidden="true">{showMetaFooter ? 'Hide ▴' : 'Show ▾'}</span>
        </button>

        <div className="smoothAccordionWrap" data-open={showMetaFooter}>
          <div className="smoothAccordionInner">
            <div className="cleanReaderFooterDetails">
              <span>
                <strong>Evidence Source:</strong> {question.source}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong>Decision Target:</strong> {question.target || 'Unclassified'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong>Sub-Topic:</strong> {question.topic}
              </span>
              {typeof peerAccuracyRate === 'number' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong>Peer Correctness:</strong> {peerAccuracyRate}%
                  </span>
                </>
              )}
              {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong>Time Spent:</strong> {formatDuration(elapsedSeconds)}
                  </span>
                </>
              )}
              {question.tags && question.tags.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong>Clinical Tags:</strong> {question.tags.join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>
    </article>
  )
}

function App() {
  const [navTab, setNavTab] = useState<'Dashboard' | 'Create Test' | 'Question Bank' | 'Glomerular Topics' | 'Author'>('Dashboard')
  const [mode, M] = useState<'Read' | 'Notes' | 'Edit record'>('Read')
  const [chartSplitMode, setChartSplitMode] = useState<'target' | 'source' | 'topic'>('target')
  const [selectedBarIdx, setSelectedBarIdx] = useState<number>(0)

  // Light / Dark theme toggle (persisted to localStorage)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('atlas-theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('atlas-theme', theme)
    } catch {
      // ignore storage error
    }
  }, [theme])

  // Minimal Mode Toggle: Companion Icons On/Off (persisted in localStorage)
  const [companionIcons, setCompanionIcons] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('atlas-companion-icons')
      return saved === null ? true : saved === 'true'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('atlas-companion-icons', String(companionIcons))
    } catch {
      // ignore storage error
    }
  }, [companionIcons])

  // Consecutive Correct Answer Streak (activates PixelFiltrateDrop when >= 3)
  const [correctStreak, setCorrectStreak] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('atlas-correct-streak')
      return saved !== null ? Number(saved) || 0 : 3
    } catch {
      return 3
    }
  })

  // Collapsible Question Navigator / Sidebar states (toggled via `[` keyboard shortcut or button)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const [isExamNavDrawerOpen, setIsExamNavDrawerOpen] = useState<boolean>(false)

  // 21st.dev Command Menu (⌘K) & Edge-Anchored Mastery & Atlas Map Slide-Over Drawer (M)
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState<boolean>(false)
  const [isMasteryDrawerOpen, setIsMasteryDrawerOpen] = useState<boolean>(false)

  // Selected Glomerular Disease inside the "Glomerular Topics" tab
  const [selectedGlomerularDisease, setSelectedGlomerularDisease] = useState<string>('ANCA-Associated Vasculitis')

  // Radar Chart & Adaptive Study Plan state (rendered in-flow on Dashboard, never persisted across tabs)
  const [radarDimension, setRadarDimension] = useState<'target' | 'source'>('target')
  const [showStudyPlanBanner, setShowStudyPlanBanner] = useState<boolean>(false)
  const [showStudyPlanLogicModal, setShowStudyPlanLogicModal] = useState<boolean>(false)
  const [studyPlanBlockSize, setStudyPlanBlockSize] = useState<12 | 16 | 20>(12)
  const [studyPlanPriorityRule, setStudyPlanPriorityRule] = useState<'wrong-first' | 'flagged-first' | 'balanced'>('wrong-first')

  // Mobile & Tablet Dashboard Collapsible Accordion state (keeps mobile/tablet clean with top priority info first)
  const [mobileDashAccordions, setMobileDashAccordions] = useState<{
    radar: boolean
    barChart: boolean
    pieChart: boolean
    summaryCards: boolean
  }>({
    radar: false,
    barChart: false,
    pieChart: false,
    summaryCards: false,
  })

  function toggleMobileDashAccordion(key: 'radar' | 'barChart' | 'pieChart' | 'summaryCards') {
    setMobileDashAccordions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function setAllMobileDashAccordions(open: boolean) {
    setMobileDashAccordions({
      radar: open,
      barChart: open,
      pieChart: open,
      summaryCards: open,
    })
  }

  // Never persist the Create Study Plan or Study Plan Logic panel across tabs: close automatically whenever navTab changes
  useEffect(() => {
    setShowStudyPlanBanner(false)
    setShowStudyPlanLogicModal(false)
  }, [navTab])

  // Semicircle Pie Chart state
  const [gaugeSubjectFilter, setGaugeSubjectFilter] = useState<string>('All ANCA Vasculitis')
  const [semiPieMode, setSemiPieMode] = useState<'subjects' | 'status'>('subjects')
  const [activePieSliceIdx, setActivePieSliceIdx] = useState<number | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)

  // Persistent question bank state (preserving existing localStorage migration logic)
  const [rows, setRows] = useState<Q[]>(() => {
    const raw =
      localStorage.getItem('atlas-edits-v4') ||
      localStorage.getItem('atlas-edits-v3') ||
      localStorage.getItem('atlas-edits-v2') ||
      '[]'
    const changes: Q[] = JSON.parse(raw)
      .map((q: Q) => (localStorage.getItem('atlas-edits-v4') === null ? { ...q, full: migrateAnswerOrder(q.id, q.full) } : q))
      .map((q: Q) =>
        localStorage.getItem('atlas-edits-v4') === null && localStorage.getItem('atlas-edits-v3') === null
          ? { ...q, status: 'In review' }
          : q
      )
    return [
      ...seed.map((q) =>
        changes.some((c) => c.id === q.id)
          ? {
              ...q,
              ...changes.find((c) => c.id === q.id),
              tags: changes.find((c) => c.id === q.id)?.tags?.length ? changes.find((c) => c.id === q.id)!.tags : q.tags,
            }
          : q
      ),
      ...changes.filter((c) => !seed.some((q) => q.id === c.id)),
    ]
  })

  // Pre-compute randomized 85% Correct (194) / 10% Wrong (23) / 5% Flagged (11) baseline with <60% weak areas
  const defaultBaseline = useMemo(() => buildPopulatedBaselineStats(rows), [rows])

  // Attempt history initialized with the randomized 85% Correct / 10% Wrong / 5% Flagged realistic stats
  const [attempts, setAttempts] = useState<Record<number, { choice: string; correct: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('nephro-qbank-attempts-v4')
      if (saved) return JSON.parse(saved)
      localStorage.setItem('nephro-qbank-attempts-v4', JSON.stringify(defaultBaseline.seededAttempts))
      return defaultBaseline.seededAttempts
    } catch {
      return defaultBaseline.seededAttempts
    }
  })

  // Flagged questions initialized with the 5% (11 questions) randomized baseline
  const [flaggedIds, setFlaggedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('nephro-qbank-flagged-v4')
      if (saved) return JSON.parse(saved)
      localStorage.setItem('nephro-qbank-flagged-v4', JSON.stringify(defaultBaseline.seededFlags))
      return defaultBaseline.seededFlags
    } catch {
      return defaultBaseline.seededFlags
    }
  })

  // Personal Study Notes per question (persisted to localStorage, with note icon on question cards)
  const [notes, setNotes] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('nephro-qbank-notes-v1')
      if (saved) return JSON.parse(saved)
      localStorage.setItem('nephro-qbank-notes-v1', JSON.stringify(defaultBaseline.seededNotes))
      return defaultBaseline.seededNotes
    } catch {
      return defaultBaseline.seededNotes
    }
  })
  const [noteSaveFeedback, setNoteSaveFeedback] = useState<string>('')

  // Modal session answers — cleared every time a question modal is opened so re-attempting a question
  // in the practice modal NEVER pre-shows the previously selected answer!
  const [modalSessionAnswers, setModalSessionAnswers] = useState<Record<number, { choice: string; correct: boolean }>>({})

  // Progressive Collapsible Accordion state for Create Test
  const [openAccordionStep, setOpenAccordionStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [openSubDrawerTargets, setOpenSubDrawerTargets] = useState<boolean>(true)
  const [openSubDrawerTopics, setOpenSubDrawerTopics] = useState<boolean>(true)
  const [openSubDrawerTags, setOpenSubDrawerTags] = useState<boolean>(true)
  const [openSubDrawerSources, setOpenSubDrawerSources] = useState<boolean>(false)

  // Active Test Block Session state — blockAnswers is ALWAYS reset to {} when starting a block
  // so re-attempting previously answered questions in a new block never shows previous answers!
  const [testMode, setTestMode] = useState<'Tutor' | 'Timed'>('Tutor')
  const [testPoolMode, setTestPoolMode] = useState<'unused' | 'incorrect' | 'flagged' | 'all'>('all')
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [activeDrillDownDomain, setActiveDrillDownDomain] = useState<string | null>(null)
  const [testCount, setTestCount] = useState<number>(10)
  const [customTestCountInput, setCustomTestCountInput] = useState<string>('10')
  const [activeExamIds, setActiveExamIds] = useState<number[] | null>(null)
  const [activeExamIndex, setActiveExamIndex] = useState(0)
  const [blockAnswers, setBlockAnswers] = useState<Record<number, { choice: string; correct: boolean }>>({})
  const [questionElapsedMap, setQuestionElapsedMap] = useState<Record<number, number>>({})
  const [recommendedSeconds, setRecommendedSeconds] = useState<number>(90)
  const [isBlockSubmitted, setIsBlockSubmitted] = useState<boolean>(false)
  const [showEndBlockConfirm, setShowEndBlockConfirm] = useState<boolean>(false)
  const [blockReviewLayout, setBlockReviewLayout] = useState<'all' | 'single'>('all')
  const [blockReviewFilter, setBlockReviewFilter] = useState<'all' | 'incorrect' | 'correct' | 'unanswered' | 'flagged'>('all')
  const [expandedReviewIds, setExpandedReviewIds] = useState<number[]>([])

  function handleRecordAttempt(qId: number, letter: string, isCorrect: boolean) {
    const next = { ...attempts, [qId]: { choice: letter, correct: isCorrect } }
    setAttempts(next)
    setCorrectStreak((prev) => {
      const updated = isCorrect ? prev + 1 : 0
      try {
        localStorage.setItem('atlas-correct-streak', String(updated))
      } catch {
        // ignore storage errors
      }
      return updated
    })
    try {
      localStorage.setItem('nephro-qbank-attempts-v4', JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  function handleRecordModalAttempt(qId: number, letter: string, isCorrect: boolean) {
    // In Tutor Mode, once an answer is selected and explanation is revealed, lock the choice
    if (modalSessionAnswers[qId]) return
    setModalSessionAnswers((prev) => ({ ...prev, [qId]: { choice: letter, correct: isCorrect } }))
    handleRecordAttempt(qId, letter, isCorrect)
  }

  function handleRecordBlockAttempt(qId: number, letter: string, isCorrect: boolean) {
    if (isBlockSubmitted) return
    // In Tutor Mode, once an answer is selected and explanation is revealed, prevent changing the answer to the correct option
    if (testMode === 'Tutor' && blockAnswers[qId]) return
    setBlockAnswers((prev) => ({ ...prev, [qId]: { choice: letter, correct: isCorrect } }))
    handleRecordAttempt(qId, letter, isCorrect)
  }

  function handleOpenEndBlockConfirm() {
    setShowEndBlockConfirm(true)
    window.setTimeout(() => {
      document.getElementById('end-block-confirm-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 40)
  }

  function handleFinishBlockReview() {
    setShowEndBlockConfirm(false)
    setIsBlockSubmitted(true)
    setBlockReviewLayout('all')
    setBlockReviewFilter('all')
    setExpandedReviewIds([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleReviewQuestionAccordion(qId: number) {
    setExpandedReviewIds((prev) => (prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]))
  }

  function handleToggleFlag(qId: number) {
    const next = flaggedIds.includes(qId) ? flaggedIds.filter((id) => id !== qId) : [...flaggedIds, qId]
    setFlaggedIds(next)
    try {
      localStorage.setItem('nephro-qbank-flagged-v4', JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  function handleUpdateNote(qId: number, text: string) {
    const next = { ...notes }
    if (text.trim()) {
      next[qId] = text
    } else {
      delete next[qId]
    }
    setNotes(next)
    try {
      localStorage.setItem('nephro-qbank-notes-v1', JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  function handleRestoreDemoBaseline() {
    const freshRandomized = buildPopulatedBaselineStats(rows)
    setAttempts(freshRandomized.seededAttempts)
    setFlaggedIds(freshRandomized.seededFlags)
    setNotes(freshRandomized.seededNotes)
    setBlockAnswers({})
    setModalSessionAnswers({})
    setQuestionElapsedMap({})
    setCorrectStreak(3)
    try {
      localStorage.setItem('nephro-qbank-attempts-v4', JSON.stringify(freshRandomized.seededAttempts))
      localStorage.setItem('nephro-qbank-flagged-v4', JSON.stringify(freshRandomized.seededFlags))
      localStorage.setItem('nephro-qbank-notes-v1', JSON.stringify(freshRandomized.seededNotes))
      localStorage.setItem('atlas-correct-streak', '3')
    } catch {
      // ignore
    }
  }

  function handleResetAllProgress() {
    setAttempts({})
    setFlaggedIds([])
    setBlockAnswers({})
    setModalSessionAnswers({})
    setQuestionElapsedMap({})
    setCorrectStreak(0)
    try {
      localStorage.setItem('nephro-qbank-attempts-v4', JSON.stringify({}))
      localStorage.setItem('nephro-qbank-flagged-v4', JSON.stringify([]))
      localStorage.setItem('atlas-correct-streak', '0')
    } catch {
      // ignore
    }
  }

  // Question Bank Filters & Correctness Rate Sorting
  const [source, S] = useState('')
  const [topic, T] = useState('')
  const [status, V] = useState('')
  const [search, F] = useState('')
  const [target, G] = useState('')
  const [tag, H] = useState('')
  const [attemptFilter, setAttemptFilter] = useState<'' | 'unused' | 'correct' | 'incorrect' | 'flagged' | 'notes'>('')
  const [sortOrder, setSortOrder] = useState<'default' | 'rate-asc' | 'rate-desc'>('default')
  const [recent, R] = useState(false)
  const [edit, E] = useState<Q | null>(null)
  const [error, err] = useState('')

  const labels = useMemo(() => Array.from(new Set([...VASCULITIS_SOURCES, ...sources, ...rows.map((q) => q.source)])), [rows])
  const topicList = useMemo(() => Array.from(new Set([...topics, ...rows.map((q) => q.topic)])), [rows])
  const allTargets = useMemo(() => Array.from(new Set([...VASCULITIS_TARGETS, ...rows.map((q) => q.target || 'Unclassified')])), [rows])
  const allTags = useMemo(() => Array.from(new Set(rows.flatMap((q) => q.tags || []))).sort(), [rows])

  // Global Question Bank Metrics (85% Correct, 10% Wrong, 5% Flagged across the 228 questions)
  const totalAvailable = rows.length
  const attemptedCount = useMemo(() => rows.filter((r) => Boolean(attempts[r.id])).length, [rows, attempts])
  const correctCount = useMemo(() => rows.filter((r) => attempts[r.id]?.correct === true).length, [rows, attempts])
  const wrongCount = useMemo(() => rows.filter((r) => attempts[r.id]?.correct === false).length, [rows, attempts])
  const unusedCount = Math.max(0, totalAvailable - attemptedCount)
  const flaggedCount = flaggedIds.length
  const notesCount = useMemo(() => Object.keys(notes).filter((k) => Boolean(notes[Number(k)]?.trim())).length, [notes])

  // Percentage breakdown of the 228-question bank (~85% Correct, ~10% Wrong, ~5% Flagged)
  const correctPct = totalAvailable > 0 ? Math.round((correctCount / totalAvailable) * 100) : 0
  const wrongPct = totalAvailable > 0 ? Math.round((wrongCount / totalAvailable) * 100) : 0
  const flaggedPct = totalAvailable > 0 ? Math.round((flaggedCount / totalAvailable) * 100) : 0
  const courseProgressPct =
    totalAvailable > 0 ? Math.min(100, Math.round(((attemptedCount + flaggedCount) / totalAvailable) * 100)) : 0

  const targetCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const q of rows) {
      const k = q.target || 'Unclassified'
      map[k] = (map[k] || 0) + 1
    }
    return map
  }, [rows])

  const sourceCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const q of rows) {
      map[q.source] = (map[q.source] || 0) + 1
    }
    return map
  }, [rows])

  const topicCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tp of topicList) {
      map[tp] = rows.filter((q) =>
        tp === 'Dosing & timing'
          ? q.topic === 'Dosing & timing' || q.target === 'Dosing & timing'
          : q.topic === tp
      ).length
    }
    return map
  }, [rows, topicList])

  const tagCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const q of rows) {
      for (const tg of q.tags || []) {
        map[tg] = (map[tg] || 0) + 1
      }
    }
    return map
  }, [rows])

  // Canonical Domain-to-Filter-Criteria Synchronization Map:
  // Maps any analytics domain drill-down (e.g., Diagnosis, Diagnostic reasoning, Dosing, Dosing & timing,
  // Induction therapy, Maintenance therapy, Disease assessment, Trial outcomes, Trial eligibility, Safety & monitoring)
  // to its corresponding Clinical Topics, Decision Targets, and Clinical Tags.
  const domainFilterSyncMap = useMemo(() => {
    const getTagsForQuestions = (predicate: (q: Q) => boolean, preferredTags: string[]) => {
      const fromBank = Array.from(
        new Set(rows.filter(predicate).flatMap((q) => q.tags || []))
      )
      const combined = Array.from(new Set([...preferredTags.filter((t) => allTags.includes(t)), ...fromBank]))
      return combined
    }

    const map: Record<
      string,
      {
        domainLabel: string
        topics: string[]
        targets: string[]
        tags: string[]
      }
    > = {
      Diagnosis: {
        domainLabel: 'Diagnosis & Diagnostic Reasoning',
        topics: ['Diagnosis'],
        targets: ['Diagnostic reasoning'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Diagnosis' || q.target === 'Diagnostic reasoning',
          ['Differential diagnosis', 'ANCA testing', 'Kidney biopsy', 'Acute kidney injury', 'PR3-ANCA']
        ),
      },
      'Diagnostic reasoning': {
        domainLabel: 'Diagnosis & Diagnostic Reasoning',
        topics: ['Diagnosis'],
        targets: ['Diagnostic reasoning'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Diagnosis' || q.target === 'Diagnostic reasoning',
          ['Differential diagnosis', 'ANCA testing', 'Kidney biopsy', 'Acute kidney injury', 'PR3-ANCA']
        ),
      },
      'Dosing & timing': {
        domainLabel: 'Dosing & Timing',
        topics: ['Dosing & timing'],
        targets: ['Dosing & timing'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Dosing & timing' || q.target === 'Dosing & timing',
          ['Dose adjustment', 'Folate supplementation', 'Glucocorticoids', 'Rituximab', 'Cyclophosphamide', 'Methotrexate', 'Azathioprine', 'Mycophenolate']
        ),
      },
      Dosing: {
        domainLabel: 'Dosing & Timing',
        topics: ['Dosing & timing'],
        targets: ['Dosing & timing'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Dosing & timing' || q.target === 'Dosing & timing',
          ['Dose adjustment', 'Folate supplementation', 'Glucocorticoids', 'Rituximab', 'Cyclophosphamide', 'Methotrexate', 'Azathioprine', 'Mycophenolate']
        ),
      },
      'Induction therapy': {
        domainLabel: 'Induction Therapy',
        topics: ['Induction therapy'],
        targets: ['Treatment selection'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Induction therapy',
          ['Induction therapy', 'Rituximab', 'Cyclophosphamide', 'Glucocorticoids', 'Plasma exchange']
        ),
      },
      Induction: {
        domainLabel: 'Induction Therapy',
        topics: ['Induction therapy'],
        targets: ['Treatment selection'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Induction therapy',
          ['Induction therapy', 'Rituximab', 'Cyclophosphamide', 'Glucocorticoids', 'Plasma exchange']
        ),
      },
      'Maintenance therapy': {
        domainLabel: 'Maintenance Therapy',
        topics: ['Maintenance therapy'],
        targets: ['Treatment selection'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Maintenance therapy',
          ['Maintenance therapy', 'Azathioprine', 'Rituximab', 'Methotrexate', 'Mycophenolate']
        ),
      },
      Maintenance: {
        domainLabel: 'Maintenance Therapy',
        topics: ['Maintenance therapy'],
        targets: ['Treatment selection'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Maintenance therapy',
          ['Maintenance therapy', 'Azathioprine', 'Rituximab', 'Methotrexate', 'Mycophenolate']
        ),
      },
      'Disease assessment': {
        domainLabel: 'Disease Assessment',
        topics: ['Disease assessment'],
        targets: ['Disease assessment'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Disease assessment' || q.target === 'Disease assessment',
          ['BVAS', 'Remission', 'Relapse', 'Follow-up', 'ANCA testing']
        ),
      },
      'Trial outcomes': {
        domainLabel: 'Trial Outcomes',
        topics: ['Trial outcomes'],
        targets: ['Evidence interpretation', 'Endpoint definitions'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Trial outcomes',
          ['Remission', 'Relapse', 'Renal outcomes', 'Major relapse', 'Minor relapse']
        ),
      },
      'Trial eligibility': {
        domainLabel: 'Trial Eligibility & Applicability',
        topics: ['Trial eligibility'],
        targets: ['Trial applicability'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Trial eligibility' || q.target === 'Trial applicability',
          ['Trial eligibility', 'Hepatitis B']
        ),
      },
      'Trial applicability': {
        domainLabel: 'Trial Eligibility & Applicability',
        topics: ['Trial eligibility', 'Trial applicability'].filter((t) => topicList.includes(t)),
        targets: ['Trial applicability'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Trial eligibility' || q.target === 'Trial applicability',
          ['Trial eligibility', 'Hepatitis B']
        ),
      },
      'Safety & monitoring': {
        domainLabel: 'Safety & Monitoring',
        topics: ['Safety & monitoring'].filter((t) => topicList.includes(t)),
        targets: ['Safety & monitoring'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Safety & monitoring' || q.target === 'Safety & monitoring',
          ['Drug safety', 'Blood counts', 'Infection', 'Prophylaxis', 'Fertility', 'Dose adjustment']
        ),
      },
      'Evidence interpretation': {
        domainLabel: 'Evidence Interpretation',
        topics: ['Trial outcomes', 'Evidence interpretation'].filter((t) => topicList.includes(t)),
        targets: ['Evidence interpretation'],
        tags: getTagsForQuestions(
          (q) => q.target === 'Evidence interpretation' || q.topic === 'Evidence interpretation',
          ['Remission', 'Relapse', 'Renal outcomes', 'Drug safety']
        ),
      },
      'Endpoint definitions': {
        domainLabel: 'Endpoint Definitions',
        topics: ['Trial outcomes', 'Endpoint definitions'].filter((t) => topicList.includes(t)),
        targets: ['Endpoint definitions'],
        tags: getTagsForQuestions(
          (q) => q.target === 'Endpoint definitions' || q.topic === 'Endpoint definitions',
          ['Major relapse', 'Minor relapse', 'BVAS', 'Remission', 'Relapse']
        ),
      },
      'Treatment selection': {
        domainLabel: 'Treatment Selection',
        topics: ['Induction therapy', 'Maintenance therapy', 'Treatment selection'].filter((t) => topicList.includes(t)),
        targets: ['Treatment selection'],
        tags: getTagsForQuestions(
          (q) => q.target === 'Treatment selection',
          ['Induction therapy', 'Maintenance therapy', 'Rituximab', 'Cyclophosphamide', 'Glucocorticoids', 'Azathioprine', 'Plasma exchange']
        ),
      },
      Transplantation: {
        domainLabel: 'Transplantation',
        topics: ['Transplantation'].filter((t) => topicList.includes(t)),
        targets: ['Disease assessment'],
        tags: getTagsForQuestions(
          (q) => q.topic === 'Transplantation',
          ['Transplantation', 'Remission', 'ANCA testing']
        ),
      },
    }
    return map
  }, [rows, allTags, topicList])

  // State-based synchronization effect: whenever activeDrillDownDomain is updated from an analytics drill-down,
  // ensure corresponding topics, targets, and clinical tags are pre-selected in the test builder filter state.
  useEffect(() => {
    if (!activeDrillDownDomain) return
    const syncEntry = domainFilterSyncMap[activeDrillDownDomain]
    if (syncEntry) {
      setSelectedTopics(syncEntry.topics)
      setSelectedTargets(syncEntry.targets)
      setSelectedTags(syncEntry.tags)
      setOpenSubDrawerTopics(true)
      setOpenSubDrawerTargets(true)
      setOpenSubDrawerTags(true)
    }
  }, [activeDrillDownDomain, domainFilterSyncMap])

  // Sub-topic performance metrics for the Radar Chart & Study Plan Generator
  const targetPerformanceMetrics: SubtopicMetric[] = useMemo(() => {
    return allTargets.map((t) => {
      const pool = rows.filter((q) => (q.target || 'Unclassified') === t)
      const attempted = pool.filter((q) => Boolean(attempts[q.id])).length
      const correct = pool.filter((q) => attempts[q.id]?.correct === true).length
      const wrong = pool.filter((q) => attempts[q.id]?.correct === false).length
      const flagged = pool.filter((q) => flaggedIds.includes(q.id)).length
      const unused = Math.max(0, pool.length - attempted)
      const accuracy = pool.length > 0 ? Math.round((correct / pool.length) * 100) : 0
      const shortLabel =
        t === 'Treatment selection'
          ? 'Treatment'
          : t === 'Dosing & timing'
          ? 'Dosing'
          : t === 'Evidence interpretation'
          ? 'Evidence'
          : t === 'Endpoint definitions'
          ? 'Endpoints'
          : t === 'Trial applicability'
          ? 'Applicability'
          : t === 'Disease assessment'
          ? 'Assessment'
          : t === 'Diagnostic reasoning'
          ? 'Diagnosis'
          : t === 'Safety & monitoring'
          ? 'Safety'
          : t.slice(0, 10)
      return {
        name: t,
        shortLabel,
        total: pool.length,
        attempted,
        correct,
        wrong,
        flagged,
        unused,
        accuracy,
      }
    })
  }, [allTargets, rows, attempts, flaggedIds])

  const sixAxisVasculitisMetrics = useMemo(
    () => computeSixAxisVasculitisMetrics(rows, attempts, flaggedIds),
    [rows, attempts, flaggedIds]
  )

  const sourcePerformanceMetrics: SubtopicMetric[] = useMemo(() => {
    return labels.slice(0, 8).map((s) => {
      const pool = rows.filter((q) => q.source === s)
      const attempted = pool.filter((q) => Boolean(attempts[q.id])).length
      const correct = pool.filter((q) => attempts[q.id]?.correct === true).length
      const wrong = pool.filter((q) => attempts[q.id]?.correct === false).length
      const flagged = pool.filter((q) => flaggedIds.includes(q.id)).length
      const unused = Math.max(0, pool.length - attempted)
      const accuracy = pool.length > 0 ? Math.round((correct / pool.length) * 100) : 0
      return {
        name: s,
        shortLabel: s === 'KDIGO 2024' ? 'KDIGO' : s,
        total: pool.length,
        attempted,
        correct,
        wrong,
        flagged,
        unused,
        accuracy,
      }
    })
  }, [labels, rows, attempts, flaggedIds])

  /**
   * Per-Question Correctness Rate (%) Map:
   * Combines the question's sub-topic accuracy, the user's attempt/flag status on that question,
   * and a deterministic question offset so every question has an explicit Correctness Rate (e.g., 28%–98%)
   * that users can sort by (Highest to Lowest or Lowest to Highest) to identify challenging content.
   */
  const questionCorrectnessRates = useMemo(() => {
    const targetAccMap: Record<string, number> = {}
    for (const m of targetPerformanceMetrics) {
      targetAccMap[m.name] = m.accuracy
    }
    const rates: Record<number, number> = {}
    for (const q of rows) {
      const subAcc = targetAccMap[q.target || 'Treatment selection'] ?? 75
      const jitter = ((q.id * 7) % 13) - 6
      const attempt = attempts[q.id]
      const isFlagged = flaggedIds.includes(q.id)
      let rate: number
      if (attempt && !attempt.correct) {
        // Challenging / Wrong items have low correctness rates (26% – 49%)
        rate = Math.max(24, Math.min(49, Math.round(subAcc * 0.52) + jitter))
      } else if (isFlagged) {
        // Flagged items have moderate correctness rates (51% – 66%)
        rate = Math.max(51, Math.min(66, Math.round(subAcc * 0.78) + jitter))
      } else if (attempt && attempt.correct) {
        // Correct items reflect sub-topic strength (70% – 98%)
        rate = Math.max(70, Math.min(98, subAcc + jitter))
      } else {
        rate = Math.max(45, Math.min(92, subAcc + jitter))
      }
      rates[q.id] = rate
    }
    return rates
  }, [rows, targetPerformanceMetrics, attempts, flaggedIds])

  /**
   * Adaptive Study Plan Generator:
   * Automatically identifies the user's 4 weakest vasculitis sub-topics based on accuracy data:
   * - Safety & monitoring (40%), Diagnostic reasoning (55%), Disease assessment (64%), Trial applicability (69%)
   * Allocates a proportional mix of questions across those 4 weakest sub-topics based on `studyPlanBlockSize` (12, 16, or 20)
   * and orders items inside each weak sub-topic according to `studyPlanPriorityRule` ('wrong-first', 'flagged-first', or 'balanced').
   */
  const adaptiveStudyPlan = useMemo(() => {
    const sorted = [...targetPerformanceMetrics].sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
      return b.wrong + b.flagged - (a.wrong + a.flagged)
    })

    const topWeakTopics = sorted.slice(0, 4)
    const quotas =
      studyPlanBlockSize === 20
        ? [7, 5, 4, 4]
        : studyPlanBlockSize === 16
        ? [6, 4, 3, 3]
        : [4, 3, 3, 2]
    const pickedQuestionIds: number[] = []

    const topicAllocations = topWeakTopics.map((topicMetric, idx) => {
      const quota = quotas[idx] || 3
      const topicPool = rows.filter((q) => (q.target || 'Unclassified') === topicMetric.name)

      const prioritizedPool = [...topicPool].sort((q1, q2) => {
        const score = (q: Q) => {
          const isWrong = attempts[q.id]?.correct === false
          const isFlag = flaggedIds.includes(q.id)
          const isUnused = !attempts[q.id]
          if (studyPlanPriorityRule === 'flagged-first') {
            if (isFlag) return 0
            if (isWrong) return 1
            if (isUnused) return 2
            return 3
          }
          if (studyPlanPriorityRule === 'balanced') {
            if (isWrong || isFlag) return 0
            if (isUnused) return 1
            return 2
          }
          // Default: 'wrong-first'
          if (isWrong) return 0
          if (isFlag) return 1
          if (isUnused) return 2
          return 3
        }
        return score(q1) - score(q2)
      })

      const chosen = prioritizedPool.slice(0, quota)
      chosen.forEach((q) => pickedQuestionIds.push(q.id))

      const wrongInChosen = chosen.filter((q) => attempts[q.id]?.correct === false).length
      const flaggedInChosen = chosen.filter((q) => flaggedIds.includes(q.id)).length
      const reinforcementInChosen = Math.max(0, chosen.length - wrongInChosen - flaggedInChosen)

      return {
        ...topicMetric,
        allocatedCount: chosen.length,
        questionIds: chosen.map((c) => c.id),
        wrongInChosen,
        flaggedInChosen,
        reinforcementInChosen,
        reason: `${topicMetric.accuracy}% accuracy (${topicMetric.wrong} wrong, ${topicMetric.flagged} flagged of ${topicMetric.total} QS)`,
      }
    })

    return {
      allocations: topicAllocations,
      questionIds: pickedQuestionIds,
      weakTargetNames: topWeakTopics.map((t) => t.name),
    }
  }, [targetPerformanceMetrics, rows, attempts, flaggedIds, studyPlanBlockSize, studyPlanPriorityRule])

  // Matching pool count for the Create Test configuration screen BEFORE launching the test
  const matchingBuilderPool = useMemo(() => {
    let pool = rows.filter((q) => {
      const matchesSource =
        selectedSources.length === 0 || selectedSources.includes(q.source)
      if (!matchesSource) return false

      if (
        selectedTopics.length === 0 &&
        selectedTargets.length === 0 &&
        selectedTags.length === 0
      ) {
        return true
      }

      // If an analytics domain drill-down is active, match questions belonging to that domain
      if (activeDrillDownDomain) {
        if (
          activeDrillDownDomain === 'Diagnosis' ||
          activeDrillDownDomain === 'Diagnostic reasoning'
        ) {
          return q.topic === 'Diagnosis' || q.target === 'Diagnostic reasoning'
        }
        if (
          activeDrillDownDomain === 'Dosing & timing' ||
          activeDrillDownDomain === 'Dosing'
        ) {
          return q.topic === 'Dosing & timing' || q.target === 'Dosing & timing'
        }
        if (
          allTargets.includes(activeDrillDownDomain) &&
          (!topicList.includes(activeDrillDownDomain) ||
            activeDrillDownDomain === 'Treatment selection' ||
            activeDrillDownDomain === 'Evidence interpretation' ||
            activeDrillDownDomain === 'Endpoint definitions' ||
            activeDrillDownDomain === 'Trial applicability' ||
            activeDrillDownDomain === 'Safety & monitoring')
        ) {
          return (
            (q.target || 'Unclassified') === activeDrillDownDomain ||
            q.topic === activeDrillDownDomain
          )
        }
        if (topicList.includes(activeDrillDownDomain)) {
          return (
            q.topic === activeDrillDownDomain ||
            (activeDrillDownDomain === 'Trial eligibility' &&
              q.target === 'Trial applicability')
          )
        }
      }

      const matchesTopic =
        selectedTopics.length > 0 &&
        selectedTopics.some((tp) =>
          tp === 'Dosing & timing'
            ? q.topic === 'Dosing & timing' || q.target === 'Dosing & timing'
            : tp === 'Diagnosis'
            ? q.topic === 'Diagnosis' || q.target === 'Diagnostic reasoning'
            : q.topic === tp
        )
      const matchesTarget =
        selectedTargets.length > 0 &&
        selectedTargets.includes(q.target || 'Unclassified')
      const matchesTag =
        selectedTags.length > 0 &&
        (q.tags || []).some((tg) => selectedTags.includes(tg))

      if (selectedTopics.length > 0 || selectedTargets.length > 0) {
        return matchesTopic || matchesTarget
      }
      return matchesTag
    })
    if (testPoolMode === 'unused') {
      pool = pool.filter((q) => !attempts[q.id])
    } else if (testPoolMode === 'incorrect') {
      pool = pool.filter((q) => attempts[q.id]?.correct === false)
    } else if (testPoolMode === 'flagged') {
      pool = pool.filter((q) => flaggedIds.includes(q.id))
    }
    return pool
  }, [
    rows,
    selectedTargets,
    selectedTopics,
    selectedTags,
    selectedSources,
    activeDrillDownDomain,
    allTargets,
    topicList,
    testPoolMode,
    attempts,
    flaggedIds,
  ])

  // Functional Stacked Bar Chart Data — accurately split across the ANCA-Vasculitis subjects in GitHub
  const chartBars = useMemo(() => {
    if (chartSplitMode === 'target') {
      return allTargets.map((t) => {
        const pool = rows.filter((q) => (q.target || 'Unclassified') === t)
        const corr = pool.filter((q) => attempts[q.id]?.correct === true).length
        const wrongOrFlag = pool.length - corr
        const acc = pool.length > 0 ? Math.round((corr / pool.length) * 100) : 0
        const shortLabel =
          t === 'Diagnostic reasoning'
            ? 'Diagnosis'
            : t === 'Endpoint definitions'
            ? 'Endpoints'
            : t === 'Disease assessment'
            ? 'Assessment'
            : t === 'Trial applicability'
            ? 'Trial App.'
            : t.split(' ')[0].replace(/[^A-Za-z]/g, '').slice(0, 9)
        return {
          key: t,
          shortLabel,
          fullTitle: t,
          total: pool.length,
          completed: corr,
          correct: corr,
          remaining: wrongOrFlag,
          accuracy: acc,
        }
      })
    } else if (chartSplitMode === 'source') {
      return labels.map((src) => {
        const pool = rows.filter((q) => q.source === src)
        const corr = pool.filter((q) => attempts[q.id]?.correct === true).length
        const wrongOrFlag = pool.length - corr
        const acc = pool.length > 0 ? Math.round((corr / pool.length) * 100) : 0
        const shortLabel = src === 'KDIGO 2024' ? 'KDIGO' : src.slice(0, 7)
        return {
          key: src,
          shortLabel,
          fullTitle: `${src} (${/^KDIGO/i.test(src) ? 'Guideline' : 'Vasculitis Trial'})`,
          total: pool.length,
          completed: corr,
          correct: corr,
          remaining: wrongOrFlag,
          accuracy: acc,
        }
      })
    } else {
      const majorTopics = [
        'Induction therapy',
        'Trial outcomes',
        'Disease assessment',
        'Maintenance therapy',
        'Diagnosis',
        'Trial eligibility',
        'Dosing & timing',
      ]
      return majorTopics.map((tp) => {
        const pool = rows.filter((q) =>
          tp === 'Dosing & timing'
            ? q.topic === 'Dosing & timing' || q.target === 'Dosing & timing'
            : q.topic === tp
        )
        const corr = pool.filter((q) => attempts[q.id]?.correct === true).length
        const wrongOrFlag = pool.length - corr
        const acc = pool.length > 0 ? Math.round((corr / pool.length) * 100) : 0
        const shortLabel =
          tp === 'Induction therapy'
            ? 'Induction'
            : tp === 'Trial outcomes'
            ? 'Outcomes'
            : tp === 'Disease assessment'
            ? 'Assessment'
            : tp === 'Maintenance therapy'
            ? 'Maint.'
            : tp === 'Trial eligibility'
            ? 'Eligibility'
            : tp === 'Dosing & timing'
            ? 'Dosing'
            : tp
        return {
          key: tp,
          shortLabel,
          fullTitle: tp,
          total: pool.length,
          completed: corr,
          correct: corr,
          remaining: wrongOrFlag,
          accuracy: acc,
        }
      })
    }
  }, [chartSplitMode, allTargets, labels, rows, attempts])

  const maxBarTotal = useMemo(() => Math.max(20, ...chartBars.map((b) => b.total)), [chartBars])
  const safeSelectedBarIdx = Math.min(selectedBarIdx, Math.max(0, chartBars.length - 1))
  const activeBar = chartBars[safeSelectedBarIdx] || chartBars[0]

  // Functional Semi-Circular Pie Chart Data — filtered by Trial/Guideline or All ANCA Vasculitis
  const gaugePool = useMemo(() => {
    if (gaugeSubjectFilter === 'All ANCA Vasculitis') return rows
    if (labels.includes(gaugeSubjectFilter)) {
      return rows.filter((q) => q.source === gaugeSubjectFilter)
    }
    if (allTargets.includes(gaugeSubjectFilter)) {
      return rows.filter((q) => (q.target || 'Unclassified') === gaugeSubjectFilter)
    }
    return rows
  }, [rows, gaugeSubjectFilter, labels, allTargets])

  const gaugeTotal = gaugePool.length

  // Build the 4 smooth semicircle pie slices (flowing Hatched Green -> Purple -> Sky Blue -> Amber)
  const semiPieSlices = useMemo(() => {
    let rawItems: {
      id: string
      label: string
      count: number
      fill: string
      swatch: string
      onClick: () => void
    }[] = []

    if (semiPieMode === 'subjects') {
      const treatmentCount = gaugePool.filter((q) => q.target === 'Treatment selection').length
      const evidenceCount = gaugePool.filter(
        (q) => q.target === 'Evidence interpretation' || q.target === 'Endpoint definitions'
      ).length
      const dosingCount = gaugePool.filter((q) => q.target === 'Dosing & timing').length
      const diagSafetyCount = gaugePool.filter(
        (q) =>
          q.target === 'Diagnostic reasoning' ||
          q.target === 'Disease assessment' ||
          q.target === 'Trial applicability' ||
          q.target === 'Safety & monitoring'
      ).length

      rawItems = [
        {
          id: 'treatment',
          label: 'Treatment Selection',
          count: treatmentCount,
          fill: 'url(#gaugeHatch)',
          swatch: '#b9dec8',
          onClick: () => openCreateTestConfigurator({ targets: ['Treatment selection'] }),
        },
        {
          id: 'evidence',
          label: 'Evidence & Endpoints',
          count: evidenceCount,
          fill: '#7347f5',
          swatch: '#7347f5',
          onClick: () => openCreateTestConfigurator({ targets: ['Evidence interpretation', 'Endpoint definitions'] }),
        },
        {
          id: 'dosing',
          label: 'Dosing & Timing',
          count: dosingCount,
          fill: '#38b6ff',
          swatch: '#38b6ff',
          onClick: () => openCreateTestConfigurator({ targets: ['Dosing & timing'] }),
        },
        {
          id: 'diagnosis',
          label: 'Weak Areas (Diag/Safety)',
          count: diagSafetyCount,
          fill: '#f7a61c',
          swatch: '#f7a61c',
          onClick: () =>
            openCreateTestConfigurator({
              targets: ['Safety & monitoring', 'Diagnostic reasoning', 'Disease assessment', 'Trial applicability'],
            }),
        },
      ]
    } else {
      const gCorrect = gaugePool.filter((q) => attempts[q.id]?.correct === true).length
      const gWrong = gaugePool.filter((q) => attempts[q.id]?.correct === false).length
      const gFlagged = gaugePool.filter((q) => flaggedIds.includes(q.id)).length
      const gNotes = gaugePool.filter((q) => Boolean(notes[q.id]?.trim())).length

      rawItems = [
        {
          id: 'correct',
          label: 'Correct',
          count: gCorrect,
          fill: 'url(#gaugeHatch)',
          swatch: '#b9dec8',
          onClick: () => openFilteredQBank({ attemptFilter: 'correct' }),
        },
        {
          id: 'wrong',
          label: 'Incorrect',
          count: gWrong,
          fill: '#7347f5',
          swatch: '#7347f5',
          onClick: () => openCreateTestConfigurator({ poolMode: 'incorrect' }),
        },
        {
          id: 'flagged',
          label: 'Flagged',
          count: gFlagged,
          fill: '#38b6ff',
          swatch: '#38b6ff',
          onClick: () => openFilteredQBank({ attemptFilter: 'flagged' }),
        },
        {
          id: 'notes',
          label: 'With Study Notes',
          count: gNotes,
          fill: '#f7a61c',
          swatch: '#f7a61c',
          onClick: () => openFilteredQBank({ attemptFilter: 'notes' }),
        },
      ]
    }

    const gapDeg = 3.2
    const totalAvailableDeg = 180 - gapDeg * (rawItems.length - 1)
    const totalCount = rawItems.reduce((acc, item) => acc + item.count, 0)

    const weights = rawItems.map((item) => (totalCount > 0 ? Math.max(0.08, item.count / totalCount) : 0.25))
    const weightSum = weights.reduce((a, b) => a + b, 0)

    let cursor = 180
    return rawItems.map((item, i) => {
      const span = (weights[i] / weightSum) * totalAvailableDeg
      const startDeg = cursor
      const endDeg = Math.max(0, cursor - span)
      cursor = endDeg - gapDeg
      const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0
      return {
        ...item,
        pct,
        path: createRoundedAnnularWedge(140, 144, 82, 126, startDeg, endDeg, 7),
      }
    })
  }, [semiPieMode, gaugePool, attempts, flaggedIds, notes])

  const hoveredPieSlice = activePieSliceIdx !== null ? semiPieSlices[activePieSliceIdx] : null

  // Filtered AND Sorted Question Bank Rows (including Correctness Rate sorting)
  const visible = useMemo(() => {
    const filtered = rows
      .filter((q) => !recent || q.id > 212)
      .filter((q) => {
        if (attemptFilter === 'unused' && Boolean(attempts[q.id])) return false
        if (attemptFilter === 'correct' && attempts[q.id]?.correct !== true) return false
        if (attemptFilter === 'incorrect' && attempts[q.id]?.correct !== false) return false
        if (attemptFilter === 'flagged' && !flaggedIds.includes(q.id)) return false
        if (attemptFilter === 'notes' && !notes[q.id]?.trim()) return false
        return true
      })
      .filter(
        (q) =>
          (!target || (q.target || 'Unclassified') === target) &&
          (!tag || q.tags?.includes(tag)) &&
          (!source || q.source === source) &&
          (!topic || q.topic === topic) &&
          (!status || q.status === status) &&
          [q.title, q.body, q.full, q.source, q.topic, q.target, notes[q.id] || '', ...(q.tags || [])]
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase())
      )

    if (sortOrder === 'rate-asc') {
      return [...filtered].sort((a, b) => (questionCorrectnessRates[a.id] ?? 50) - (questionCorrectnessRates[b.id] ?? 50))
    }
    if (sortOrder === 'rate-desc') {
      return [...filtered].sort((a, b) => (questionCorrectnessRates[b.id] ?? 50) - (questionCorrectnessRates[a.id] ?? 50))
    }
    return filtered
  }, [
    rows,
    recent,
    attemptFilter,
    attempts,
    flaggedIds,
    notes,
    target,
    tag,
    source,
    topic,
    status,
    search,
    sortOrder,
    questionCorrectnessRates,
  ])

  const [page, P] = useState(0)
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / 10) - 1))
  useEffect(() => P(0), [source, target, tag, status, search, recent, topic, attemptFilter, sortOrder])

  /**
   * Opens a question modal in 'Read', 'Notes', or 'Edit record' mode.
   * Clears modalSessionAnswers[q.id] whenever opening a question so re-attempting it
   * in the modal never displays the previously selected answer choice!
   */
  function openQuestion(q: Q, initialMode: 'Read' | 'Notes' | 'Edit record' = 'Read') {
    M(initialMode)
    err('')
    setNoteSaveFeedback('')
    setModalSessionAnswers((prev) => {
      const next = { ...prev }
      delete next[q.id]
      return next
    })
    E({ ...q })
  }

  function createNewQuestionRecord(forDisease?: string) {
    const nextId = Math.max(228, ...rows.map((r) => r.id)) + 1
    const padded = String(nextId).padStart(3, '0')
    M('Edit record')
    err('')
    setNoteSaveFeedback('')
    E({
      id: nextId,
      title: `Q${padded} · Which of the following is the most appropriate next management step?`,
      source: 'KDIGO 2024',
      topic: forDisease && forDisease !== 'ANCA-Associated Vasculitis' ? forDisease : 'Induction therapy',
      status: 'In review',
      body: `A 62-year-old patient presents with biopsy-proven ${forDisease || 'ANCA-associated glomerulonephritis'}.`,
      full: DEFAULT_NEW_QUESTION_TEMPLATE,
      target: target || 'Treatment selection',
      tags: ['Kidney biopsy', forDisease || 'ANCA testing'],
      disease: forDisease || 'ANCA-Associated Vasculitis',
    })
  }

  function openFilteredQBank(opts: {
    attemptFilter?: '' | 'unused' | 'correct' | 'incorrect' | 'flagged' | 'notes'
    target?: string
    source?: string
    topic?: string
    sortOrder?: 'default' | 'rate-asc' | 'rate-desc'
  }) {
    setAttemptFilter(opts.attemptFilter ?? '')
    G(opts.target ?? '')
    S(opts.source ?? '')
    T(opts.topic ?? '')
    if (opts.sortOrder) setSortOrder(opts.sortOrder)
    setNavTab('Question Bank')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Opens the Create Test configuration screen (without showing any questions yet)
   * pre-populated with any requested filter options, and automatically synchronizes
   * the corresponding Clinical Topics, Decision Targets, and Clinical Tags for any
   * analytics domain drill-down (e.g., Diagnosis, Dosing & timing, Induction therapy).
   */
  function openCreateTestConfigurator(opts?: {
    poolMode?: 'unused' | 'incorrect' | 'flagged' | 'all'
    domain?: string
    targets?: string[]
    topics?: string[]
    tags?: string[]
    sources?: string[]
    topic?: string
    initialStep?: 1 | 2 | 3 | 4 | 5
  }) {
    const rawTargets = opts?.targets ?? []
    const rawTopics = opts?.topics ?? (opts?.topic ? [opts.topic] : [])
    const rawTags = opts?.tags ?? []
    const nextSources = opts?.sources ?? []

    // Identify if this navigation is a single-domain or multi-domain analytics drill-down
    const candidateDomains = [
      ...(opts?.domain ? [opts.domain] : []),
      ...rawTopics,
      ...rawTargets,
    ]
    const matchedSyncEntries = candidateDomains
      .map((d) => domainFilterSyncMap[d])
      .filter(Boolean)

    let nextTopics = [...rawTopics]
    let nextTargets = [...rawTargets]
    let nextTags = [...rawTags]

    if (matchedSyncEntries.length > 0) {
      nextTopics = Array.from(
        new Set([...nextTopics, ...matchedSyncEntries.flatMap((e) => e.topics)])
      )
      nextTargets = Array.from(
        new Set([...nextTargets, ...matchedSyncEntries.flatMap((e) => e.targets)])
      )
      nextTags = Array.from(
        new Set([...nextTags, ...matchedSyncEntries.flatMap((e) => e.tags)])
      )
      setActiveDrillDownDomain(candidateDomains[0] || null)
    } else if (nextSources.length > 0) {
      const sourceTags = Array.from(
        new Set(
          rows
            .filter((q) => nextSources.includes(q.source))
            .flatMap((q) => q.tags || [])
        )
      )
      nextTags = Array.from(new Set([...nextTags, ...sourceTags]))
      setActiveDrillDownDomain(null)
    } else {
      setActiveDrillDownDomain(null)
    }

    setTestPoolMode(opts?.poolMode ?? 'all')
    setSelectedTargets(nextTargets)
    setSelectedTopics(nextTopics)
    setSelectedTags(nextTags)
    setSelectedSources(nextSources)

    const hasSpecificFilter =
      nextTargets.length > 0 ||
      nextTopics.length > 0 ||
      nextTags.length > 0 ||
      nextSources.length > 0
    if (hasSpecificFilter) {
      setOpenSubDrawerTopics(nextTopics.length > 0 || matchedSyncEntries.length > 0)
      setOpenSubDrawerTargets(nextTargets.length > 0 || matchedSyncEntries.length > 0)
      setOpenSubDrawerTags(nextTags.length > 0 || matchedSyncEntries.length > 0)
      setOpenSubDrawerSources(nextSources.length > 0)
    } else {
      setOpenSubDrawerTopics(true)
      setOpenSubDrawerTargets(true)
      setOpenSubDrawerTags(true)
      setOpenSubDrawerSources(false)
    }

    setOpenAccordionStep(opts?.initialStep ?? (hasSpecificFilter ? 4 : 1))
    setActiveExamIds(null)
    setIsBlockSubmitted(false)
    setShowEndBlockConfirm(false)
    setBlockReviewLayout('all')
    setBlockReviewFilter('all')
    setBlockAnswers({})
    setQuestionElapsedMap({})
    setNavTab('Create Test')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Starts a fresh test block ONLY after the user has selected their options on the Create Test page.
   * Resets blockAnswers to {} so every question in the block opens 100% unanswered—even if the user
   * previously attempted that question!
   */
  function handleStartConfiguredTest() {
    const pool = matchingBuilderPool.length > 0 ? matchingBuilderPool : rows
    const desiredCount = Math.max(1, Math.min(testCount, pool.length))
    const selected = pool.slice(0, desiredCount).map((q) => q.id)
    setBlockAnswers({})
    setQuestionElapsedMap({})
    setIsBlockSubmitted(false)
    setShowEndBlockConfirm(false)
    setBlockReviewLayout('all')
    setBlockReviewFilter('all')
    setActiveExamIds(selected)
    setActiveExamIndex(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Directly launches the Adaptive Study Plan question mix tailored to the user's weakest sub-topics.
   * Clears blockAnswers so every re-attempted question in the block starts completely fresh and unmarked.
   */
  function handleLaunchStudyPlanBlock() {
    const ids = adaptiveStudyPlan.questionIds.length > 0 ? adaptiveStudyPlan.questionIds : rows.slice(0, 12).map((q) => q.id)
    setSelectedTargets(adaptiveStudyPlan.weakTargetNames)
    setSelectedTopics([])
    setSelectedTags([])
    setSelectedSources([])
    setActiveDrillDownDomain(null)
    setTestMode('Tutor')
    setBlockAnswers({})
    setQuestionElapsedMap({})
    setIsBlockSubmitted(false)
    setShowEndBlockConfirm(false)
    setBlockReviewLayout('all')
    setBlockReviewFilter('all')
    setActiveExamIds(ids)
    setActiveExamIndex(0)
    setShowStudyPlanBanner(false)
    setNavTab('Create Test')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function syncTagsForTopicsAndTargets(nextTopics: string[], nextTargets: string[]) {
    const domainKeys = [...nextTopics, ...nextTargets]
    const entries = domainKeys.map((k) => domainFilterSyncMap[k]).filter(Boolean)
    if (entries.length > 0) {
      const syncedTags = Array.from(new Set(entries.flatMap((e) => e.tags)))
      setSelectedTags(syncedTags)
    } else if (nextTopics.length === 0 && nextTargets.length === 0) {
      setSelectedTags([])
    }
  }

  function toggleTargetSelection(t: string) {
    setActiveDrillDownDomain(null)
    setSelectedTargets((prev) => {
      const isRemoving = prev.includes(t)
      const nextTargets = isRemoving ? prev.filter((item) => item !== t) : [...prev, t]
      // Synchronize corresponding topic & tags when selecting a domain target (e.g., Diagnostic reasoning -> Diagnosis, Dosing & timing)
      const syncEntry = domainFilterSyncMap[t]
      let nextTopics = selectedTopics
      if (!isRemoving && syncEntry) {
        nextTopics = Array.from(new Set([...selectedTopics, ...syncEntry.topics]))
        setSelectedTopics(nextTopics)
      } else if (isRemoving && (t === 'Diagnostic reasoning' || t === 'Dosing & timing' || t === 'Disease assessment')) {
        const pairedTopic = t === 'Diagnostic reasoning' ? 'Diagnosis' : t
        nextTopics = selectedTopics.filter((tp) => tp !== pairedTopic)
        setSelectedTopics(nextTopics)
      }
      syncTagsForTopicsAndTargets(nextTopics, nextTargets)
      return nextTargets
    })
  }

  function toggleTopicSelection(tp: string) {
    setActiveDrillDownDomain(null)
    setSelectedTopics((prev) => {
      const isRemoving = prev.includes(tp)
      const nextTopics = isRemoving ? prev.filter((item) => item !== tp) : [...prev, tp]
      // Synchronize corresponding decision target & clinical tags when selecting a topic (e.g., Diagnosis -> Diagnostic reasoning, Dosing & timing)
      const syncEntry = domainFilterSyncMap[tp]
      let nextTargets = selectedTargets
      if (!isRemoving && syncEntry) {
        nextTargets = Array.from(new Set([...selectedTargets, ...syncEntry.targets]))
        setSelectedTargets(nextTargets)
      } else if (isRemoving && (tp === 'Diagnosis' || tp === 'Dosing & timing' || tp === 'Disease assessment')) {
        const pairedTarget = tp === 'Diagnosis' ? 'Diagnostic reasoning' : tp
        nextTargets = selectedTargets.filter((tg) => tg !== pairedTarget)
        setSelectedTargets(nextTargets)
      }
      syncTagsForTopicsAndTargets(nextTopics, nextTargets)
      return nextTopics
    })
  }

  function toggleTagSelection(tg: string) {
    setActiveDrillDownDomain(null)
    setSelectedTags((prev) => (prev.includes(tg) ? prev.filter((item) => item !== tg) : [...prev, tg]))
  }

  function toggleSourceSelection(s: string) {
    setSelectedSources((prev) => (prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]))
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!edit) return
    const q: Q = {
      ...edit,
      title: edit.title.trim(),
      source: edit.source.trim(),
      topic: edit.topic.trim(),
    }
    if (!q.tags?.length) {
      err('Add at least one clinical tag before saving.')
      return
    }
    if (!q.title || !q.source || !q.topic) {
      err('Enter a title, source and topic.')
      return
    }
    const next = rows.some((r) => r.id === q.id) ? rows.map((r) => (r.id === q.id ? q : r)) : [...rows, q]
    try {
      localStorage.setItem('atlas-edits-v4', JSON.stringify(next.filter((item) => !seed.includes(item))))
      setRows(next)
      E(null)
    } catch {
      err('Browser storage is full or unavailable.')
    }
  }

  const activeExamQuestion =
    activeExamIds && activeExamIds.length > 0
      ? rows.find((r) => r.id === activeExamIds[activeExamIndex]) || null
      : null

  // When inside an exam block, ONLY the block is visible on the screen (hide top header, navigation tabs, and welcome buttons)
  const isInsideExamBlock = Boolean(activeExamIds && activeExamIds.length > 0 && navTab === 'Create Test')

  // Smoothly scroll reading container back to top whenever activeExamIndex changes
  useEffect(() => {
    if (isInsideExamBlock) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [activeExamIndex, isInsideExamBlock])

  // Global Keyboard Navigation:
  // - `⌘K` or `Ctrl+K` toggles the 21st.dev Command Menu
  // - `M` toggles the Slide-Over Mastery & Atlas Map Drawer
  // - `[` toggles the Question Navigator / Sidebar drawer
  // - `ArrowLeft` / `ArrowRight` navigates Previous / Next question inside an active block
  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandMenuOpen((prev) => !prev)
        return
      }

      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setIsMasteryDrawerOpen((prev) => !prev)
        return
      }

      if (e.key === '[') {
        e.preventDefault()
        if (isInsideExamBlock) {
          setIsExamNavDrawerOpen((prev) => !prev)
        } else {
          setIsSidebarOpen((prev) => !prev)
        }
        return
      }

      if (isInsideExamBlock && !edit && activeExamIds && activeExamIds.length > 0) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setActiveExamIndex((prev) => Math.max(0, prev - 1))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setActiveExamIndex((prev) => Math.min(activeExamIds.length - 1, prev + 1))
        }
      }
    }

    window.addEventListener('keydown', onGlobalKeyDown)
    return () => window.removeEventListener('keydown', onGlobalKeyDown)
  }, [isInsideExamBlock, edit, activeExamIds])

  const activeGlomerularModule =
    GLOMERULAR_MODULES.find((m) => m.id === selectedGlomerularDisease) || GLOMERULAR_MODULES[0]

  // Active filter count for Question Bank compact toolbar
  const activeFilterCount =
    (source ? 1 : 0) +
    (topic ? 1 : 0) +
    (target ? 1 : 0) +
    (tag ? 1 : 0) +
    (status ? 1 : 0) +
    (attemptFilter ? 1 : 0) +
    (recent ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (sortOrder !== 'default' ? 1 : 0)

  // Top 4px animated progress bar percentage & compact X / Y counter
  const blockCompletedCount = activeExamIds ? activeExamIds.filter((id) => Boolean(blockAnswers[id])).length : 0
  const blockStepPct =
    isInsideExamBlock && activeExamIds && activeExamIds.length > 0
      ? Math.round(((activeExamIndex + 1) / activeExamIds.length) * 100)
      : 0
  const topProgressPct =
    isInsideExamBlock && activeExamIds && activeExamIds.length > 0
      ? Math.round(
          ((blockCompletedCount * 0.65 + (activeExamIndex + (blockAnswers[activeExamIds[activeExamIndex]] ? 1 : 0.35)) * 0.35) /
            activeExamIds.length) *
            100
        )
      : totalAvailable > 0
      ? Math.round((attemptedCount / totalAvailable) * 100)
      : 0

  return (
    <div className="luminaShell">
      {/* Sleek Top Animated Progress Bar (animates fluidly on question navigation and status updates) */}
      <div
        className="topProgressTrack"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={topProgressPct}
        aria-label="Question completion progress"
      >
        {isInsideExamBlock && (
          <div className="topProgressStepFill" style={{ width: `${blockStepPct}%` }} />
        )}
        <div className="topProgressFill" style={{ width: `${topProgressPct}%` }} />
      </div>

      {/* Top Navigation Bar — Hidden while inside an active practice block so only the block is visible */}
      {!isInsideExamBlock && (
        <header className="luminaHeader">
          <a
            href="#top"
            className="luminaBrand"
            onClick={(e) => {
              e.preventDefault()
              setNavTab('Dashboard')
            }}
          >
            <svg width="34" height="28" viewBox="0 0 34 28" fill="none" aria-hidden="true">
              <path d="M2 6L10.5 6L16 22L7.5 22L2 6Z" fill="#85dba9" />
              <path d="M18 4L32 4L24.5 24L13.5 24L18 4Z" fill="#19b368" />
            </svg>
            <div className="luminaBrandTextWrap">
              <span>Question Atlas</span>
              <small className="luminaBrandSub">ANCA-Associated Vasculitis</small>
            </div>
          </a>

          {/* Center Floating White Pill Navigation */}
          <nav className="luminaNavPill" aria-label="Question bank navigation">
            {(['Dashboard', 'Create Test', 'Question Bank', 'Glomerular Topics', 'Author'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className="luminaNavBtn"
                aria-pressed={navTab === tab}
                onClick={() => {
                  if (tab === 'Create Test') {
                    openCreateTestConfigurator()
                  } else {
                    setNavTab(tab)
                  }
                }}
              >
                {tab === 'Glomerular Topics' ? 'AAV Domains' : tab}
              </button>
            ))}
          </nav>

          {/* Consolidated De-noised Right Header Controls: X/Y Counter + PixelFiltrateDrop, Theme Toggle, Settings */}
          <div className="luminaActionCluster">
            <button
              type="button"
              className="compactProgressCounter"
              title={`Completed / Total ANCA Vasculitis Questions · Current Streak: ${correctStreak}`}
              onClick={() => openFilteredQBank({ attemptFilter: '' })}
            >
              {companionIcons ? (
                <PixelFiltrateDrop size={16} active={correctStreak >= 3} />
              ) : (
                <span className="compactProgressDot" aria-hidden="true" />
              )}
              <strong>{attemptedCount}</strong>
              <span>/</span>
              <span>{totalAvailable}</span>
            </button>

            <button
              type="button"
              className="luminaIconBtn"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="luminaIconBtn"
                aria-label="Flagged questions and stats controls"
                title="Flagged questions & reset/settings controls"
                aria-expanded={showNotifications}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {flaggedCount > 0 && <span className="luminaIconBadge">{flaggedCount}</span>}
              </button>
              {showNotifications && (
                <div
                  className="facetPanel animatePopover"
                  style={{ right: 0, left: 'auto', width: 320, padding: 14 }}
                  role="dialog"
                  aria-label="Flagged review and progress controls"
                >
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>QBank Stats &amp; Settings</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {correctCount} Correct ({correctPct}%) · {wrongCount} Wrong ({wrongPct}%) · {flaggedCount} Flagged ({flaggedPct}%) · Streak: {correctStreak}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      aria-pressed={companionIcons}
                      style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px' }}
                      onClick={() => setCompanionIcons((prev) => !prev)}
                    >
                      <span>Companion Icons</span>
                      <strong>{companionIcons ? 'On' : 'Off'}</strong>
                    </button>
                    <button
                      type="button"
                      className="createExamBtn"
                      style={{ width: '100%', justifyContent: 'center', padding: '9px 12px' }}
                      onClick={() => {
                        setShowNotifications(false)
                        openFilteredQBank({ attemptFilter: 'flagged' })
                      }}
                    >
                      Filter by Flagged ({flaggedCount})
                    </button>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      style={{ width: '100%', justifyContent: 'center', padding: '8px 12px' }}
                      onClick={() => {
                        setShowNotifications(false)
                        createNewQuestionRecord()
                      }}
                    >
                      + Author New ANCA Question
                    </button>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      style={{ width: '100%', justifyContent: 'center', padding: '8px 12px' }}
                      onClick={() => {
                        handleResetAllProgress()
                        setShowNotifications(false)
                      }}
                    >
                      Clear All Answers &amp; Flags
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main id="library">
        {/* Welcome Hero Row — Hidden while inside an active practice block so only the block is visible */}
        {!isInsideExamBlock && (
          <div className="welcomeRow">
            <h1 className="welcomeTitle">
              Welcome, Test User · <span>Course Progress: {courseProgressPct}%</span>
            </h1>
            {navTab === 'Dashboard' && (
              <div className="welcomeActions">
                <button
                  type="button"
                  className="studyPlanBtn"
                  onClick={() => setShowStudyPlanBanner((prev) => !prev)}
                >
                  <span>✦</span>
                  <span>Create Study Plan</span>
                </button>
                <button
                  type="button"
                  className="createExamBtn"
                  onClick={() => openCreateTestConfigurator()}
                >
                  <span>+</span>
                  <span>Create Test</span>
                </button>
              </div>
            )}
            {navTab === 'Create Test' && (
              <div className="welcomeActions">
                <button
                  type="button"
                  className="secondaryPillBtn"
                  onClick={() => openFilteredQBank({ attemptFilter: 'flagged' })}
                >
                  ★ Flagged ({flaggedCount})
                </button>
                <button
                  type="button"
                  className="createExamBtn"
                  onClick={() => openCreateTestConfigurator()}
                >
                  <span>+</span>
                  <span>Create Test</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            1. HOMEPAGE DASHBOARD (85% Correct, 10% Wrong, 5% Flagged Analytics)
           ==================================================================== */}
        {navTab === 'Dashboard' && (
          <>
            {/* IN-FLOW ADAPTIVE STUDY PLAN ARCHITECTURE (STUDY PLAN LOGIC)
                Appears naturally in flow with the rest of the Dashboard (never in a randomly placed floating window!) */}
            {showStudyPlanLogicModal && (
              <section
                id="study-plan-logic-panel"
                className="studyPlanBanner"
                style={{ borderColor: 'var(--emerald)', background: 'var(--bg-card)' }}
                aria-label="Study Plan Logic"
              >
                <div className="cardHeaderRow" style={{ marginBottom: 12 }}>
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        background: 'var(--emerald-soft)',
                        color: 'var(--emerald)',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: 6,
                      }}
                    >
                      Adaptive Study Plan Architecture
                    </span>
                    <h2 className="cardTitle" style={{ fontSize: 19 }}>
                      Study Plan Logic · Step-by-Step Breakdown
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                      How the <strong>Create Study Plan</strong> feature evaluates your performance ({correctPct}% Correct · {wrongPct}% Incorrect · {flaggedPct}% Flagged across {totalAvailable} questions):
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      onClick={() => {
                        setShowStudyPlanBanner(true)
                      }}
                    >
                      Customize Study Plan Mix
                    </button>
                    <button
                      type="button"
                      className="createExamBtn"
                      onClick={() => {
                        setShowStudyPlanLogicModal(false)
                        handleLaunchStudyPlanBlock()
                      }}
                    >
                      Launch Weak-Area Quiz Mix ({adaptiveStudyPlan.questionIds.length} QS) →
                    </button>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      aria-label="Close Study Plan Logic"
                      onClick={() => setShowStudyPlanLogicModal(false)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="studyPlanLogicGrid3">
                  {/* Step 1 */}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-card)',
                      borderRadius: 16,
                      padding: '15px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span className="accordionStepCircle" style={{ background: '#19b368', color: '#fff' }}>
                          1
                        </span>
                        <strong style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>
                          1. It analyzes your historical accuracy across all glomerular disease sub-topics.
                        </strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Aggregates every attempt and flag across all 8 sub-topics in real time to calculate your live correctness rate (%):
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {[...targetPerformanceMetrics]
                        .sort((a, b) => a.accuracy - b.accuracy)
                        .map((m) => (
                          <span
                            key={m.name}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: m.accuracy < 60 ? 'var(--coral-soft)' : m.accuracy < 80 ? 'var(--amber-soft)' : 'var(--emerald-soft)',
                              color: m.accuracy < 60 ? 'var(--coral)' : m.accuracy < 80 ? 'var(--amber)' : 'var(--emerald)',
                            }}
                          >
                            {m.shortLabel}: {m.accuracy}%
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-card)',
                      borderRadius: 16,
                      padding: '15px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span className="accordionStepCircle" style={{ background: '#ea582c', color: '#fff' }}>
                          2
                        </span>
                        <strong style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>
                          2. It identifies &apos;weak areas&apos; where performance is below 60%.
                        </strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Isolates sub-topics falling strictly below the <strong>60% mastery threshold</strong> for immediate clinical remediation:
                      </p>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {targetPerformanceMetrics
                        .filter((m) => m.accuracy < 60)
                        .sort((a, b) => a.accuracy - b.accuracy)
                        .map((m) => (
                          <div
                            key={m.name}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 6,
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-card)',
                              borderRadius: 10,
                              padding: '6px 10px',
                              fontSize: 12,
                            }}
                          >
                            <strong style={{ color: 'var(--coral)' }}>{m.name}</strong>
                            <span style={{ fontWeight: 700, color: 'var(--coral)' }}>
                              {m.accuracy}% ({m.correct}/{m.total} Correct)
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-card)',
                      borderRadius: 16,
                      padding: '15px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span className="accordionStepCircle" style={{ background: 'var(--dark-cta)', color: '#fff' }}>
                          3
                        </span>
                        <strong style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>
                          3. It generates a custom quiz mix prioritizing these weak topics to help bridge knowledge gaps.
                        </strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Builds a weighted {studyPlanBlockSize}-question practice block pulling <strong>Incorrect</strong> &amp; <strong>Flagged</strong> items first and hiding prior answers:
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {adaptiveStudyPlan.allocations.map((alloc) => (
                        <span
                          key={alloc.name}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-card)',
                            borderRadius: 8,
                            padding: '4px 8px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {alloc.shortLabel}: <strong>+{alloc.allocatedCount} QS</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ADAPTIVE STUDY PLAN PANEL — Scoped strictly to Dashboard so it NEVER persists across other tabs */}
            {showStudyPlanBanner && (
              <section className="studyPlanBanner" aria-label="Personalized Adaptive Study Plan">
                <div className="cardHeaderRow" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: '#19b368',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 999,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Adaptive Study Plan Engine
                      </span>
                      <h2 className="cardTitle" style={{ fontSize: 18.5 }}>
                        Personalized Weak-Area Recovery Plan ({adaptiveStudyPlan.questionIds.length} Questions)
                      </h2>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                      Based on your current bank stats ({correctPct}% Correct · {wrongPct}% Wrong · {flaggedPct}% Flagged),
                      the engine identified your weak areas (&lt;60% accuracy) and built a custom remediation mix below.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      onClick={() => setShowStudyPlanLogicModal((prev) => !prev)}
                    >
                      ℹ {showStudyPlanLogicModal ? 'Hide Study Plan Logic' : 'Study Plan Logic'}
                    </button>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      onClick={() => {
                        openCreateTestConfigurator({
                          targets: adaptiveStudyPlan.weakTargetNames,
                          poolMode: 'incorrect',
                          initialStep: 4,
                        })
                        setShowStudyPlanBanner(false)
                      }}
                    >
                      Open in Custom Test Builder
                    </button>
                    <button type="button" className="createExamBtn" onClick={handleLaunchStudyPlanBlock}>
                      Start Study Plan Block ({adaptiveStudyPlan.questionIds.length} Fresh QS) →
                    </button>
                    <button
                      type="button"
                      className="secondaryPillBtn"
                      aria-label="Close study plan"
                      onClick={() => setShowStudyPlanBanner(false)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Customization Controls for the Study Plan */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 14,
                    border: '1px solid var(--border-card)',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--emerald)' }}>Customize Study Plan Mix:</span>
                    <div className="seg" style={{ marginBottom: 0, padding: 3 }}>
                      {(
                        [
                          ['wrong-first', 'Prioritize Wrong → Flagged → Reinforcement'],
                          ['flagged-first', 'Prioritize Flagged → Wrong → Reinforcement'],
                          ['balanced', 'Balanced Weak-Topic Mix'],
                        ] as const
                      ).map(([ruleKey, label]) => (
                        <button
                          key={ruleKey}
                          type="button"
                          style={{ padding: '4px 10px', fontSize: 11.5 }}
                          aria-pressed={studyPlanPriorityRule === ruleKey}
                          onClick={() => setStudyPlanPriorityRule(ruleKey)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Plan Size:</span>
                    {([12, 16, 20] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className="qcardSolveBtn"
                        style={{
                          background: studyPlanBlockSize === sz ? 'var(--dark-cta)' : 'var(--bg-card)',
                          color: studyPlanBlockSize === sz ? '#fff' : 'var(--text-primary)',
                        }}
                        onClick={() => setStudyPlanBlockSize(sz)}
                      >
                        {sz} QS
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4 Weakest Sub-Topics Selected by the Algorithm */}
                <div className="studyPlanGrid">
                  {adaptiveStudyPlan.allocations.map((item, idx) => (
                    <div key={item.name} className="studyPlanTopicCard">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: item.accuracy < 60 ? 'var(--coral)' : 'var(--amber)',
                            background: item.accuracy < 60 ? 'var(--coral-soft)' : 'var(--amber-soft)',
                            padding: '2px 8px',
                            borderRadius: 999,
                          }}
                        >
                          {item.accuracy < 60 ? `Weak Area (<60%) #${idx + 1}` : `Review Area #${idx + 1}`} · +{item.allocatedCount} QS
                        </span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: item.accuracy < 60 ? 'var(--coral)' : 'var(--amber)' }}>
                          {item.accuracy}% Correct
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.reason}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--emerald)', fontWeight: 600 }}>
                        Mix: {item.wrongInChosen} Wrong retry + {item.flaggedInChosen} Flagged + {item.reinforcementInChosen} Reinforcement
                      </div>
                      <button
                        type="button"
                        className="qcardSolveBtn"
                        style={{ marginTop: 4 }}
                        onClick={() => {
                          openCreateTestConfigurator({ targets: [item.name], initialStep: 4 })
                          setShowStudyPlanBanner(false)
                        }}
                      >
                        Practice {item.shortLabel} Only ({item.total} QS) →
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ================================================================
                1. PRIORITIZED TOP STATS BAND (Headline Session KPI Strip)
                Single hairline-divided horizontal strip displaying 4 animated
                count-up metrics right at the top of the main dashboard view.
               ================================================================ */}
            <div style={{ marginBottom: 20 }}>
              <StatsBand
                accuracyPct={correctPct}
                completedCount={attemptedCount}
                totalCount={totalAvailable}
                correctCount={correctCount}
                wrongCount={wrongCount}
                streakCount={correctStreak}
                flaggedCount={flaggedCount}
                notesCount={notesCount}
                showCompanionIcons={companionIcons}
                onClickAccuracy={() => openFilteredQBank({ attemptFilter: 'correct' })}
                onClickCompleted={() => openFilteredQBank({ attemptFilter: '' })}
                onClickStreak={() => openFilteredQBank({ attemptFilter: 'correct' })}
                onClickFlagged={() => openFilteredQBank({ attemptFilter: 'flagged' })}
              />
            </div>

            {/* ================================================================
                2. CLINICAL DOMAIN SUMMARY CARDS (Replaces Polygon Graphs & Question Atlas Matrix)
                A single, clear summary card for each clinical topic, decision target,
                and landmark trial/guideline in the question bank.
               ================================================================ */}
            <div style={{ marginBottom: 20 }}>
              <VasculitisDomainRadar
                metrics={sixAxisVasculitisMetrics}
                targetMetrics={targetPerformanceMetrics}
                sourceMetrics={sourcePerformanceMetrics}
                showCompanionIcons={companionIcons}
                onSelectDomain={(topicName) => {
                  openCreateTestConfigurator({ topics: [topicName], targets: [], sources: [], initialStep: 4 })
                }}
                onSelectTarget={(targetName) => {
                  openCreateTestConfigurator({ targets: [targetName], topics: [], sources: [], initialStep: 4 })
                }}
                onSelectSource={(sourceName) => {
                  openCreateTestConfigurator({ sources: [sourceName], targets: [], topics: [], initialStep: 4 })
                }}
                onOpenStudyPlan={() => {
                  setShowStudyPlanBanner((prev) => !prev)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                onOpenStudyPlanLogic={() => {
                  setShowStudyPlanLogicModal((prev) => !prev)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </div>

            {/* ================================================================
                3. CLEAN COLLAPSIBLE 'ANALYTICS' SECTION
                Houses detailed charts & pool distribution collapsed by default
                so the primary dashboard remains focused and uncluttered.
               ================================================================ */}
            <details className="secondaryAnalyticsDrawer">
              <summary className="secondaryAnalyticsSummary">
                <div>
                  <strong>Analytics · Detailed Performance &amp; Question Pool Breakdown</strong>
                  <span className="secondaryAnalyticsSub">
                    8 Decision Targets · 12 Landmark Trials &amp; KDIGO 2024 · {GLOMERULAR_MODULES.length} Glomerular Modules
                  </span>
                </div>
                <span className="secondaryAnalyticsToggleLabel">Expand Analytics ▾</span>
              </summary>

              <div className="secondaryAnalyticsBody">
                <div className="chartsRow" style={{ marginTop: 16 }}>
                  <section className="dashboardCard" aria-label="ANCA-Vasculitis Subject Progress">
                    <div className="cardHeaderRow">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <h2 className="cardTitle">Subject Mastery Breakdown</h2>
                        <div className="seg" style={{ marginBottom: 0, padding: 3 }}>
                          <button
                            type="button"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            aria-pressed={chartSplitMode === 'target'}
                            onClick={() => {
                              setChartSplitMode('target')
                              setSelectedBarIdx(0)
                            }}
                          >
                            Decision Targets (8)
                          </button>
                          <button
                            type="button"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            aria-pressed={chartSplitMode === 'source'}
                            onClick={() => {
                              setChartSplitMode('source')
                              setSelectedBarIdx(0)
                            }}
                          >
                            Trials &amp; KDIGO (12)
                          </button>
                          <button
                            type="button"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            aria-pressed={chartSplitMode === 'topic'}
                            onClick={() => {
                              setChartSplitMode('topic')
                              setSelectedBarIdx(0)
                            }}
                          >
                            Clinical Topics
                          </button>
                        </div>
                      </div>

                      <div className="chartLegend">
                        <span className="legendItem">
                          <i className="legendDot" style={{ background: '#19b368' }} />
                          <span>Correct ({correctCount})</span>
                        </span>
                        <span className="legendItem">
                          <i className="legendDot" style={{ background: '#cbe8d7' }} />
                          <span>Wrong / Flagged ({wrongCount + flaggedCount})</span>
                        </span>
                      </div>
                    </div>

                    <div className="courseChartArea">
                      <div className="yAxisLabels" aria-hidden="true">
                        <span>{maxBarTotal}</span>
                        <span>{Math.round(maxBarTotal * 0.75)}</span>
                        <span>{Math.round(maxBarTotal * 0.5)}</span>
                        <span>{Math.round(maxBarTotal * 0.25)}</span>
                        <span>0</span>
                      </div>

                      <div className="barsArea">
                        <div className="gridLinesOverlay" aria-hidden="true">
                          <div className="gridLineDash" />
                          <div className="gridLineDash" />
                          <div className="gridLineDash" />
                          <div className="gridLineDash" />
                          <div className="gridLineDash" />
                        </div>

                        {chartBars.map((col, idx) => {
                          const isActive = idx === safeSelectedBarIdx
                          const totalH = Math.max(18, Math.round((col.total / maxBarTotal) * 192))
                          const completedH =
                            col.total > 0
                              ? col.completed > 0
                                ? Math.max(12, Math.round((col.completed / col.total) * totalH))
                                : 0
                              : 0

                          return (
                            <div
                              key={col.key}
                              className="barCol"
                              role="button"
                              tabIndex={0}
                              data-active={isActive}
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => {
                                setSelectedBarIdx(idx)
                              }}
                              onClick={() => {
                                setSelectedBarIdx(idx)
                                if (chartSplitMode === 'target') {
                                  openCreateTestConfigurator({
                                    domain: col.key,
                                    targets: [col.key],
                                    topics: [],
                                    sources: [],
                                    initialStep: 4,
                                  })
                                } else if (chartSplitMode === 'source') {
                                  openCreateTestConfigurator({
                                    domain: col.key,
                                    sources: [col.key],
                                    targets: [],
                                    topics: [],
                                    initialStep: 4,
                                  })
                                } else {
                                  openCreateTestConfigurator({
                                    domain: col.key,
                                    topics: [col.key],
                                    targets: [],
                                    sources: [],
                                    initialStep: 4,
                                  })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedBarIdx(idx)
                                  if (chartSplitMode === 'target') {
                                    openCreateTestConfigurator({
                                      domain: col.key,
                                      targets: [col.key],
                                      topics: [],
                                      sources: [],
                                      initialStep: 4,
                                    })
                                  } else if (chartSplitMode === 'source') {
                                    openCreateTestConfigurator({
                                      domain: col.key,
                                      sources: [col.key],
                                      targets: [],
                                      topics: [],
                                      initialStep: 4,
                                    })
                                  } else {
                                    openCreateTestConfigurator({
                                      domain: col.key,
                                      topics: [col.key],
                                      targets: [],
                                      sources: [],
                                      initialStep: 4,
                                    })
                                  }
                                }
                              }}
                              title={`Click to create test on ${col.fullTitle} — ${col.accuracy}% Correct (${col.correct}/${col.total})`}
                            >
                              <div className="barTrackWrap">
                                <div className="barHatched" style={{ height: `${totalH}px` }}>
                                  {completedH > 0 && <div className="barSolid" style={{ height: `${completedH}px` }} />}
                                </div>
                              </div>
                              <span className="barMonthLabel">{col.shortLabel}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {activeBar && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: '1px solid var(--border-inner)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 10,
                          fontSize: 13,
                        }}
                      >
                        <span>
                          Selected Subject: <strong>{activeBar.fullTitle}</strong> ·{' '}
                          {activeBar.total} Available · {activeBar.correct} Correct ({activeBar.accuracy}%) ·{' '}
                          {activeBar.remaining} Wrong/Flagged
                        </span>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="secondaryPillBtn"
                            onClick={() => {
                              if (chartSplitMode === 'target') {
                                openFilteredQBank({ target: activeBar.key })
                              } else if (chartSplitMode === 'source') {
                                openFilteredQBank({ source: activeBar.key })
                              } else {
                                openFilteredQBank({ topic: activeBar.key })
                              }
                            }}
                          >
                            Browse in QBank ({activeBar.total})
                          </button>
                          <button
                            type="button"
                            className="createExamBtn"
                            style={{ padding: '7px 14px', fontSize: 12.5 }}
                            onClick={() => {
                              if (chartSplitMode === 'target') {
                                openCreateTestConfigurator({ targets: [activeBar.key], topics: [], sources: [], initialStep: 4 })
                              } else if (chartSplitMode === 'source') {
                                openCreateTestConfigurator({ sources: [activeBar.key], targets: [], topics: [], initialStep: 4 })
                              } else {
                                openCreateTestConfigurator({ topics: [activeBar.key], targets: [], sources: [], initialStep: 4 })
                              }
                            }}
                          >
                            Create Test on {activeBar.fullTitle} ({activeBar.total} QS) →
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="dashboardCard" aria-label="ANCA-Vasculitis semicircle pie chart">
                    <div className="cardHeaderRow" style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h2 className="cardTitle">Question Pool</h2>
                        <div className="seg" style={{ marginBottom: 0, padding: 3 }}>
                          <button
                            type="button"
                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                            aria-pressed={semiPieMode === 'subjects'}
                            onClick={() => setSemiPieMode('subjects')}
                          >
                            Subjects
                          </button>
                          <button
                            type="button"
                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                            aria-pressed={semiPieMode === 'status'}
                            onClick={() => setSemiPieMode('status')}
                          >
                            Answer Status
                          </button>
                        </div>
                      </div>

                      <select
                        className="monthSelectPill"
                        aria-label="Filter pool by guideline or trial"
                        value={gaugeSubjectFilter}
                        onChange={(e) => setGaugeSubjectFilter(e.target.value)}
                      >
                        <option value="All ANCA Vasculitis">All Vasculitis ({rows.length})</option>
                        {labels.map((s) => (
                          <option key={s} value={s}>
                            {s} ({sourceCounts[s] || 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="examGaugeWrap">
                      <svg className="examGaugeSvg" viewBox="0 0 280 162" aria-label="Semicircle question distribution pie chart">
                        <defs>
                          <pattern id="gaugeHatch" width="6.5" height="6.5" patternTransform="rotate(-28 0 0)" patternUnits="userSpaceOnUse">
                            <rect width="6.5" height="6.5" fill="#ebf6ef" />
                            <line x1="0" y1="0" x2="0" y2="6.5" stroke="#b5ddc5" strokeWidth="3.4" />
                          </pattern>
                        </defs>

                        {semiPieSlices.map((slice, idx) => (
                          <path
                            key={slice.id}
                            d={slice.path}
                            fill={slice.fill}
                            className="semiPieSlice"
                            data-active={activePieSliceIdx === idx}
                            onMouseEnter={() => setActivePieSliceIdx(idx)}
                            onMouseLeave={() => setActivePieSliceIdx(null)}
                            onClick={slice.onClick}
                          >
                            <title>{`${slice.label}: ${slice.count} questions (${slice.pct}%)`}</title>
                          </path>
                        ))}
                      </svg>

                      <div className="examGaugeCenter">
                        <div className="examGaugeTotal">
                          {hoveredPieSlice ? hoveredPieSlice.count : gaugeTotal}
                        </div>
                        <div className="examGaugeSub">
                          {hoveredPieSlice ? `${hoveredPieSlice.label} (${hoveredPieSlice.pct}%)` : 'Total Questions'}
                        </div>
                      </div>
                    </div>

                    <div className="examLegendGrid">
                      {semiPieSlices.map((slice, idx) => (
                        <button
                          key={slice.id}
                          type="button"
                          className="examLegendBtn"
                          data-active={activePieSliceIdx === idx}
                          onMouseEnter={() => setActivePieSliceIdx(idx)}
                          onMouseLeave={() => setActivePieSliceIdx(null)}
                          onClick={slice.onClick}
                        >
                          <i className="legendSwatch" style={{ background: slice.swatch }} />
                          <span>
                            {slice.label} <strong>({slice.count})</strong>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </details>
          </>
        )}

        {/* ====================================================================
            2. CREATE TEST VIEW (Progressive Collapsible Accordion Builder)
            - Target Pace appears ONLY when Timed Mode is selected (not Tutor Mode).
            - Re-attempting any question in a new block NEVER shows previous answers.
           ==================================================================== */}
        {navTab === 'Create Test' && (
          <>
            {!activeExamIds ? (
              <section className="testBuilderCard" aria-label="Custom Test Generator">
                <div className="cardHeaderRow">
                  <div>
                    <h2 className="cardTitle">Create Custom Practice Test</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                      Configure your test step-by-step below. Any previously attempted questions open completely fresh
                      with previous answers hidden so you can genuinely re-attempt them. ({matchingBuilderPool.length}{' '}
                      matching questions available)
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="studyPlanBtn"
                      onClick={() => {
                        setActiveDrillDownDomain(null)
                        setSelectedTargets(adaptiveStudyPlan.weakTargetNames)
                        syncTagsForTopicsAndTargets(selectedTopics, adaptiveStudyPlan.weakTargetNames)
                        setOpenAccordionStep(4)
                      }}
                      title="Auto-select your 4 weakest vasculitis sub-topics based on accuracy data"
                    >
                      <span>✦</span>
                      <span>Load Weakest Sub-Topics</span>
                    </button>
                    <button
                      type="button"
                      className="createExamBtn"
                      disabled={matchingBuilderPool.length === 0}
                      style={{ opacity: matchingBuilderPool.length === 0 ? 0.5 : 1 }}
                      onClick={handleStartConfiguredTest}
                    >
                      Start Test ({Math.min(testCount, matchingBuilderPool.length)} Questions) →
                    </button>
                  </div>
                </div>

                {/* ==========================================================
                    TOP QUESTION COUNT & BLOCK SIZE BAR (5, 10, 20, 40 + Custom Question Count)
                    Updates the exam state (`testCount`) directly from anywhere on the page.
                   ========================================================== */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    padding: '12px 16px',
                    marginBottom: 14,
                    borderRadius: 14,
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-card)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginRight: 4 }}>
                      Block Question Count:
                    </span>
                    {[5, 10, 20, 40].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        className="builderChoiceBtn"
                        style={{ padding: '6px 12px', fontSize: 12.5 }}
                        aria-pressed={testCount === cnt}
                        onClick={() => {
                          setTestCount(cnt)
                          setCustomTestCountInput(String(cnt))
                        }}
                      >
                        <span>{cnt} Questions</span>
                      </button>
                    ))}
                    <label
                      htmlFor="custom-question-count-top"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-card)',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span>Custom Question Count</span>
                      <input
                        id="custom-question-count-top"
                        type="number"
                        min={1}
                        max={Math.max(1, totalAvailable)}
                        value={customTestCountInput}
                        aria-label="Custom Question Count"
                        placeholder="Enter count"
                        style={{
                          width: 72,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border-card)',
                          background: 'var(--bg-subtle)',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: 13,
                          textAlign: 'center',
                        }}
                        onChange={(e) => {
                          const rawVal = e.target.value
                          setCustomTestCountInput(rawVal)
                          const parsed = parseInt(rawVal, 10)
                          if (!Number.isNaN(parsed) && parsed >= 1) {
                            setTestCount(Math.min(totalAvailable, parsed))
                          }
                        }}
                        onBlur={() => {
                          const parsed = parseInt(customTestCountInput, 10)
                          const valid =
                            !Number.isNaN(parsed) && parsed >= 1
                              ? Math.min(totalAvailable, parsed)
                              : Math.max(1, Math.min(testCount, totalAvailable))
                          setTestCount(valid)
                          setCustomTestCountInput(String(valid))
                        }}
                      />
                    </label>
                  </div>

                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Matching Filter Pool: <strong style={{ color: 'var(--text-primary)' }}>{matchingBuilderPool.length}</strong> QS ·{' '}
                    Exam Size: <strong style={{ color: 'var(--emerald)' }}>{Math.min(testCount, matchingBuilderPool.length)}</strong> QS
                  </span>
                </div>

                {/* ==========================================================
                    QUICK DOMAIN DRILL-DOWN SYNCHRONIZER PILLS
                    Clicking any domain (e.g., Diagnosis, Dosing & timing, Induction therapy)
                    synchronizes its corresponding Clinical Topics, Decision Targets, and Clinical Tags.
                   ========================================================== */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginRight: 4 }}>
                    Quick Domain Filter Sync:
                  </span>
                  {[
                    { key: 'ALL', label: 'All Domains' },
                    { key: 'Induction therapy', label: 'Induction' },
                    { key: 'Diagnosis', label: 'Diagnosis' },
                    { key: 'Dosing & timing', label: 'Dosing' },
                    { key: 'Maintenance therapy', label: 'Maintenance' },
                    { key: 'Disease assessment', label: 'Disease Assessment' },
                    { key: 'Trial outcomes', label: 'Trial Outcomes' },
                    { key: 'Trial eligibility', label: 'Trial Eligibility' },
                    { key: 'Safety & monitoring', label: 'Safety & Monitoring' },
                  ].map((dom) => {
                    const isAll = dom.key === 'ALL'
                    const isSelected = isAll
                      ? selectedTopics.length === 0 &&
                        selectedTargets.length === 0 &&
                        selectedTags.length === 0 &&
                        !activeDrillDownDomain
                      : activeDrillDownDomain === dom.key ||
                        selectedTopics.includes(dom.key) ||
                        selectedTargets.includes(dom.key)
                    return (
                      <button
                        key={dom.key}
                        type="button"
                        className="qcardSolveBtn"
                        aria-pressed={isSelected}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          borderColor: isSelected ? 'var(--emerald)' : undefined,
                          background: isSelected ? 'var(--emerald-soft)' : undefined,
                          color: isSelected ? 'var(--emerald)' : undefined,
                          fontWeight: isSelected ? 700 : 500,
                        }}
                        onClick={() => {
                          if (isAll) {
                            setActiveDrillDownDomain(null)
                            setSelectedTopics([])
                            setSelectedTargets([])
                            setSelectedTags([])
                            setSelectedSources([])
                          } else {
                            setActiveDrillDownDomain(dom.key)
                            const syncEntry = domainFilterSyncMap[dom.key]
                            if (syncEntry) {
                              setSelectedTopics(syncEntry.topics)
                              setSelectedTargets(syncEntry.targets)
                              setSelectedTags(syncEntry.tags)
                            }
                            setOpenAccordionStep(4)
                            setOpenSubDrawerTopics(true)
                            setOpenSubDrawerTargets(true)
                            setOpenSubDrawerTags(true)
                          }
                        }}
                      >
                        {dom.label}
                      </button>
                    )
                  })}
                </div>

                <div className="accordionStack">
                  {/* ==========================================================
                      ACCORDION STEP 1: Test Mode (and Target Pace ONLY in Timed Mode)
                     ========================================================== */}
                  <div className="accordionItem" data-open={openAccordionStep === 1}>
                    <button
                      type="button"
                      className="accordionHeaderBtn"
                      aria-expanded={openAccordionStep === 1}
                      onClick={() => setOpenAccordionStep(1)}
                    >
                      <div className="accordionHeaderLeft">
                        <span className="accordionStepCircle">1</span>
                        <span className="accordionTitle">Select Test Mode</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="accordionSummaryText">
                          {testMode === 'Timed' ? `Timed Mode · ${recommendedSeconds}s/Q Pace` : 'Tutor Mode'}
                        </span>
                        <span className="accordionChevron">{openAccordionStep === 1 ? '▴' : '▾'}</span>
                      </div>
                    </button>

                    {openAccordionStep === 1 && (
                      <div className="accordionBody">
                        <div className="builderStepTitle" style={{ marginTop: 4 }}>
                          Choose Practice Mode
                        </div>
                        <div className="builderPillsRow">
                          {(['Tutor', 'Timed'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              className="builderChoiceBtn"
                              aria-pressed={testMode === m}
                              onClick={() => {
                                setTestMode(m)
                                if (m === 'Tutor') {
                                  setOpenAccordionStep(2)
                                }
                              }}
                            >
                              <span>{m} Mode</span>
                              <span className="builderCountTag">
                                {m === 'Tutor' ? 'Untimed · Immediate answer & explanation' : 'Timed exam simulation'}
                              </span>
                            </button>
                          ))}
                        </div>

                        {testMode === 'Timed' && (
                          <>
                            <div className="builderStepTitle" style={{ marginTop: 14 }}>
                              Target Pace per Question (Timed Mode Focus Alert Threshold)
                            </div>
                            <div className="builderPillsRow" style={{ marginBottom: 14 }}>
                              {[
                                { secs: 60, label: '60s (1:00 / Q)', tag: 'Rapid Board Pace' },
                                { secs: 90, label: '90s (1:30 / Q)', tag: 'Standard Exam Pace' },
                                { secs: 120, label: '120s (2:00 / Q)', tag: 'Extended Pace' },
                                { secs: 150, label: '150s (2:30 / Q)', tag: 'Deep Review Pace' },
                              ].map((p) => (
                                <button
                                  key={p.secs}
                                  type="button"
                                  className="builderChoiceBtn"
                                  aria-pressed={recommendedSeconds === p.secs}
                                  onClick={() => {
                                    setRecommendedSeconds(p.secs)
                                    setOpenAccordionStep(2)
                                  }}
                                >
                                  <span>{p.label}</span>
                                  <span className="builderCountTag">{p.tag}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                          <button
                            type="button"
                            className="createExamBtn"
                            style={{ padding: '8px 16px', fontSize: 13 }}
                            onClick={() => setOpenAccordionStep(2)}
                          >
                            Continue to Question Status →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ==========================================================
                      ACCORDION STEP 2: Question Status Pool
                     ========================================================== */}
                  <div className="accordionItem" data-open={openAccordionStep === 2}>
                    <button
                      type="button"
                      className="accordionHeaderBtn"
                      aria-expanded={openAccordionStep === 2}
                      onClick={() => setOpenAccordionStep(2)}
                    >
                      <div className="accordionHeaderLeft">
                        <span className="accordionStepCircle">2</span>
                        <span className="accordionTitle">Select Question Status</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="accordionSummaryText">
                          {testPoolMode === 'unused'
                            ? `Unused (${unusedCount})`
                            : testPoolMode === 'incorrect'
                            ? `Incorrect (${wrongCount})`
                            : testPoolMode === 'flagged'
                            ? `Flagged (${flaggedCount})`
                            : `All Questions (${totalAvailable})`}
                        </span>
                        <span className="accordionChevron">{openAccordionStep === 2 ? '▴' : '▾'}</span>
                      </div>
                    </button>

                    {openAccordionStep === 2 && (
                      <div className="accordionBody">
                        <div className="builderPillsRow" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="builderChoiceBtn"
                            aria-pressed={testPoolMode === 'all'}
                            onClick={() => {
                              setTestPoolMode('all')
                              setOpenAccordionStep(3)
                            }}
                          >
                            <span>All Available (Fresh Re-Attempt)</span>
                            <span className="builderCountTag">{totalAvailable}</span>
                          </button>
                          <button
                            type="button"
                            className="builderChoiceBtn"
                            aria-pressed={testPoolMode === 'incorrect'}
                            onClick={() => {
                              setTestPoolMode('incorrect')
                              setOpenAccordionStep(3)
                            }}
                          >
                            <span>Incorrect</span>
                            <span className="builderCountTag">{wrongCount}</span>
                          </button>
                          <button
                            type="button"
                            className="builderChoiceBtn"
                            aria-pressed={testPoolMode === 'flagged'}
                            onClick={() => {
                              setTestPoolMode('flagged')
                              setOpenAccordionStep(3)
                            }}
                          >
                            <span>Flagged for Review</span>
                            <span className="builderCountTag">{flaggedCount}</span>
                          </button>
                          <button
                            type="button"
                            className="builderChoiceBtn"
                            aria-pressed={testPoolMode === 'unused'}
                            onClick={() => {
                              setTestPoolMode('unused')
                              setOpenAccordionStep(3)
                            }}
                          >
                            <span>Unused (Unattempted Left)</span>
                            <span className="builderCountTag">{unusedCount}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ==========================================================
                      ACCORDION STEP 3: Glomerular Disease Topic
                     ========================================================== */}
                  <div className="accordionItem" data-open={openAccordionStep === 3}>
                    <button
                      type="button"
                      className="accordionHeaderBtn"
                      aria-expanded={openAccordionStep === 3}
                      onClick={() => setOpenAccordionStep(3)}
                    >
                      <div className="accordionHeaderLeft">
                        <span className="accordionStepCircle">3</span>
                        <span className="accordionTitle">Choose Glomerular Disease Topic</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="accordionSummaryText">ANCA-Associated Vasculitis ({totalAvailable} QS)</span>
                        <span className="accordionChevron">{openAccordionStep === 3 ? '▴' : '▾'}</span>
                      </div>
                    </button>

                    {openAccordionStep === 3 && (
                      <div className="accordionBody">
                        <div className="builderPillsRow" style={{ marginTop: 8 }}>
                          {GLOMERULAR_MODULES.map((mod) => (
                            <button
                              key={mod.id}
                              type="button"
                              className="builderChoiceBtn"
                              aria-pressed={mod.active}
                              disabled={!mod.active}
                              onClick={() => {
                                if (mod.active) setOpenAccordionStep(4)
                              }}
                              style={{
                                opacity: mod.active ? 1 : 0.55,
                                cursor: mod.active ? 'pointer' : 'not-allowed',
                              }}
                            >
                              <span>{mod.id}</span>
                              {mod.active ? (
                                <span className="builderCountTag">{totalAvailable} QS</span>
                              ) : (
                                <span className="builderCountTag">Upcoming</span>
                              )}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="createExamBtn"
                            style={{ padding: '8px 16px', fontSize: 13 }}
                            onClick={() => setOpenAccordionStep(4)}
                          >
                            Select Specific Sub-Topics &amp; Trials →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ==========================================================
                      ACCORDION STEP 4: Collapsible Sub-Accordions with Checkboxes
                      for Clinical Topics, Specific Decision Targets, Clinical Tags & Guidelines/Trials
                     ========================================================== */}
                  <div className="accordionItem" data-open={openAccordionStep === 4}>
                    <button
                      type="button"
                      className="accordionHeaderBtn"
                      aria-expanded={openAccordionStep === 4}
                      onClick={() => setOpenAccordionStep(4)}
                    >
                      <div className="accordionHeaderLeft">
                        <span className="accordionStepCircle">4</span>
                        <span className="accordionTitle">Select Specific Sub-Topics, Tags &amp; Guidelines</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="accordionSummaryText">
                          {selectedTopics.length === 0
                            ? 'All Clinical Topics'
                            : selectedTopics.join(', ')}{' '}
                          ·{' '}
                          {selectedTargets.length === 0
                            ? 'All 8 Targets'
                            : selectedTargets.join(', ')}{' '}
                          ·{' '}
                          {selectedTags.length === 0
                            ? 'All Clinical Tags'
                            : `${selectedTags.length} Tag${selectedTags.length > 1 ? 's' : ''}`}{' '}
                          ·{' '}
                          {selectedSources.length === 0
                            ? 'All 12 Trials/Guidelines'
                            : `${selectedSources.length} Source${selectedSources.length > 1 ? 's' : ''}`}
                        </span>
                        <span className="accordionChevron">{openAccordionStep === 4 ? '▴' : '▾'}</span>
                      </div>
                    </button>

                    {openAccordionStep === 4 && (
                      <div className="accordionBody">
                        {/* Active Filter Summary Strip when a specific Topic, Decision Target, Clinical Tag, or Trial is selected */}
                        {(selectedTopics.length > 0 ||
                          selectedTargets.length > 0 ||
                          selectedTags.length > 0 ||
                          selectedSources.length > 0) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 10,
                              padding: '10px 14px',
                              marginBottom: 12,
                              borderRadius: 12,
                              background: 'var(--emerald-soft)',
                              border: '1px solid var(--emerald)',
                              fontSize: 13,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong style={{ color: 'var(--emerald)' }}>
                                {activeDrillDownDomain && domainFilterSyncMap[activeDrillDownDomain]
                                  ? `Synchronized Domain Filter (${domainFilterSyncMap[activeDrillDownDomain].domainLabel}):`
                                  : 'Active Test Filter:'}
                              </strong>
                              {selectedTopics.map((tp) => (
                                <span
                                  key={`tp-${tp}`}
                                  className="builderCountTag"
                                  style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700 }}
                                >
                                  Topic: {tp} ({topicCounts[tp] || 0} QS)
                                </span>
                              ))}
                              {selectedTargets.map((tg) => (
                                <span
                                  key={`tg-${tg}`}
                                  className="builderCountTag"
                                  style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700 }}
                                >
                                  Target: {tg} ({targetCounts[tg] || 0} QS)
                                </span>
                              ))}
                              {selectedTags.map((tagName) => (
                                <span
                                  key={`tag-${tagName}`}
                                  className="builderCountTag"
                                  style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600 }}
                                >
                                  Tag: #{tagName} ({tagCounts[tagName] || 0} QS)
                                </span>
                              ))}
                              {selectedSources.map((sr) => (
                                <span
                                  key={`sr-${sr}`}
                                  className="builderCountTag"
                                  style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700 }}
                                >
                                  Source: {sr} ({sourceCounts[sr] || 0} QS)
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="qcardSolveBtn"
                              style={{ fontSize: 11.5, padding: '4px 10px' }}
                              onClick={() => {
                                setActiveDrillDownDomain(null)
                                setSelectedTopics([])
                                setSelectedTargets([])
                                setSelectedTags([])
                                setSelectedSources([])
                              }}
                            >
                              Clear All Selections
                            </button>
                          </div>
                        )}

                        <div className="subAccordionGrid">
                          {/* Sub-Accordion A: Clinical Topics (Induction therapy, Diagnosis, Dosing & timing, Maintenance, etc.) */}
                          <div className="subAccordionBox">
                            <button
                              type="button"
                              className="subAccordionToggle"
                              aria-expanded={openSubDrawerTopics}
                              onClick={() => setOpenSubDrawerTopics((o) => !o)}
                            >
                              <span>
                                Clinical Topics ({selectedTopics.length === 0 ? 'All Selected' : `${selectedTopics.length} Selected`})
                              </span>
                              <span>{openSubDrawerTopics ? '▴' : '▾'}</span>
                            </button>

                            {openSubDrawerTopics && (
                              <div className="subAccordionContent">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => setSelectedTopics([])}
                                  >
                                    Include All Topics ({totalAvailable})
                                  </button>
                                </div>

                                {sixAxisVasculitisMetrics.map((m) => {
                                  const isChecked = selectedTopics.includes(m.id)
                                  return (
                                    <label
                                      key={m.id}
                                      className="checkboxOptionRow"
                                      data-checked={isChecked}
                                      style={{ margin: 0 }}
                                    >
                                      <span className="checkboxLeft">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleTopicSelection(m.id)}
                                        />
                                        <span>{m.label}</span>
                                      </span>
                                      <span className="builderCountTag">
                                        {m.accuracy}% · {m.total} QS
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Sub-Accordion B: Decision Targets */}
                          <div className="subAccordionBox">
                            <button
                              type="button"
                              className="subAccordionToggle"
                              aria-expanded={openSubDrawerTargets}
                              onClick={() => setOpenSubDrawerTargets((o) => !o)}
                            >
                              <span>
                                Decision Targets ({selectedTargets.length === 0 ? 'All 8 Selected' : `${selectedTargets.length} Selected`})
                              </span>
                              <span>{openSubDrawerTargets ? '▴' : '▾'}</span>
                            </button>

                            {openSubDrawerTargets && (
                              <div className="subAccordionContent">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => setSelectedTargets([])}
                                  >
                                    Include All Targets ({totalAvailable})
                                  </button>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => setSelectedTargets(adaptiveStudyPlan.weakTargetNames)}
                                  >
                                    ✦ Select Weakest 4
                                  </button>
                                </div>

                                {allTargets.map((t) => {
                                  const isChecked = selectedTargets.includes(t)
                                  const metric = targetPerformanceMetrics.find((m) => m.name === t)
                                  return (
                                    <label
                                      key={t}
                                      className="checkboxOptionRow"
                                      data-checked={isChecked}
                                      style={{ margin: 0 }}
                                    >
                                      <span className="checkboxLeft">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleTargetSelection(t)}
                                        />
                                        <span>{t}</span>
                                      </span>
                                      <span className="builderCountTag">
                                        {metric ? `${metric.accuracy}% · ` : ''}
                                        {targetCounts[t] || 0} QS
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Sub-Accordion C: Clinical Tags (Synchronized from Analytics Drill-Down) */}
                          <div className="subAccordionBox">
                            <button
                              type="button"
                              className="subAccordionToggle"
                              aria-expanded={openSubDrawerTags}
                              onClick={() => setOpenSubDrawerTags((o) => !o)}
                            >
                              <span>
                                Clinical Tags ({selectedTags.length === 0 ? `All ${allTags.length} Selected` : `${selectedTags.length} Selected`})
                              </span>
                              <span>{openSubDrawerTags ? '▴' : '▾'}</span>
                            </button>

                            {openSubDrawerTags && (
                              <div className="subAccordionContent">
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => {
                                      setActiveDrillDownDomain(null)
                                      setSelectedTags([])
                                    }}
                                  >
                                    Include All Tags ({totalAvailable})
                                  </button>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => {
                                      setActiveDrillDownDomain('Diagnosis')
                                    }}
                                  >
                                    Diagnosis Tags
                                  </button>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => {
                                      setActiveDrillDownDomain('Dosing & timing')
                                    }}
                                  >
                                    Dosing Tags
                                  </button>
                                </div>

                                {allTags.map((tg) => {
                                  const isChecked = selectedTags.includes(tg)
                                  return (
                                    <label
                                      key={tg}
                                      className="checkboxOptionRow"
                                      data-checked={isChecked}
                                      style={{ margin: 0 }}
                                    >
                                      <span className="checkboxLeft">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleTagSelection(tg)}
                                        />
                                        <span>{tg}</span>
                                      </span>
                                      <span className="builderCountTag">{tagCounts[tg] || 0} QS</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Sub-Accordion D: Guidelines & Landmark Trials */}
                          <div className="subAccordionBox">
                            <button
                              type="button"
                              className="subAccordionToggle"
                              aria-expanded={openSubDrawerSources}
                              onClick={() => setOpenSubDrawerSources((o) => !o)}
                            >
                              <span>
                                Guidelines &amp; Landmark Trials ({selectedSources.length === 0 ? 'All 12 Selected' : `${selectedSources.length} Selected`})
                              </span>
                              <span>{openSubDrawerSources ? '▴' : '▾'}</span>
                            </button>

                            {openSubDrawerSources && (
                              <div className="subAccordionContent">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => setSelectedSources([])}
                                  >
                                    Include All Trials &amp; KDIGO ({totalAvailable})
                                  </button>
                                  <button
                                    type="button"
                                    className="qcardSolveBtn"
                                    style={{ fontSize: 11.5, padding: '3px 9px' }}
                                    onClick={() => setSelectedSources(['KDIGO 2024'])}
                                  >
                                    KDIGO 2024 Only
                                  </button>
                                </div>

                                {labels.map((s) => {
                                  const isChecked = selectedSources.includes(s)
                                  return (
                                    <label
                                      key={s}
                                      className="checkboxOptionRow"
                                      data-checked={isChecked}
                                      style={{ margin: 0 }}
                                    >
                                      <span className="checkboxLeft">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleSourceSelection(s)}
                                        />
                                        <span>{s}</span>
                                      </span>
                                      <span className="builderCountTag">{sourceCounts[s] || 0} QS</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                            marginTop: 14,
                            paddingTop: 12,
                            borderTop: '1px solid var(--border-inner)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 4 }}>
                              Matching Pool: <strong style={{ color: 'var(--text-primary)' }}>{matchingBuilderPool.length}</strong> QS · Block Size:
                            </span>
                            {[5, 10, 20, 40].map((cnt) => (
                              <button
                                key={cnt}
                                type="button"
                                className="builderChoiceBtn"
                                style={{ padding: '5px 10px', fontSize: 12 }}
                                aria-pressed={testCount === cnt}
                                onClick={() => {
                                  setTestCount(cnt)
                                  setCustomTestCountInput(String(cnt))
                                }}
                              >
                                <span>{cnt} QS</span>
                              </button>
                            ))}
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 10,
                                border: '1px solid var(--border-card)',
                                background: 'var(--bg-subtle)',
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}
                            >
                              <span>Custom Question Count</span>
                              <input
                                type="number"
                                min={1}
                                max={Math.max(1, totalAvailable)}
                                value={customTestCountInput}
                                aria-label="Custom Question Count"
                                placeholder="#"
                                style={{
                                  width: 64,
                                  padding: '3px 6px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border-card)',
                                  background: 'var(--bg-card)',
                                  color: 'var(--text-primary)',
                                  fontWeight: 700,
                                  fontSize: 12.5,
                                  textAlign: 'center',
                                }}
                                onChange={(e) => {
                                  const rawVal = e.target.value
                                  setCustomTestCountInput(rawVal)
                                  const parsed = parseInt(rawVal, 10)
                                  if (!Number.isNaN(parsed) && parsed >= 1) {
                                    setTestCount(Math.min(totalAvailable, parsed))
                                  }
                                }}
                                onBlur={() => {
                                  const parsed = parseInt(customTestCountInput, 10)
                                  const valid =
                                    !Number.isNaN(parsed) && parsed >= 1
                                      ? Math.min(totalAvailable, parsed)
                                      : Math.max(1, Math.min(testCount, totalAvailable))
                                  setTestCount(valid)
                                  setCustomTestCountInput(String(valid))
                                }}
                              />
                            </label>
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="secondaryPillBtn"
                              style={{ padding: '8px 14px', fontSize: 12.5 }}
                              onClick={() => setOpenAccordionStep(5)}
                            >
                              Step 5: Block Size →
                            </button>
                            <button
                              type="button"
                              className="createExamBtn"
                              disabled={matchingBuilderPool.length === 0}
                              style={{
                                padding: '8px 16px',
                                fontSize: 13,
                                opacity: matchingBuilderPool.length === 0 ? 0.5 : 1,
                              }}
                              onClick={handleStartConfiguredTest}
                            >
                              Start Test ({Math.min(testCount, matchingBuilderPool.length)} Questions) →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ==========================================================
                      ACCORDION STEP 5: Number of Questions (Presets + Custom Input) & Launch Block
                     ========================================================== */}
                  <div className="accordionItem" data-open={openAccordionStep === 5}>
                    <button
                      type="button"
                      className="accordionHeaderBtn"
                      aria-expanded={openAccordionStep === 5}
                      onClick={() => setOpenAccordionStep(5)}
                    >
                      <div className="accordionHeaderLeft">
                        <span className="accordionStepCircle">5</span>
                        <span className="accordionTitle">Select Block Size &amp; Start Test</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="accordionSummaryText">
                          {Math.min(testCount, matchingBuilderPool.length)} Questions Ready
                        </span>
                        <span className="accordionChevron">{openAccordionStep === 5 ? '▴' : '▾'}</span>
                      </div>
                    </button>

                    {openAccordionStep === 5 && (
                      <div className="accordionBody">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 16,
                            flexWrap: 'wrap',
                            marginTop: 8,
                          }}
                        >
                          <div className="builderPillsRow" style={{ marginBottom: 0, alignItems: 'center' }}>
                            {[5, 10, 20, 40].map((cnt) => (
                              <button
                                key={cnt}
                                type="button"
                                className="builderChoiceBtn"
                                aria-pressed={testCount === cnt}
                                onClick={() => {
                                  setTestCount(cnt)
                                  setCustomTestCountInput(String(cnt))
                                }}
                              >
                                <span>{cnt} Questions</span>
                              </button>
                            ))}

                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 12px',
                                borderRadius: 12,
                                border: '1px solid var(--border-card)',
                                background: 'var(--bg-subtle)',
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}
                            >
                              <span>Custom Question Count</span>
                              <input
                                type="number"
                                min={1}
                                max={Math.max(1, totalAvailable)}
                                value={customTestCountInput}
                                aria-label="Custom Question Count"
                                placeholder="Custom #"
                                style={{
                                  width: 72,
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  border: '1px solid var(--border-card)',
                                  background: 'var(--bg-card)',
                                  color: 'var(--text-primary)',
                                  fontWeight: 700,
                                  fontSize: 13.5,
                                  textAlign: 'center',
                                }}
                                onChange={(e) => {
                                  const rawVal = e.target.value
                                  setCustomTestCountInput(rawVal)
                                  const parsed = parseInt(rawVal, 10)
                                  if (!Number.isNaN(parsed) && parsed >= 1) {
                                    setTestCount(Math.min(totalAvailable, parsed))
                                  }
                                }}
                                onBlur={() => {
                                  const parsed = parseInt(customTestCountInput, 10)
                                  const valid =
                                    !Number.isNaN(parsed) && parsed >= 1
                                      ? Math.min(totalAvailable, parsed)
                                      : Math.max(1, Math.min(testCount, totalAvailable))
                                  setTestCount(valid)
                                  setCustomTestCountInput(String(valid))
                                }}
                              />
                              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                QS (max {Math.max(1, matchingBuilderPool.length)})
                              </span>
                            </label>
                          </div>

                          <button
                            type="button"
                            className="createExamBtn"
                            disabled={matchingBuilderPool.length === 0}
                            style={{ opacity: matchingBuilderPool.length === 0 ? 0.5 : 1 }}
                            onClick={handleStartConfiguredTest}
                          >
                            Start Test ({Math.min(testCount, matchingBuilderPool.length)} Questions) →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              activeExamQuestion && (
                <section className="examSessionBanner" aria-label={isBlockSubmitted ? 'End-of-Block Question & Answer Review' : 'Active Practice Exam Block'}>
                  {!isBlockSubmitted ? (
                    (() => {
                      const completedInBlockCount = activeExamIds.filter((id) => Boolean(blockAnswers[id])).length
                      const leftInBlockCount = Math.max(0, activeExamIds.length - completedInBlockCount)
                      return (
                        <>
                          {/* De-noised Active Block Top Bar */}
                          <div className="cardHeaderRow" style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="sidebarToggleBtn"
                                aria-pressed={isExamNavDrawerOpen}
                                onClick={() => setIsExamNavDrawerOpen((prev) => !prev)}
                                title="Toggle Question Navigator ([)"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2.5" />
                                  <line x1="9" y1="3" x2="9" y2="21" />
                                </svg>
                                <span>Navigator ({activeExamIndex + 1}/{activeExamIds.length})</span>
                                <kbd className="kbdHint">[</kbd>
                              </button>

                              <span
                                className="blockModeBadge"
                                data-mode={testMode.toLowerCase()}
                              >
                                {testMode === 'Timed'
                                  ? '⏱ TIMED MODE · ANSWERS HIDDEN'
                                  : '📖 TUTOR MODE · IMMEDIATE RATIONALE'}
                              </span>

                              <span className="blockProgressPillBadge">
                                {companionIcons && <PixelFiltrateDrop size={16} active={correctStreak >= 3} />}
                                <span>
                                  <strong>{completedInBlockCount}</strong> / <strong>{activeExamIds.length}</strong> · Left:{' '}
                                  <strong>{leftInBlockCount}</strong>
                                </span>
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>

                              <button
                                type="button"
                                className="luminaIconBtn"
                                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                              >
                                {theme === 'dark' ? (
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                                    <circle cx="12" cy="12" r="5" />
                                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                  </svg>
                                ) : (
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                  </svg>
                                )}
                              </button>

                              <button
                                type="button"
                                className="endBlockTriggerBtn"
                                aria-expanded={showEndBlockConfirm}
                                onClick={handleOpenEndBlockConfirm}
                              >
                                ✕ End Block
                              </button>
                            </div>
                          </div>

                          {/* Smooth Top Block Progress Bar (animates fluidly on moving between questions or updating status) */}
                          <div
                            className="blockInlineProgressTrack"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={activeExamIds.length}
                            aria-valuenow={completedInBlockCount}
                            aria-label="Block question navigation and completion progress"
                          >
                            <div
                              className="blockInlineProgressStepFill"
                              style={{
                                width: `${Math.round(((activeExamIndex + 1) / activeExamIds.length) * 100)}%`,
                              }}
                            />
                            <div
                              className="blockInlineProgressFill"
                              style={{
                                width: `${Math.round((completedInBlockCount / activeExamIds.length) * 100)}%`,
                              }}
                            />
                          </div>

                          {/* Collapsible Slide-Over Question Navigator Drawer (Toggled via `[` or Navigator button) */}
                          <div
                            className="smoothAccordionWrap"
                            data-open={isExamNavDrawerOpen}
                            aria-hidden={!isExamNavDrawerOpen}
                          >
                            <div className="smoothAccordionInner">
                              <div className="examNavDrawerPanel">
                                <div className="examNavDrawerHeader">
                                  <span>
                                    <strong>Question Navigator</strong> · Click any item or use{' '}
                                    <kbd className="kbdHint">←</kbd> / <kbd className="kbdHint">→</kbd> arrows
                                  </span>
                                  <button
                                    type="button"
                                    className="structuredLabToggleBtn"
                                    onClick={() => setIsExamNavDrawerOpen(false)}
                                  >
                                    Hide Navigator <kbd className="kbdHint">[</kbd>
                                  </button>
                                </div>
                                <div className="examPillTrack" role="tablist" aria-label="Exam question navigator">
                                  {activeExamIds.map((qId, idx) => {
                                    const blockAttempt = blockAnswers[qId]
                                    const statusAttr = blockAttempt
                                      ? testMode === 'Timed'
                                        ? 'answered'
                                        : blockAttempt.correct
                                        ? 'correct'
                                        : 'incorrect'
                                      : undefined
                                    const isQFlagged = flaggedIds.includes(qId)
                                    return (
                                      <button
                                        key={qId}
                                        type="button"
                                        className="examStepPill"
                                        data-current={idx === activeExamIndex}
                                        data-status={statusAttr}
                                        onClick={() => setActiveExamIndex(idx)}
                                        title={`Question ${idx + 1}${isQFlagged ? ' (Flagged for Review)' : ''}`}
                                      >
                                        {idx + 1}
                                        {isQFlagged && <span className="examStepFlagDot" aria-hidden="true" />}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Focus Timer Component: shown ONLY in active Timed Mode */}
                          {testMode === 'Timed' && (
                            <FocusTimer
                              questionId={activeExamQuestion.id}
                              questionNumber={activeExamIndex + 1}
                              elapsedMap={questionElapsedMap}
                              setElapsedMap={setQuestionElapsedMap}
                              recommendedSeconds={recommendedSeconds}
                              isFlagged={flaggedIds.includes(activeExamQuestion.id)}
                              onToggleFlag={handleToggleFlag}
                              hasNextQuestion={activeExamIndex + 1 < activeExamIds.length}
                              onNextQuestion={() =>
                                setActiveExamIndex(Math.min(activeExamIds.length - 1, activeExamIndex + 1))
                              }
                            />
                          )}

                          {/* Distraction-Free Centered Reading Column (max-w-3xl / max-w-4xl) */}
                          <div className="distractionFreeReadingColumn">
                            <Reader
                              key={activeExamQuestion.id}
                              question={activeExamQuestion}
                              savedChoice={blockAnswers[activeExamQuestion.id]?.choice}
                              isFlagged={flaggedIds.includes(activeExamQuestion.id)}
                              hasNote={Boolean(notes[activeExamQuestion.id]?.trim())}
                              examMode={testMode}
                              isReviewMode={false}
                              showCompanionIcons={companionIcons}
                              questionNumberLabel={`Question ${activeExamIndex + 1} of ${activeExamIds.length}`}
                              peerAccuracyRate={questionCorrectnessRates[activeExamQuestion.id]}
                              elapsedSeconds={questionElapsedMap[activeExamQuestion.id]}
                              onOpenNoteModal={() => openQuestion(activeExamQuestion, 'Notes')}
                              onToggleFlag={handleToggleFlag}
                              onPickChoice={handleRecordBlockAttempt}
                            />

                            <div className="paginationBar" style={{ marginTop: 18 }}>
                              <button
                                type="button"
                                className="sourceBtn"
                                disabled={activeExamIndex === 0}
                                onClick={() => setActiveExamIndex(Math.max(0, activeExamIndex - 1))}
                              >
                                ← Previous <kbd className="kbdHint">←</kbd>
                              </button>
                              <span>
                                Question <strong>{activeExamIndex + 1}</strong> of <strong>{activeExamIds.length}</strong> ·{' '}
                                Completed: <strong>{completedInBlockCount}</strong> · Left: <strong>{leftInBlockCount}</strong>
                              </span>
                              {activeExamIndex + 1 < activeExamIds.length ? (
                                <button
                                  type="button"
                                  className="sourceBtn"
                                  onClick={() => setActiveExamIndex(Math.min(activeExamIds.length - 1, activeExamIndex + 1))}
                                >
                                  Next Question <kbd className="kbdHint">→</kbd>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="endBlockTriggerBtn"
                                  aria-expanded={showEndBlockConfirm}
                                  onClick={handleOpenEndBlockConfirm}
                                >
                                  End Block →
                                </button>
                              )}
                            </div>

                            {/* End Block Confirmation Options Positioned at the Bottom for Easy Transition */}
                            {showEndBlockConfirm && (
                              <div
                                id="end-block-confirm-panel"
                                className="endBlockConfirmBox animateQuestionSlide"
                                style={{ marginTop: 16, marginBottom: 0 }}
                                role="alertdialog"
                                aria-labelledby="end-block-confirm-title"
                              >
                                <div className="endBlockConfirmTop">
                                  <div>
                                    <h3 id="end-block-confirm-title" className="endBlockConfirmTitle">
                                      End or Exit Current Practice Block?
                                    </h3>
                                    <p className="endBlockConfirmText">
                                      Choose whether to review your answers for this block or exit directly to the dashboard:
                                    </p>
                                  </div>
                                  <div className="endBlockNumericStrip" aria-label="Block completion count indicator">
                                    <div className="endBlockNumericItem" data-tone="completed">
                                      <span>Completed</span>
                                      <strong>{completedInBlockCount}</strong>
                                    </div>
                                    <div className="endBlockNumericItem" data-tone="left">
                                      <span>Questions Left</span>
                                      <strong>{leftInBlockCount}</strong>
                                    </div>
                                    <div className="endBlockNumericItem" data-tone="total">
                                      <span>Block Total</span>
                                      <strong>{activeExamIds.length}</strong>
                                    </div>
                                  </div>
                                </div>

                                <div className="endBlockConfirmActions">
                                  <button
                                    type="button"
                                    className="secondaryPillBtn"
                                    onClick={() => setShowEndBlockConfirm(false)}
                                  >
                                    ↩ Continue Block ({leftInBlockCount} Left)
                                  </button>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      className="createExamBtn"
                                      onClick={handleFinishBlockReview}
                                    >
                                      ✓ End Block &amp; Review All Answers
                                    </button>
                                    <button
                                      type="button"
                                      className="endBlockExitBtn"
                                      onClick={() => {
                                        setShowEndBlockConfirm(false)
                                        setIsBlockSubmitted(false)
                                        setActiveExamIds(null)
                                        setNavTab('Dashboard')
                                      }}
                                    >
                                      Exit Block to Dashboard
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )
                    })()
                  ) : (
                    (() => {
                      const blockQuestions = activeExamIds
                        .map((id, idx) => ({ q: rows.find((r) => r.id === id), idx }))
                        .filter((item): item is { q: Q; idx: number } => Boolean(item.q))
                      const blockAnsweredCount = activeExamIds.filter((id) => Boolean(blockAnswers[id])).length
                      const blockCorrectCount = activeExamIds.filter((id) => blockAnswers[id]?.correct).length
                      const blockIncorrectCount = activeExamIds.filter(
                        (id) => Boolean(blockAnswers[id]) && !blockAnswers[id].correct
                      ).length
                      const blockUnansweredCount = activeExamIds.length - blockAnsweredCount
                      const blockFlaggedCount = activeExamIds.filter((id) => flaggedIds.includes(id)).length
                      const blockAccuracyPct = Math.round(
                        (blockCorrectCount / Math.max(1, activeExamIds.length)) * 100
                      )

                      const filteredReviewQuestions = blockQuestions.filter(({ q }) => {
                        const att = blockAnswers[q.id]
                        if (blockReviewFilter === 'correct') return Boolean(att?.correct)
                        if (blockReviewFilter === 'incorrect') return Boolean(att && !att.correct)
                        if (blockReviewFilter === 'unanswered') return !att
                        if (blockReviewFilter === 'flagged') return flaggedIds.includes(q.id)
                        return true
                      })

                      return (
                        <div className="blockReviewWorkspace">
                          <div className="blockReviewSummaryCard">
                            <div className="cardHeaderRow" style={{ marginBottom: 14 }}>
                              <div className="completionSummaryTitleGroup">
                                {companionIcons && (
                                  <div
                                    className="completionSummaryMascotWrap"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                  >
                                    <PixelKidneyMascot
                                      size={48}
                                      mood={blockAccuracyPct >= 70 ? 'trophy' : 'idle'}
                                    />
                                    <PixelKidneyPair
                                      size={40}
                                      masteryPercent={blockAccuracyPct}
                                    />
                                  </div>
                                )}
                                <div>
                                  <span className="blockModeBadge" data-mode="review">
                                    ✓ END-OF-BLOCK REVIEW · {testMode.toUpperCase()} MODE COMPLETE
                                  </span>
                                  <h2 className="cardTitle" style={{ marginTop: 6 }}>
                                    Block Complete: Review All Questions &amp; Answers ({blockCorrectCount} / {activeExamIds.length} Correct · {blockAccuracyPct}%)
                                  </h2>
                                  <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                                    Review every question, your locked answer choice, the correct answer, and the complete KDIGO / clinical trial explanation below.
                                  </p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="companionTogglePill"
                                  aria-pressed={companionIcons}
                                  title="Toggle pixel nephrology companion icons on or off"
                                  onClick={() => setCompanionIcons((prev) => !prev)}
                                >
                                  <span>Companion Icons: {companionIcons ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="secondaryPillBtn"
                                  onClick={() => {
                                    setIsBlockSubmitted(false)
                                    setShowEndBlockConfirm(false)
                                    setActiveExamIds(null)
                                    setNavTab('Dashboard')
                                  }}
                                >
                                  ← Exit to Dashboard
                                </button>
                                <button
                                  type="button"
                                  className="createExamBtn"
                                  style={{ padding: '8px 16px', fontSize: 13 }}
                                  onClick={() => {
                                    setIsBlockSubmitted(false)
                                    setShowEndBlockConfirm(false)
                                    setActiveExamIds(null)
                                  }}
                                >
                                  + Create New Test Block
                                </button>
                              </div>
                            </div>

                            <div className="blockReviewMetricsRow">
                              <div className="blockReviewMetricChip" data-tone="score">
                                <span>Block Accuracy</span>
                                <strong>{blockAccuracyPct}% ({blockCorrectCount}/{activeExamIds.length})</strong>
                              </div>
                              <div className="blockReviewMetricChip" data-tone="correct">
                                <span>Correct</span>
                                <strong>{blockCorrectCount}</strong>
                              </div>
                              <div className="blockReviewMetricChip" data-tone="incorrect">
                                <span>Incorrect</span>
                                <strong>{blockIncorrectCount}</strong>
                              </div>
                              <div className="blockReviewMetricChip" data-tone="unanswered">
                                <span>Unanswered</span>
                                <strong>{blockUnansweredCount}</strong>
                              </div>
                              <div className="blockReviewMetricChip" data-tone="flagged">
                                <span>Flagged</span>
                                <strong>{blockFlaggedCount}</strong>
                              </div>
                            </div>

                            <div className="blockReviewControlsRow">
                              <div className="blockReviewFilterPills" role="group" aria-label="Filter block review questions">
                                {([
                                  { id: 'all', label: `All Questions (${activeExamIds.length})` },
                                  { id: 'incorrect', label: `Incorrect (${blockIncorrectCount})` },
                                  { id: 'correct', label: `Correct (${blockCorrectCount})` },
                                  { id: 'unanswered', label: `Unanswered (${blockUnansweredCount})` },
                                  { id: 'flagged', label: `Flagged (${blockFlaggedCount})` },
                                ] as const).map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    className="secondaryPillBtn"
                                    aria-pressed={blockReviewFilter === f.id}
                                    onClick={() => setBlockReviewFilter(f.id)}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>

                              <div className="seg" style={{ marginBottom: 0 }}>
                                <button
                                  type="button"
                                  aria-pressed={blockReviewLayout === 'all'}
                                  onClick={() => setBlockReviewLayout('all')}
                                >
                                  All Questions &amp; Answers ({filteredReviewQuestions.length})
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={blockReviewLayout === 'single'}
                                  onClick={() => setBlockReviewLayout('single')}
                                >
                                  Question-by-Question View
                                </button>
                              </div>
                            </div>
                          </div>

                          {blockReviewLayout === 'all' ? (
                            <div className="blockReviewList distractionFreeReadingColumn">
                              {filteredReviewQuestions.length === 0 ? (
                                <div className="blockReviewEmptyBox">
                                  {companionIcons && (
                                    <div style={{ marginBottom: 10 }}>
                                      <PixelBiopsySlide size={40} />
                                    </div>
                                  )}
                                  <p>No questions match your filters.</p>
                                  <button
                                    type="button"
                                    className="secondaryPillBtn"
                                    onClick={() => setBlockReviewFilter('all')}
                                  >
                                    Show All {activeExamIds.length} Block Questions
                                  </button>
                                </div>
                              ) : (
                                filteredReviewQuestions.map(({ q, idx }) => {
                                  const att = blockAnswers[q.id]
                                  const isExpanded = expandedReviewIds.includes(q.id)
                                  const statusTone = !att ? 'unanswered' : att.correct ? 'correct' : 'incorrect'
                                  const statusLabel = !att ? 'Unanswered' : att.correct ? '✓ Correct' : '✕ Wrong'

                                  return (
                                    <div
                                      key={q.id}
                                      className="blockReviewItemCard blockReviewAccordionCard"
                                      data-status={statusTone}
                                      data-expanded={isExpanded}
                                    >
                                      <button
                                        type="button"
                                        className="blockReviewAccordionHeaderBtn"
                                        aria-expanded={isExpanded}
                                        onClick={() => toggleReviewQuestionAccordion(q.id)}
                                      >
                                        <span className="blockReviewAccordionQNum">
                                          Question {idx + 1} of {activeExamIds.length}
                                        </span>
                                        <div className="blockReviewAccordionRight">
                                          <span
                                            className="blockReviewItemStatusPill"
                                            data-status={statusTone}
                                            style={{ marginBottom: 0 }}
                                          >
                                            {statusLabel}
                                          </span>
                                          <span className="blockReviewAccordionChevron" aria-hidden="true">
                                            {isExpanded ? '▴' : '▾'}
                                          </span>
                                        </div>
                                      </button>

                                      <div className="smoothAccordionWrap" data-open={isExpanded}>
                                        <div className="smoothAccordionInner">
                                          {isExpanded && (
                                            <div className="blockReviewAccordionBody">
                                              <Reader
                                                question={q}
                                                savedChoice={att?.choice}
                                                isFlagged={flaggedIds.includes(q.id)}
                                                hasNote={Boolean(notes[q.id]?.trim())}
                                                examMode={testMode}
                                                isReviewMode={true}
                                                showCompanionIcons={companionIcons}
                                                questionNumberLabel={`Question ${idx + 1} of ${activeExamIds.length} · ${q.title.split(' · ')[0]}`}
                                                peerAccuracyRate={questionCorrectnessRates[q.id]}
                                                elapsedSeconds={questionElapsedMap[q.id]}
                                                onOpenNoteModal={() => openQuestion(q, 'Notes')}
                                                onToggleFlag={handleToggleFlag}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          ) : (
                            <div className="distractionFreeReadingColumn">
                              <div className="examPillTrack" role="tablist" aria-label="Block review question navigator">
                                {activeExamIds.map((qId, idx) => {
                                  const blockAttempt = blockAnswers[qId]
                                  const statusAttr = blockAttempt
                                    ? blockAttempt.correct
                                      ? 'correct'
                                      : 'incorrect'
                                    : undefined
                                  const isQFlagged = flaggedIds.includes(qId)
                                  return (
                                    <button
                                      key={qId}
                                      type="button"
                                      className="examStepPill"
                                      data-current={idx === activeExamIndex}
                                      data-status={statusAttr}
                                      onClick={() => setActiveExamIndex(idx)}
                                      title={`Review Question ${idx + 1}${isQFlagged ? ' (Flagged)' : ''}`}
                                    >
                                      {idx + 1}
                                      {isQFlagged && <span className="examStepFlagDot" aria-hidden="true" />}
                                    </button>
                                  )
                                })}
                              </div>

                              <Reader
                                key={`review-${activeExamQuestion.id}`}
                                question={activeExamQuestion}
                                savedChoice={blockAnswers[activeExamQuestion.id]?.choice}
                                isFlagged={flaggedIds.includes(activeExamQuestion.id)}
                                hasNote={Boolean(notes[activeExamQuestion.id]?.trim())}
                                examMode={testMode}
                                isReviewMode={true}
                                showCompanionIcons={companionIcons}
                                questionNumberLabel={`Question ${activeExamIndex + 1} of ${activeExamIds.length}`}
                                peerAccuracyRate={questionCorrectnessRates[activeExamQuestion.id]}
                                elapsedSeconds={questionElapsedMap[activeExamQuestion.id]}
                                onOpenNoteModal={() => openQuestion(activeExamQuestion, 'Notes')}
                                onToggleFlag={handleToggleFlag}
                              />

                              <div className="paginationBar" style={{ marginTop: 16 }}>
                                <button
                                  type="button"
                                  className="sourceBtn"
                                  disabled={activeExamIndex === 0}
                                  onClick={() => setActiveExamIndex(Math.max(0, activeExamIndex - 1))}
                                >
                                  ← Previous <kbd className="kbdHint">←</kbd>
                                </button>
                                <span>
                                  Reviewing Question <strong>{activeExamIndex + 1}</strong> of{' '}
                                  <strong>{activeExamIds.length}</strong> · Final Block Score:{' '}
                                  <strong>{blockCorrectCount} / {activeExamIds.length} ({blockAccuracyPct}%)</strong>
                                </span>
                                <button
                                  type="button"
                                  className="sourceBtn"
                                  disabled={activeExamIndex + 1 >= activeExamIds.length}
                                  onClick={() =>
                                    setActiveExamIndex(Math.min(activeExamIds.length - 1, activeExamIndex + 1))
                                  }
                                >
                                  Next Question <kbd className="kbdHint">→</kbd>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()
                  )}
                </section>
              )
            )}
          </>
        )}

        {/* ====================================================================
            3. GLOMERULAR TOPICS VIEW (Multi-Disease Glomerular Curriculum Hub)
            Supports breaking down ANCA-Associated Vasculitis AND all other
            glomerular diseases (IgA Nephropathy, Lupus Nephritis, Membranous
            Nephropathy, Minimal Change Disease, and IRGN).
           ==================================================================== */}
        {navTab === 'Glomerular Topics' && (
          <>
            {/* Multi-Disease Glomerular Curriculum Switcher */}
            <section className="dashboardCard" style={{ marginBottom: 20 }} aria-label="Glomerular Disease Modules">
              <div className="cardHeaderRow" style={{ marginBottom: 8 }}>
                <div>
                  <h2 className="cardTitle">Glomerular Disease Curriculum &amp; Topic Breakdown</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                    Select any glomerular disease below to inspect its decision targets, KDIGO guidelines, and clinical
                    trial breakdowns, or author new questions directly into that disease module.
                  </p>
                </div>
              </div>

              <div className="glomerularModuleGrid" role="tablist" aria-label="Glomerular disease modules">
                {GLOMERULAR_MODULES.map((mod) => {
                  const isSelected = selectedGlomerularDisease === mod.id
                  const authoredForDisease =
                    mod.id === 'ANCA-Associated Vasculitis'
                      ? rows.length
                      : rows.filter((r) => r.disease === mod.id || r.topic === mod.id).length

                  return (
                    <button
                      key={mod.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-pressed={isSelected}
                      className="glomerularModuleTab"
                      onClick={() => setSelectedGlomerularDisease(mod.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: mod.active ? 'var(--emerald-soft)' : 'var(--purple-soft)',
                            color: mod.active ? 'var(--emerald)' : 'var(--purple)',
                          }}
                        >
                          {mod.active ? `${authoredForDisease} QS Active` : authoredForDisease > 0 ? `${authoredForDisease} QS Authored` : 'Curriculum Ready'}
                        </span>
                        {mod.active && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)' }}>{correctPct}% Acc</span>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{mod.id}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                          {mod.description}
                        </div>
                      </div>

                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                        {mod.plannedTargets.length} Decision Targets · {mod.plannedSources.length} Guidelines/Trials
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {selectedGlomerularDisease === 'ANCA-Associated Vasculitis' ? (
              <>
                {/* Subject-wise Performance Radar Chart for ANCA-Associated Vasculitis */}
                <SubjectWisePerformanceRadar
                  metrics={radarDimension === 'target' ? targetPerformanceMetrics : sourcePerformanceMetrics}
                  radarDimension={radarDimension}
                  onChangeDimension={setRadarDimension}
                  onSelectSubtopic={(subtopicName) => {
                    if (radarDimension === 'target') {
                      openCreateTestConfigurator({ targets: [subtopicName], initialStep: 4 })
                    } else {
                      openCreateTestConfigurator({ sources: [subtopicName], initialStep: 4 })
                    }
                  }}
                />

                {/* Active ANCA-Vasculitis Subject Split by Decision Targets */}
                <section className="dashboardCard" style={{ marginBottom: 20 }} aria-label="ANCA-Vasculitis Decision Targets">
                  <div className="cardHeaderRow">
                    <div>
                      <h2 className="cardTitle">ANCA-Associated Vasculitis · 8 Clinical Decision Targets</h2>
                      <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                        Questions split across the 8 clinical decision and interpretation target folders in the repository.
                      </p>
                    </div>
                  </div>

                  <div className="packageGrid">
                    {allTargets.map((t, i) => {
                      const pool = rows.filter((q) => (q.target || 'Unclassified') === t)
                      const corr = pool.filter((q) => attempts[q.id]?.correct === true).length
                      const wrong = pool.filter((q) => attempts[q.id]?.correct === false).length
                      const flag = pool.filter((q) => flaggedIds.includes(q.id)).length
                      const acc = pool.length > 0 ? Math.round((corr / pool.length) * 100) : 0
                      const accents = ['green', 'blue', 'purple', 'amber'] as const
                      const tone = accents[i % accents.length]
                      return (
                        <div key={t} className="packageCard">
                          <div className="metricCardTop" style={{ width: '100%' }}>
                            <div>
                              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{t}</div>
                              <div className="metricLabel">
                                {acc >= 80 ? 'Strong Area' : acc >= 60 ? 'Moderate Mastery' : 'Weak Area · Priority Review'}
                              </div>
                            </div>
                            <span className={`metricIconCircle ${tone}`} aria-hidden="true">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              </svg>
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            <span>
                              <strong style={{ color: 'var(--text-primary)' }}>{pool.length}</strong> QS ·{' '}
                              <strong style={{ color: 'var(--emerald)' }}>{corr}</strong> Right ·{' '}
                              <strong style={{ color: 'var(--coral)' }}>{wrong}</strong> Wrong ·{' '}
                              <strong style={{ color: 'var(--amber)' }}>{flag}</strong> Flag
                            </span>
                            <span
                              style={{
                                color: acc >= 80 ? 'var(--emerald)' : acc >= 60 ? 'var(--amber)' : 'var(--coral)',
                                fontWeight: 700,
                              }}
                            >
                              {acc}%
                            </span>
                          </div>

                          <BarcodeTicks
                            total={18}
                            filled={Math.min(18, Math.round((corr / Math.max(1, pool.length)) * 18))}
                            tone={acc >= 80 ? 'green' : acc >= 60 ? 'amber' : 'blue'}
                          />

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="qcardSolveBtn"
                              style={{ flex: 1 }}
                              onClick={() => openCreateTestConfigurator({ targets: [t], sources: [], initialStep: 4 })}
                            >
                              Practice Target
                            </button>
                            <button
                              type="button"
                              className="qcardSolveBtn"
                              onClick={() => openFilteredQBank({ target: t })}
                            >
                              Browse ({pool.length})
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Active ANCA-Vasculitis Split by Guideline & Clinical Trial Sources */}
                <section className="dashboardCard" style={{ marginBottom: 24 }} aria-label="ANCA-Vasculitis Trials and Guidelines">
                  <div className="cardHeaderRow">
                    <div>
                      <h2 className="cardTitle">ANCA-Associated Vasculitis · Guidelines &amp; Landmark Trials</h2>
                      <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                        Questions organized by KDIGO 2024 guideline recommendations and landmark vasculitis trials.
                      </p>
                    </div>
                  </div>

                  <div className="packageGrid">
                    {labels.map((s, i) => {
                      const pool = rows.filter((q) => q.source === s)
                      const corr = pool.filter((q) => attempts[q.id]?.correct === true).length
                      const wrong = pool.filter((q) => attempts[q.id]?.correct === false).length
                      const acc = pool.length > 0 ? Math.round((corr / pool.length) * 100) : 0
                      const accents = ['green', 'blue', 'purple', 'amber'] as const
                      const tone = accents[i % accents.length]
                      return (
                        <div key={s} className="packageCard">
                          <div className="metricCardTop" style={{ width: '100%' }}>
                            <div>
                              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{s}</div>
                              <div className="metricLabel">
                                {/^KDIGO/i.test(s) ? 'Clinical Practice Guideline' : 'Randomized Clinical Trial'}
                              </div>
                            </div>
                            <span className={`metricIconCircle ${tone}`} aria-hidden="true">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
                                <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
                              </svg>
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            <span>
                              <strong style={{ color: 'var(--text-primary)' }}>{pool.length}</strong> Available ·{' '}
                              <strong style={{ color: 'var(--emerald)' }}>{corr}</strong> Correct ·{' '}
                              <strong style={{ color: 'var(--coral)' }}>{wrong}</strong> Wrong
                            </span>
                            <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>{acc}%</span>
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="qcardSolveBtn"
                              style={{ flex: 1 }}
                              onClick={() => openCreateTestConfigurator({ sources: [s], targets: [], initialStep: 4 })}
                            >
                              Practice Source
                            </button>
                            <button
                              type="button"
                              className="qcardSolveBtn"
                              onClick={() => openFilteredQBank({ source: s })}
                            >
                              Browse ({pool.length})
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </>
            ) : (
              /* Dedicated ANCA-Associated Vasculitis Sub-Domain Breakdown View (KDIGO 2024, Induction Trials, or Maintenance Trials) */
              <section className="dashboardCard" style={{ marginBottom: 24 }} aria-label={`${activeGlomerularModule.id} Curriculum Breakdown`}>
                <div className="cardHeaderRow">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h2 className="cardTitle">{activeGlomerularModule.id} · Domain Breakdown</h2>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: 'var(--emerald-soft)',
                          color: 'var(--emerald)',
                        }}
                      >
                        {rows.filter((r) => activeGlomerularModule.plannedSources.includes(r.source)).length} Active ANCA Questions
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                      {activeGlomerularModule.description}. Click any decision target or trial below to practice immediately.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="createExamBtn"
                      onClick={() =>
                        openCreateTestConfigurator({
                          sources: activeGlomerularModule.plannedSources,
                          targets: [],
                          initialStep: 4,
                        })
                      }
                    >
                      Practice {activeGlomerularModule.shortName} →
                    </button>
                  </div>
                </div>

                <div className="subAccordionGrid" style={{ marginTop: 16 }}>
                  <div className="packageCard">
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                      {activeGlomerularModule.shortName} · Decision Targets
                    </div>
                    <div style={{ display: 'grid', gap: 8, width: '100%' }}>
                      {activeGlomerularModule.plannedTargets.map((pt) => {
                        const count = rows.filter(
                          (q) =>
                            activeGlomerularModule.plannedSources.includes(q.source) &&
                            (q.target || 'Unclassified') === pt
                        ).length
                        return (
                          <button
                            key={pt}
                            type="button"
                            className="checkboxOptionRow"
                            onClick={() =>
                              openCreateTestConfigurator({
                                sources: activeGlomerularModule.plannedSources,
                                targets: [pt],
                                initialStep: 4,
                              })
                            }
                          >
                            <span style={{ fontWeight: 600 }}>{pt}</span>
                            <span className="builderCountTag">{count} QS →</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="packageCard">
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                      {activeGlomerularModule.shortName} · Guidelines &amp; Landmark Trials
                    </div>
                    <div style={{ display: 'grid', gap: 8, width: '100%' }}>
                      {activeGlomerularModule.plannedSources.map((ps) => {
                        const count = sourceCounts[ps] || 0
                        return (
                          <button
                            key={ps}
                            type="button"
                            className="checkboxOptionRow"
                            onClick={() => openFilteredQBank({ source: ps })}
                          >
                            <span style={{ fontWeight: 600 }}>{ps}</span>
                            <span className="builderCountTag">{count} QS →</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ====================================================================
            4. AUTHOR WORKSPACE VIEW (Create, Edit, Tag & Review Questions)
           ==================================================================== */}
        {navTab === 'Author' && (
          <section className="dashboardCard" style={{ marginBottom: 24 }} aria-label="Question Authoring Studio">
            <div className="cardHeaderRow">
              <div>
                <h2 className="cardTitle">Author &amp; Editorial Studio</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  Author new ANCA-associated vasculitis questions, assign a decision target folder, add clinical
                  tags, and keep the guideline or trial name in source.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondaryPillBtn"
                  onClick={handleResetAllProgress}
                >
                  Clear All Answers &amp; Flags
                </button>
                <button
                  type="button"
                  className="secondaryPillBtn"
                  onClick={() => {
                    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rows, null, 2))
                    const a = document.createElement('a')
                    a.setAttribute('href', dataStr)
                    a.setAttribute('download', 'nephro-question-bank.json')
                    a.click()
                  }}
                >
                  Export Bank JSON
                </button>
                <button type="button" className="createExamBtn" onClick={() => createNewQuestionRecord()}>
                  + Author New Question
                </button>
              </div>
            </div>

            <div className="overviewCards3">
              <div className="metricCard">
                <div>
                  <div className="metricValue">{rows.length}</div>
                  <div className="metricLabel">Total Active Questions</div>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Split across {allTargets.length} target folders and {labels.length} trial/guideline sources
                </span>
              </div>
              <div className="metricCard">
                <div>
                  <div className="metricValue">{rows.filter((r) => r.status === 'In review').length}</div>
                  <div className="metricLabel">In Editorial Review</div>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Click any question below to edit stem, options A–E, notes, or rationale
                </span>
              </div>
              <div className="metricCard">
                <div>
                  <div className="metricValue">{allTags.length}</div>
                  <div className="metricLabel">Clinical Tags Indexed</div>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Includes Kidney biopsy, ANCA testing, Rituximab, Avacopan, Plasma exchange
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================================
            5. QUESTION BANK EXPLORER (Shown ONLY on Question Bank & Author tabs)
            - Single compact toolbar with Search + Dropdown Popovers (Topic, Status, Source, Difficulty/Accuracy)
            - Collapsible Sidebar / Navigator toggled via `[` keyboard shortcut
            - Clean, de-noised question row cards
           ==================================================================== */}
        {(navTab === 'Question Bank' || navTab === 'Author') && (
          <section className="qbankSection" id="qbank-workspace" aria-label="ANCA-associated vasculitis question bank">
            <div className="qbankTopBar">
              <div className="qbankHeadingGroup">
                <h2>
                  {navTab === 'Author'
                    ? 'Question Repository & Record Editor'
                    : 'ANCA-Associated Vasculitis Question Bank'}
                </h2>
                <p>
                  Showing <strong>{visible.length}</strong> of <strong>{rows.length}</strong> questions
                  {attemptFilter ? ` · Status: ${attemptFilter.toUpperCase()}` : ''}
                  {target ? ` · Target: ${target}` : ''}
                  {source ? ` · Source: ${source}` : ''}
                  {topic ? ` · Topic: ${topic}` : ''}
                  {tag ? ` · Tag: ${tag}` : ''}
                  {sortOrder !== 'default'
                    ? ` · Accuracy: ${sortOrder === 'rate-asc' ? 'Challenging First (Low → High)' : 'Highest Accuracy First'}`
                    : ''}
                </p>
              </div>
            </div>

            {/* Single Compact Filter Toolbar Row */}
            <SearchToolbar
              search={search}
              onSearch={F}
              recent={recent}
              onRecent={() => {
                R(!recent)
                if (!recent) {
                  G('')
                  H('')
                  V('')
                  S('')
                  T('')
                  F('')
                }
              }}
              sidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              activeFilterCount={activeFilterCount}
              onClearAll={() => {
                G('')
                S('')
                T('')
                H('')
                V('')
                F('')
                setAttemptFilter('')
                setSortOrder('default')
                R(false)
              }}
              facets={[
                { name: 'Topic', value: topic, options: topicList, change: T },
                {
                  name: 'Status',
                  value:
                    attemptFilter === 'unused'
                      ? 'Unanswered'
                      : attemptFilter === 'incorrect'
                      ? 'Incorrect'
                      : attemptFilter === 'correct'
                      ? 'Correct'
                      : attemptFilter === 'flagged'
                      ? 'Flagged'
                      : attemptFilter === 'notes'
                      ? 'With Notes'
                      : '',
                  options: ['Unanswered', 'Incorrect', 'Correct', 'Flagged', 'With Notes'],
                  change: (val: string) => {
                    if (val === 'Unanswered') setAttemptFilter('unused')
                    else if (val === 'Incorrect') setAttemptFilter('incorrect')
                    else if (val === 'Correct') setAttemptFilter('correct')
                    else if (val === 'Flagged') setAttemptFilter('flagged')
                    else if (val === 'With Notes') setAttemptFilter('notes')
                    else setAttemptFilter('')
                  },
                },
                {
                  name: 'Difficulty',
                  value:
                    sortOrder === 'rate-asc'
                      ? 'Challenging First'
                      : sortOrder === 'rate-desc'
                      ? 'High Accuracy First'
                      : '',
                  options: ['Challenging First', 'High Accuracy First'],
                  change: (val: string) => {
                    if (val === 'Challenging First') setSortOrder('rate-asc')
                    else if (val === 'High Accuracy First') setSortOrder('rate-desc')
                    else setSortOrder('default')
                  },
                },
                { name: 'Source', value: source, options: labels, change: S },
                { name: 'Tag', value: tag, options: allTags, change: H },
              ]}
            />

            <div className="indexLayout" id="index" data-sidebar-open={isSidebarOpen}>
              {/* Mobile/Tablet Backdrop when Slide-Over Drawer is open */}
              {isSidebarOpen && (
                <div
                  className="sidebarDrawerBackdrop"
                  aria-hidden="true"
                  onClick={() => setIsSidebarOpen(false)}
                />
              )}

              <aside
                className="targetIndex"
                data-open={isSidebarOpen}
                aria-label="Decision targets and trial sources"
              >
                <div className="sidebarDrawerMobileHeader">
                  <strong>Question Navigator</strong>
                  <button
                    type="button"
                    className="structuredLabToggleBtn"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Close ✕
                  </button>
                </div>

                <h3>Decision Targets</h3>
                <div className="targetLinks" style={{ marginBottom: 18 }}>
                  {['', ...allTargets].map((t) => {
                    const count = t ? targetCounts[t] || 0 : rows.length
                    return (
                      <button key={t} type="button" aria-pressed={target === t} onClick={() => G(t)}>
                        <span>{t || 'All targets'}</span>
                        <span className="targetCount">{count}</span>
                      </button>
                    )
                  })}
                </div>

                <h3>Trials &amp; Guidelines</h3>
                <div className="targetLinks">
                  {['', ...labels].map((s) => {
                    const count = s ? sourceCounts[s] || 0 : rows.length
                    return (
                      <button key={s} type="button" aria-pressed={source === s} onClick={() => S(s)}>
                        <span>{s || 'All sources'}</span>
                        <span className="targetCount">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </aside>

              <div className="indexResults">
                <div className="questionCards">
                  {visible.slice(currentPage * 10, currentPage * 10 + 10).map((q) => {
                    const codePart = q.title.split(' · ')[0]
                    const titlePart = q.title.split(' · ').slice(1).join(' · ') || q.title
                    const attempt = attempts[q.id]
                    const isFlagged = flaggedIds.includes(q.id)
                    const hasNote = Boolean(notes[q.id]?.trim())
                    const statusKey = attempt
                      ? attempt.correct
                        ? 'correct'
                        : 'incorrect'
                      : isFlagged
                      ? 'flagged'
                      : 'unused'

                    return (
                      <article className="qcard" key={q.id} data-flagged={isFlagged}>
                        <div className="qcardIdBadge">{codePart}</div>

                        <div className="qcardMain">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <button
                              type="button"
                              className="readLink"
                              style={{ marginBottom: 0 }}
                              onClick={() => openQuestion(q, navTab === 'Author' ? 'Edit record' : 'Read')}
                            >
                              {titlePart}
                            </button>
                            {hasNote && (
                              <button
                                type="button"
                                className="noteBadgeBtn"
                                onClick={() => openQuestion(q, 'Notes')}
                                title={`Saved Study Note: ${notes[q.id]}`}
                              >
                                <span>📝 Note</span>
                              </button>
                            )}
                          </div>
                          <p>{q.body}</p>
                          <div className="qcardMetaLine">
                            <button
                              type="button"
                              className="metaLinkBtn"
                              style={{ color: 'var(--emerald)' }}
                              onClick={() => G(q.target || 'Unclassified')}
                            >
                              {q.target || 'Unclassified'}
                            </button>
                            <span aria-hidden="true">·</span>
                            <button type="button" className="metaLinkBtn" onClick={() => S(q.source)}>
                              {q.source}
                            </button>
                            <span aria-hidden="true">·</span>
                            <button type="button" className="metaTagBtn" onClick={() => T(q.topic)}>
                              {q.topic}
                            </button>
                          </div>
                        </div>

                        <div className="qcardRight">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                            <span className="qcardStatusText" data-status={statusKey}>
                              {attempt
                                ? attempt.correct
                                  ? '✓ Correct'
                                  : '✕ Incorrect'
                                : isFlagged
                                ? '★ Flagged'
                                : 'Unanswered'}
                            </span>

                            <button
                              type="button"
                              className="flagToggleBtn"
                              aria-pressed={isFlagged}
                              aria-label={isFlagged ? `Unflag ${codePart}` : `Flag ${codePart} for review`}
                              onClick={() => handleToggleFlag(q.id)}
                              title={isFlagged ? 'Unflag question' : 'Flag for review'}
                            >
                              <span>{isFlagged ? '★' : '☆'}</span>
                            </button>

                            <button
                              type="button"
                              className="qcardSolveBtn"
                              onClick={() => openQuestion(q, navTab === 'Author' ? 'Edit record' : 'Read')}
                            >
                              {navTab === 'Author' ? 'Edit' : 'Practice →'}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}

                  {!visible.length && (
                    <div className="emptyFilterStateBox">
                      {companionIcons && (
                        <div className="emptyFilterSlideWrap">
                          <PixelBiopsySlide size={40} />
                        </div>
                      )}
                      <p style={{ marginBottom: 12 }}>
                        {attemptFilter === 'flagged'
                          ? 'No questions match your filters (no questions are currently flagged for review).'
                          : attemptFilter === 'notes'
                          ? 'No questions match your filters (no saved study notes yet).'
                          : 'No questions match your filters.'}
                      </p>
                      <button
                        type="button"
                        className="secondaryPillBtn"
                        onClick={() => {
                          G('')
                          S('')
                          T('')
                          H('')
                          V('')
                          F('')
                          setAttemptFilter('')
                          setSortOrder('default')
                          R(false)
                        }}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  )}
                </div>

                {visible.length > 10 && (
                  <nav className="paginationBar" aria-label="Question pages">
                    <button
                      type="button"
                      className="sourceBtn"
                      disabled={!currentPage}
                      onClick={() => {
                        P(currentPage - 1)
                        document.getElementById('qbank-workspace')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage + 1} of {Math.ceil(visible.length / 10)} ({visible.length} questions)
                    </span>
                    <button
                      type="button"
                      className="sourceBtn"
                      disabled={(currentPage + 1) * 10 >= visible.length}
                      onClick={() => {
                        P(currentPage + 1)
                        document.getElementById('qbank-workspace')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </div>
            </div>
          </section>
        )}

        {!isInsideExamBlock && (
          <footer>
            Question Atlas · ANCA-Associated Vasculitis Library · {totalAvailable} Questions · {correctPct}% Correct ({correctCount}) · {wrongPct}% Wrong ({wrongCount}) · {flaggedPct}% Flagged ({flaggedCount}) · {notesCount} Saved Study Notes
          </footer>
        )}
      </main>

      {/* ======================================================================
          QUESTION READER, PERSONAL STUDY NOTES & AUTHOR EDITOR DIALOG
          - 'Practice Question' ('Read'): Always opens fresh without pre-showing old answers!
          - 'Notes' ('Notes'): Save personal study notes for each question, persisted to localStorage.
          - 'Author / Edit Record' ('Edit record'): Edit stem, choices, target, tags, and rationale.
         ====================================================================== */}
      {edit && (
        <dialog
          ref={(n) => {
            if (n && !n.open) n.showModal()
          }}
          onCancel={() => E(null)}
        >
          <form onSubmit={save}>
            <div className="dialogHeader">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2>{edit.title.split(' · ')[0]}</h2>
                {Boolean(notes[edit.id]?.trim()) && (
                  <span className="noteBadgeBtn" style={{ pointerEvents: 'none' }}>
                    📝 Has Saved Note
                  </span>
                )}
              </div>
              <button type="button" className="closeDialogBtn" aria-label="Close" onClick={() => E(null)}>
                ×
              </button>
            </div>

            <div className="seg">
              {(['Read', 'Notes', 'Edit record'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={v === mode}
                  onClick={() => {
                    M(v)
                    setNoteSaveFeedback('')
                  }}
                >
                  {v === 'Read'
                    ? 'Practice Question'
                    : v === 'Notes'
                    ? `Notes${notes[edit.id]?.trim() ? ' (Saved)' : ''}`
                    : 'Author / Edit Record'}
                </button>
              ))}
            </div>

            {mode === 'Read' ? (
              <Reader
                question={edit}
                savedChoice={modalSessionAnswers[edit.id]?.choice}
                isFlagged={flaggedIds.includes(edit.id)}
                hasNote={Boolean(notes[edit.id]?.trim())}
                showCompanionIcons={companionIcons}
                peerAccuracyRate={questionCorrectnessRates[edit.id]}
                onOpenNoteModal={() => M('Notes')}
                onToggleFlag={handleToggleFlag}
                onPickChoice={handleRecordModalAttempt}
              />
            ) : mode === 'Notes' ? (
              <div className="notesTabPanel">
                <div className="qcardMetaLine" style={{ marginBottom: 10 }}>
                  <strong style={{ color: '#19b368' }}>{edit.target || 'Unclassified'}</strong>
                  <span aria-hidden="true">·</span>
                  <strong style={{ color: '#2e7cf6' }}>{edit.source}</strong>
                  <span aria-hidden="true">·</span>
                  <span>{edit.topic}</span>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {edit.title}
                </p>

                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Quick Clinical Note Templates:
                </div>
                <div className="notesQuickPrompts">
                  {[
                    'KDIGO 2024 Takeaway: ',
                    'Trial Inclusion / Endpoint Pearl: ',
                    'Dosing & Monitoring Threshold: ',
                    'Why I Missed This / Pitfall: ',
                  ].map((promptText) => (
                    <button
                      key={promptText}
                      type="button"
                      className="notesPromptChip"
                      onClick={() => {
                        const existing = notes[edit.id] || ''
                        const updated = existing ? `${existing}\n${promptText}` : promptText
                        handleUpdateNote(edit.id, updated)
                      }}
                    >
                      + {promptText.replace(': ', '')}
                    </button>
                  ))}
                </div>

                <label style={{ marginTop: 8 }}>
                  Personal Study Note for {edit.title.split(' · ')[0]}
                  <textarea
                    rows={6}
                    placeholder="Write your personal clinical pearls, trial takeaways, or mnemonics for this question..."
                    value={notes[edit.id] || ''}
                    onChange={(e) => {
                      handleUpdateNote(edit.id, e.target.value)
                      setNoteSaveFeedback('')
                    }}
                  />
                </label>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                  <span style={{ fontSize: 12.5, color: noteSaveFeedback ? 'var(--emerald)' : 'var(--text-secondary)', fontWeight: noteSaveFeedback ? 600 : 400 }}>
                    {noteSaveFeedback ||
                      (notes[edit.id]?.trim()
                        ? `Saved to local state (${notes[edit.id].trim().length} characters) · Note icon displayed on card`
                        : 'No note saved for this question yet.')}
                  </span>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {Boolean(notes[edit.id]?.trim()) && (
                      <button
                        type="button"
                        className="secondaryPillBtn"
                        onClick={() => {
                          handleUpdateNote(edit.id, '')
                          setNoteSaveFeedback('Note removed.')
                        }}
                      >
                        Delete Note
                      </button>
                    )}
                    <button
                      type="button"
                      className="createExamBtn"
                      onClick={() => {
                        setNoteSaveFeedback('✓ Personal study note saved to question card.')
                      }}
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="qcardMetaLine" style={{ marginBottom: 14 }}>
                  <strong style={{ color: '#19b368' }}>{edit.target || 'Unclassified'}</strong>
                  <span aria-hidden="true">·</span>
                  <strong style={{ color: '#2e7cf6' }}>
                    {/^KDIGO/i.test(edit.source)
                      ? 'Guideline'
                      : sources.includes(edit.source)
                      ? 'Clinical trial'
                      : 'Evidence source'}{' '}
                    · {edit.source}
                  </strong>
                  {(edit.tags || []).map((t) => (
                    <React.Fragment key={t}>
                      <span aria-hidden="true">·</span>
                      <span>{t}</span>
                    </React.Fragment>
                  ))}
                </div>

                {questionFields(edit.full).map((field) => (
                  <label key={field.label}>
                    {field.label}
                    <textarea
                      required
                      rows={field.label === 'Question' || field.label === 'Explanation' ? 7 : 2}
                      value={field.value}
                      onChange={(e) =>
                        E({
                          ...edit,
                          full: edit.full.slice(0, field.start) + e.target.value + edit.full.slice(field.end),
                        })
                      }
                    />
                  </label>
                ))}

                <details open style={{ marginTop: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0e6f40', padding: '8px 0' }}>
                    Decision target, clinical tags &amp; evidence source
                  </summary>
                  <label>
                    Question target folder
                    <select
                      value={edit.target || 'Unclassified'}
                      onChange={(e) => E({ ...edit, target: e.target.value })}
                    >
                      {Array.from(new Set([...allTargets, 'Unclassified'])).map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Clinical tags (comma-separated)
                    <input
                      key={edit.id}
                      defaultValue={(edit.tags || []).join(', ')}
                      onBlur={(e) =>
                        E({
                          ...edit,
                          tags: Array.from(
                            new Set(
                              e.target.value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean)
                            )
                          ),
                        })
                      }
                    />
                  </label>
                  {(['title', 'source', 'topic', 'status', 'body', 'full'] as const)
                    .filter((key) => key !== 'full' || !questionFields(edit.full).length)
                    .map((key, i) => (
                      <label key={key}>
                        {
                          [
                            'Question title',
                            'Evidence source (Guideline or Trial)',
                            'Clinical topic',
                            'Review status',
                            'Index summary',
                            'Original question, choices and answer',
                          ][i]
                        }
                        {key === 'status' ? (
                          <select value={edit[key]} onChange={(e) => E({ ...edit, [key]: e.target.value })}>
                            {statuses.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        ) : i >= 4 ? (
                          <textarea
                            rows={i === 5 ? 14 : 2}
                            value={edit[key]}
                            onChange={(e) => E({ ...edit, [key]: e.target.value })}
                          />
                        ) : (
                          <input
                            required
                            list={key}
                            value={edit[key]}
                            onChange={(e) => E({ ...edit, [key]: e.target.value })}
                          />
                        )}
                      </label>
                    ))}
                  <datalist id="source">
                    {labels.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </datalist>
                  <datalist id="topic">
                    {topicList.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </datalist>
                </details>
                {error && (
                  <p role="alert" style={{ color: '#ea582c', fontWeight: 600 }}>
                    {error}
                  </p>
                )}
                <button type="submit" className="primary">
                  Save question record
                </button>
              </>
            )}
          </form>
        </dialog>
      )}

      {/* ======================================================================
          21st.dev COMMAND MENU (⌘K / Ctrl+K)
         ====================================================================== */}
      <CommandMenuModal
        open={isCommandMenuOpen}
        onClose={() => setIsCommandMenuOpen(false)}
        questions={rows}
        attempts={attempts}
        flaggedIds={flaggedIds}
        targets={allTargets}
        sources={labels}
        showCompanionIcons={companionIcons}
        onSelectQuestion={(q) => {
          if (isInsideExamBlock && activeExamIds && activeExamIds.includes(q.id)) {
            setActiveExamIndex(activeExamIds.indexOf(q.id))
          } else {
            openQuestion(q as Q, 'Read')
          }
        }}
        onApplyFilter={(opts) => {
          if (opts.search !== undefined) F(opts.search)
          openFilteredQBank({
            attemptFilter: opts.attemptFilter,
            target: opts.target,
            source: opts.source,
          })
        }}
        onOpenMasteryDrawer={() => setIsMasteryDrawerOpen(true)}
        onLaunchWeakAreaBlock={handleLaunchStudyPlanBlock}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      {/* ======================================================================
          21st.dev EDGE-ANCHORED SLIDE-OVER MASTERY & ATLAS MAP DRAWER (M)
         ====================================================================== */}
      <MasteryAtlasDrawer
        open={isMasteryDrawerOpen}
        onClose={() => setIsMasteryDrawerOpen(false)}
        questions={rows}
        attempts={attempts}
        flaggedIds={flaggedIds}
        notesCount={notesCount}
        streakCount={correctStreak}
        showCompanionIcons={companionIcons}
        activeQuestionId={activeExamQuestion?.id ?? edit?.id ?? null}
        onSelectQuestion={(q) => {
          if (isInsideExamBlock && activeExamIds && activeExamIds.includes(q.id)) {
            setActiveExamIndex(activeExamIds.indexOf(q.id))
          } else {
            openQuestion(q as Q, 'Read')
          }
        }}
        onFilterByStatus={(statusVal) => {
          openFilteredQBank({ attemptFilter: statusVal })
        }}
        onSelectDomain={(topicName) => {
          openCreateTestConfigurator({ topics: [topicName], targets: [], sources: [], initialStep: 4 })
        }}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
