import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  PixelFiltrateDrop,
  PixelGlomerulus,
  PixelANCA_Y_Antibody,
  PixelKidneyPair,
} from './PixelNephrologySprites'

export interface AtlasQuestionRecord {
  id: number
  title: string
  source: string
  topic: string
  status: string
  body: string
  full: string
  target?: string
  tags?: string[]
  disease?: string
}

export interface SixAxisDomainMetric {
  id: string
  label: string
  shortLabel: string
  total: number
  attempted: number
  correct: number
  wrong: number
  flagged: number
  accuracy: number
}

/**
 * Classifies each of the 228 ANCA-associated vasculitis questions using only actual
 * topic, target, and tag attributes present in the question bank.
 */
export function classifyQuestionVasculitisSubtypeAndOrgan(q: AtlasQuestionRecord): {
  subtype: 'GPA' | 'MPA' | 'AAV'
  organDomain: string
  domains: string[]
} {
  const haystack = `${q.title} ${q.body} ${q.full} ${q.topic} ${q.target || ''} ${(q.tags || []).join(' ')}`.toLowerCase()

  let subtype: 'GPA' | 'MPA' | 'AAV' = 'AAV'
  if (
    haystack.includes('gpa') ||
    haystack.includes('granulomatosis with polyangiitis') ||
    haystack.includes('wegener') ||
    haystack.includes('pr3') ||
    haystack.includes('proteinase 3') ||
    haystack.includes('c-anca')
  ) {
    subtype = 'GPA'
  } else if (
    haystack.includes('mpa') ||
    haystack.includes('microscopic polyangiitis') ||
    haystack.includes('mpo') ||
    haystack.includes('myeloperoxidase') ||
    haystack.includes('p-anca')
  ) {
    subtype = 'MPA'
  }

  const organDomain = q.target || q.topic || 'Treatment selection'
  const domains: string[] = [q.topic]
  if (q.target && !domains.includes(q.target)) {
    domains.push(q.target)
  }

  return { subtype, organDomain, domains }
}

/**
 * Computes domain metrics strictly from the actual Clinical Topics (`q.topic`) present
 * in the question bank (filtering out any topic with 0 questions so non-existent domains never appear).
 */
export function computeSixAxisVasculitisMetrics(
  questions: AtlasQuestionRecord[],
  attempts: Record<number, { choice: string; correct: boolean }>,
  flaggedIds: number[]
): SixAxisDomainMetric[] {
  const preferredTopicOrder = [
    'Induction therapy',
    'Trial outcomes',
    'Disease assessment',
    'Maintenance therapy',
    'Diagnosis',
    'Trial eligibility',
    'Dosing & timing',
  ]

  const allTopicsInBank = Array.from(
    new Set([
      ...preferredTopicOrder,
      ...questions.map((q) => q.topic).filter(Boolean),
    ])
  )

  return allTopicsInBank
    .map((topicName) => {
      const pool = questions.filter((q) =>
        topicName === 'Dosing & timing'
          ? q.topic === 'Dosing & timing' || q.target === 'Dosing & timing'
          : q.topic === topicName
      )
      const attempted = pool.filter((q) => Boolean(attempts[q.id])).length
      const correct = pool.filter((q) => attempts[q.id]?.correct === true).length
      const wrong = pool.filter((q) => attempts[q.id]?.correct === false).length
      const flagged = pool.filter((q) => flaggedIds.includes(q.id)).length
      const accuracy = pool.length > 0 ? Math.round((correct / pool.length) * 100) : 0
      const shortLabel =
        topicName === 'Induction therapy'
          ? 'Induction'
          : topicName === 'Maintenance therapy'
          ? 'Maintenance'
          : topicName === 'Disease assessment'
          ? 'Assessment'
          : topicName === 'Trial outcomes'
          ? 'Outcomes'
          : topicName === 'Trial eligibility'
          ? 'Eligibility'
          : topicName === 'Dosing & timing'
          ? 'Dosing'
          : topicName
      return {
        id: topicName,
        label: topicName,
        shortLabel,
        total: pool.length,
        attempted,
        correct,
        wrong,
        flagged,
        accuracy,
      }
    })
    .filter((m) => m.total > 0)
}

/**
 * Animated count-up hook for the 21st.dev Stats Band
 */
function useAnimatedCounter(targetValue: number, durationMs = 520): number {
  const [displayVal, setDisplayVal] = useState(targetValue)
  const prevRef = useRef(targetValue)

  useEffect(() => {
    const startVal = prevRef.current
    const diff = targetValue - startVal
    if (diff === 0) {
      setDisplayVal(targetValue)
      return
    }
    let rafId = 0
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setDisplayVal(Math.round(startVal + diff * eased))
      if (elapsed < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        prevRef.current = targetValue
      }
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [targetValue, durationMs])

  return displayVal
}

/**
 * 1. 21st.dev Stats Band (Headline Session KPI Strip)
 * Reference: https://21st.dev/@kuratlielia/components/stats-band
 * Single hairline-divided horizontal strip displaying 4 animated count-up metrics
 * with hover-revealed context sub-lines, inline sparkline, mini progress bars, and pulse indicator.
 */
export function StatsBand({
  accuracyPct,
  completedCount,
  totalCount,
  correctCount,
  wrongCount,
  streakCount,
  flaggedCount,
  notesCount,
  showCompanionIcons = true,
  onClickAccuracy,
  onClickCompleted,
  onClickStreak,
  onClickFlagged,
}: {
  accuracyPct: number
  completedCount: number
  totalCount: number
  correctCount: number
  wrongCount: number
  streakCount: number
  flaggedCount: number
  notesCount: number
  showCompanionIcons?: boolean
  onClickAccuracy?: () => void
  onClickCompleted?: () => void
  onClickStreak?: () => void
  onClickFlagged?: () => void
}) {
  const animAccuracy = useAnimatedCounter(accuracyPct)
  const animCompleted = useAnimatedCounter(completedCount)
  const animStreak = useAnimatedCounter(streakCount)
  const animFlagged = useAnimatedCounter(flaggedCount)

  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <section className="statsBandContainer" aria-label="Headline Session KPI Stats Band">
      {/* KPI 1: Overall Accuracy (%) + Tiny Inline Sparkline */}
      <button
        type="button"
        className="statsBandCell"
        onClick={onClickAccuracy}
        title="Click to inspect answered questions"
      >
        <div className="statsBandTopRow">
          <span className="statsBandLabel">Overall Accuracy</span>
          <svg
            className="statsBandSparkline"
            width="54"
            height="18"
            viewBox="0 0 54 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 14L11 11L20 12.5L29 7.5L38 8.5L47 3.5L52 2.5"
              stroke="var(--emerald)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="52" cy="2.5" r="2.2" fill="var(--emerald)" />
          </svg>
        </div>
        <div className="statsBandValueRow">
          <span className="statsBandNumber" data-tone="emerald">
            {animAccuracy}%
          </span>
          <span className="statsBandBadge" data-tone="emerald">
            {correctCount} Right · {wrongCount} Wrong
          </span>
        </div>
        <div className="statsBandHoverSub">
          KDIGO 2024 &amp; 11 Landmark Trials combined
        </div>
      </button>

      {/* KPI 2: Questions Completed (X / Total) + Mini Segmented Progress Bars */}
      <button
        type="button"
        className="statsBandCell"
        onClick={onClickCompleted}
        title="Click to browse all 228 ANCA vasculitis questions"
      >
        <div className="statsBandTopRow">
          <span className="statsBandLabel">Questions Completed</span>
          <span className="statsBandMiniPct">{completionPct}%</span>
        </div>
        <div className="statsBandValueRow">
          <span className="statsBandNumber">
            {animCompleted}
            <small className="statsBandDenominator"> / {totalCount}</small>
          </span>
          <div className="statsBandMiniBars" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => {
              const filled = i < Math.round((completedCount / Math.max(1, totalCount)) * 10)
              return <span key={i} className="statsBandMiniBarTick" data-filled={filled} />
            })}
          </div>
        </div>
        <div className="statsBandHoverSub">
          {Math.max(0, totalCount - completedCount)} unused left · KDIGO 2024 &amp; 11 landmark trials
        </div>
      </button>

      {/* KPI 3: Current Streak + Subtle Pulse Indicator */}
      <button
        type="button"
        className="statsBandCell"
        onClick={onClickStreak}
        title="Consecutive correct answers in current session"
      >
        <div className="statsBandTopRow">
          <span className="statsBandLabel">Current Streak</span>
          <span className="statsBandPulseWrap" data-active={streakCount >= 3}>
            <span className="statsBandPulseDot" />
            {showCompanionIcons && <PixelFiltrateDrop size={14} active={streakCount >= 3} />}
          </span>
        </div>
        <div className="statsBandValueRow">
          <span className="statsBandNumber" data-tone={streakCount >= 3 ? 'blue' : undefined}>
            {animStreak}
          </span>
          <span className="statsBandBadge" data-tone="blue">
            {streakCount >= 3 ? 'Active Filtrate Streak' : 'Consecutive Correct'}
          </span>
        </div>
        <div className="statsBandHoverSub">
          {streakCount >= 3
            ? 'Filtrate droplet active (≥3 consecutive correct)'
            : `${Math.max(1, 3 - streakCount)} more correct to activate streak`}
        </div>
      </button>

      {/* KPI 4: Flagged for Review */}
      <button
        type="button"
        className="statsBandCell"
        onClick={onClickFlagged}
        title="Click to filter flagged questions for review"
      >
        <div className="statsBandTopRow">
          <span className="statsBandLabel">Flagged for Review</span>
          <span className="statsBandFlagIcon" aria-hidden="true">★</span>
        </div>
        <div className="statsBandValueRow">
          <span className="statsBandNumber" data-tone="amber">
            {animFlagged}
          </span>
          <span className="statsBandBadge" data-tone="amber">
            {notesCount} Study Notes
          </span>
        </div>
        <div className="statsBandHoverSub">
          Click to practice or filter flagged high-yield items
        </div>
      </button>
    </section>
  )
}

/**
 * 2. 21st.dev Waffle Unit Chart (Interactive 228-Cell Question Bank Matrix)
 * Reference: https://21st.dev/@paceui/components/tanstack-charts-waffle-unit-chart
 * Renders every question in the ANCA library as a crisp square unit cell with
 * floating hover tooltip (`Q#14 • GPA • Renal Involvement • Correct`) and click-to-jump.
 */
export function WaffleUnitChart({
  questions,
  attempts,
  flaggedIds,
  activeQuestionId,
  onSelectQuestion,
}: {
  questions: AtlasQuestionRecord[]
  attempts: Record<number, { choice: string; correct: boolean }>
  flaggedIds: number[]
  activeQuestionId?: number | null
  onSelectQuestion: (q: AtlasQuestionRecord) => void
}) {
  const [filterTone, setFilterTone] = useState<'all' | 'correct' | 'incorrect' | 'flagged' | 'unanswered'>('all')
  const [hoveredQ, setHoveredQ] = useState<{
    q: AtlasQuestionRecord
    code: string
    subtype: string
    organDomain: string
    statusLabel: string
    tone: 'correct' | 'incorrect' | 'flagged' | 'unanswered'
  } | null>(null)

  const cells = useMemo(() => {
    return questions.map((q) => {
      const att = attempts[q.id]
      const isFlagged = flaggedIds.includes(q.id)
      const { subtype, organDomain } = classifyQuestionVasculitisSubtypeAndOrgan(q)
      const code = q.title.split(' · ')[0] || `Q#${q.id}`

      let tone: 'correct' | 'incorrect' | 'flagged' | 'unanswered' = 'unanswered'
      let statusLabel = 'Unanswered'
      if (att) {
        if (att.correct) {
          tone = 'correct'
          statusLabel = 'Correct'
        } else {
          tone = 'incorrect'
          statusLabel = 'Incorrect'
        }
      } else if (isFlagged) {
        tone = 'flagged'
        statusLabel = 'Flagged'
      }

      return {
        q,
        code,
        subtype,
        organDomain,
        tone,
        statusLabel,
        isFlagged,
      }
    })
  }, [questions, attempts, flaggedIds])

  const counts = useMemo(() => {
    let correct = 0
    let incorrect = 0
    let flagged = 0
    let unanswered = 0
    for (const c of cells) {
      if (c.tone === 'correct') correct++
      else if (c.tone === 'incorrect') incorrect++
      else if (c.tone === 'flagged') flagged++
      else unanswered++
    }
    return { correct, incorrect, flagged, unanswered }
  }, [cells])

  return (
    <div className="waffleChartCard">
      <div className="waffleHeaderRow">
        <div>
          <h3 className="waffleTitle">Question Atlas Matrix · {questions.length}-Unit Waffle Grid</h3>
          <p className="waffleSubtitle">
            Hover any unit cell to inspect subtype &amp; domain; click any square to jump directly to that question.
          </p>
        </div>

        <div className="waffleLegendBar" role="group" aria-label="Filter waffle cells by status">
          {(
            [
              { id: 'all', label: `All (${questions.length})`, dot: 'all' },
              { id: 'correct', label: `Correct (${counts.correct})`, dot: 'correct' },
              { id: 'incorrect', label: `Incorrect (${counts.incorrect})`, dot: 'incorrect' },
              { id: 'flagged', label: `Flagged (${counts.flagged})`, dot: 'flagged' },
              { id: 'unanswered', label: `Unanswered (${counts.unanswered})`, dot: 'unanswered' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`waffleLegendPill${filterTone === item.id ? ' waffleLegendPill--active' : ''}`}
              aria-pressed={filterTone === item.id}
              onClick={() => setFilterTone((prev) => (prev === item.id ? 'all' : item.id))}
            >
              {item.id !== 'all' && (
                <span className={`waffleSwatch waffleSwatch--${item.dot}`} data-tone={item.dot} />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Floating Tooltip Banner */}
      <div className="waffleTooltipBar" data-active={Boolean(hoveredQ)}>
        {hoveredQ ? (
          <>
            <span className={`waffleSwatch waffleSwatch--${hoveredQ.tone}`} data-tone={hoveredQ.tone} />
            <strong>{hoveredQ.code}</strong>
            <span className="waffleTooltipDot">•</span>
            <span className="waffleTooltipSubtype">{hoveredQ.subtype}</span>
            <span className="waffleTooltipDot">•</span>
            <span>{hoveredQ.organDomain}</span>
            <span className="waffleTooltipDot">•</span>
            <span className="waffleTooltipSource">{hoveredQ.q.source}</span>
            <span className="waffleTooltipDot">•</span>
            <strong
              className={`waffleTooltipStatus waffleTooltipStatus--${hoveredQ.tone}`}
              data-tone={hoveredQ.tone}
            >
              {hoveredQ.statusLabel}
            </strong>
          </>
        ) : (
          <span className="waffleTooltipPlaceholder">
            Hover any cell below (e.g., Q#014 • GPA • Renal Involvement • Correct) or click to open question
          </span>
        )}
      </div>

      {/* 228-Cell Square Waffle Grid */}
      <div className="waffleUnitGrid" role="grid" aria-label="228 question waffle unit matrix">
        {cells.map((cell) => {
          const dimmed = filterTone !== 'all' && cell.tone !== filterTone
          const isCurrent = activeQuestionId === cell.q.id
          const tooltipString = `${cell.code} • ${cell.subtype} • ${cell.organDomain} • ${cell.statusLabel}`
          return (
            <button
              key={cell.q.id}
              type="button"
              className={`waffleUnitCell waffleUnitCell--${cell.tone}${dimmed ? ' waffleUnitCell--dimmed' : ''}${
                isCurrent ? ' waffleUnitCell--active' : ''
              }`}
              data-tone={cell.tone}
              data-dimmed={dimmed ? 'true' : undefined}
              data-current={isCurrent ? 'true' : undefined}
              aria-label={tooltipString}
              title={tooltipString}
              onMouseEnter={() => setHoveredQ(cell)}
              onMouseLeave={() => setHoveredQ(null)}
              onFocus={() => setHoveredQ(cell)}
              onClick={() => onSelectQuestion(cell.q)}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * 3. Clinical Domain Summary Cards (Replaces Complex Polygon Radar Graphs)
 * Renders a single, clear summary card for each clinical domain (GPA, MPA, EGPA,
 * ANCA Serology PR3/MPO, Renal & Pulmonary Pathology, Induction & Maintenance Therapy,
 * plus optional Decision Targets & Landmark Trials tabs) to eliminate visual clutter
 * while retaining 100% of medical & performance data.
 */
export function VasculitisDomainRadar({
  metrics,
  targetMetrics,
  sourceMetrics,
  showCompanionIcons = true,
  onSelectDomain,
  onSelectTarget,
  onSelectSource,
  onOpenStudyPlan,
  onOpenStudyPlanLogic,
}: {
  metrics: SixAxisDomainMetric[]
  targetMetrics?: {
    name: string
    shortLabel: string
    total: number
    attempted: number
    correct: number
    wrong: number
    flagged: number
    accuracy: number
  }[]
  sourceMetrics?: {
    name: string
    shortLabel: string
    total: number
    attempted: number
    correct: number
    wrong: number
    flagged: number
    accuracy: number
  }[]
  showCompanionIcons?: boolean
  onSelectDomain?: (domainId: string) => void
  onSelectTarget?: (targetName: string) => void
  onSelectSource?: (sourceName: string) => void
  onOpenStudyPlan?: () => void
  onOpenStudyPlanLogic?: () => void
}) {
  const [activeView, setActiveView] = useState<'domains' | 'targets' | 'sources'>('domains')

  const cards = useMemo(() => {
    if (activeView === 'targets' && targetMetrics && targetMetrics.length > 0) {
      return targetMetrics.map((m) => ({
        id: m.name,
        title: m.name,
        subtitle: `${m.shortLabel} · Clinical Decision Target`,
        total: m.total,
        attempted: m.attempted,
        correct: m.correct,
        wrong: m.wrong,
        flagged: m.flagged,
        accuracy: m.accuracy,
        onClick: () => onSelectTarget?.(m.name),
      }))
    }
    if (activeView === 'sources' && sourceMetrics && sourceMetrics.length > 0) {
      return sourceMetrics.map((m) => ({
        id: m.name,
        title: m.name,
        subtitle: /^KDIGO/i.test(m.name) ? 'KDIGO 2024 Clinical Practice Guideline' : 'Landmark ANCA Vasculitis Trial',
        total: m.total,
        attempted: m.attempted,
        correct: m.correct,
        wrong: m.wrong,
        flagged: m.flagged,
        accuracy: m.accuracy,
        onClick: () => onSelectSource?.(m.name),
      }))
    }
    return metrics.map((m) => ({
      id: m.id,
      title: m.label,
      subtitle: `${m.shortLabel} · Clinical Topic`,
      total: m.total,
      attempted: m.attempted,
      correct: m.correct,
      wrong: m.wrong,
      flagged: m.flagged,
      accuracy: m.accuracy,
      onClick: () => onSelectDomain?.(m.id),
    }))
  }, [activeView, metrics, targetMetrics, sourceMetrics, onSelectDomain, onSelectTarget, onSelectSource])

  return (
    <div className="sixAxisRadarCard">
      <div className="sixAxisRadarHeader">
        <div>
          <h3 className="waffleTitle">Clinical Domain Mastery Summary</h3>
          <p className="waffleSubtitle">
            Clear domain-by-domain accuracy across Clinical Topics, Decision Targets &amp; Landmark Trials.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(targetMetrics || sourceMetrics) && (
            <div className="seg" style={{ marginBottom: 0, padding: 3 }}>
              <button
                type="button"
                style={{ padding: '4px 10px', fontSize: 11.5 }}
                aria-pressed={activeView === 'domains'}
                onClick={() => setActiveView('domains')}
              >
                Clinical Topics ({metrics.length})
              </button>
              {targetMetrics && targetMetrics.length > 0 && (
                <button
                  type="button"
                  style={{ padding: '4px 10px', fontSize: 11.5 }}
                  aria-pressed={activeView === 'targets'}
                  onClick={() => setActiveView('targets')}
                >
                  Decision Targets ({targetMetrics.length})
                </button>
              )}
              {sourceMetrics && sourceMetrics.length > 0 && (
                <button
                  type="button"
                  style={{ padding: '4px 10px', fontSize: 11.5 }}
                  aria-pressed={activeView === 'sources'}
                  onClick={() => setActiveView('sources')}
                >
                  Trials &amp; KDIGO ({sourceMetrics.length})
                </button>
              )}
            </div>
          )}

          {onOpenStudyPlanLogic && (
            <button type="button" className="secondaryPillBtn" onClick={onOpenStudyPlanLogic}>
              ℹ Logic
            </button>
          )}
          {onOpenStudyPlan && (
            <button type="button" className="studyPlanBtn" onClick={onOpenStudyPlan}>
              Adaptive Study Plan →
            </button>
          )}
        </div>
      </div>

      <div className="clinicalDomainCardsGrid">
        {cards.map((card) => {
          const tone = card.accuracy >= 80 ? 'good' : card.accuracy >= 60 ? 'warn' : 'low'
          const unused = Math.max(0, card.total - card.attempted)
          return (
            <button
              key={card.id}
              type="button"
              className="clinicalDomainSummaryCard"
              data-tone={tone}
              onClick={card.onClick}
            >
              <div className="clinicalDomainCardTop">
                <div className="clinicalDomainCardTitles">
                  <span
                    className="clinicalDomainCardName"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {showCompanionIcons && (
                      <PixelGlomerulus
                        size={16}
                        state={card.accuracy >= 70 ? 'healthy' : 'crescentic'}
                      />
                    )}
                    <span>{card.title}</span>
                  </span>
                  <span className="clinicalDomainCardSub">{card.subtitle}</span>
                </div>
                <span className={`sixAxisDomainPct sixAxisDomainPct--${tone}`} data-tone={tone}>
                  {card.accuracy}%
                </span>
              </div>

              <div className="clinicalDomainProgressTrack" aria-hidden="true">
                <div
                  className={`clinicalDomainProgressFill clinicalDomainProgressFill--${tone}`}
                  style={{ width: `${Math.max(4, Math.min(100, card.accuracy))}%` }}
                />
              </div>

              <div className="clinicalDomainCardFooter">
                <span className="sixAxisDomainCounts">
                  <strong>{card.correct}/{card.total}</strong> Correct · {card.wrong} Wrong · {card.flagged} Flagged
                  {unused > 0 ? ` · ${unused} Left` : ''}
                </span>
                <span className="clinicalDomainCardAction">
                  {card.accuracy < 60 ? 'Remediate →' : 'Practice →'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 4. 21st.dev Command Menu (`⌘K` / Quick Jump & Filter)
 * Reference: https://21st.dev/community/components/s/search
 * Centered keyboard-navigable Command Palette with smooth transitions for searching questions,
 * jumping to Q#001-Q#228, applying status/target/trial filters, or toggling drawers.
 */
export function CommandMenuModal({
  open,
  onClose,
  questions,
  attempts,
  flaggedIds,
  targets,
  sources,
  showCompanionIcons = true,
  onSelectQuestion,
  onApplyFilter,
  onOpenMasteryDrawer,
  onLaunchWeakAreaBlock,
  onToggleTheme,
}: {
  open: boolean
  onClose: () => void
  questions: AtlasQuestionRecord[]
  attempts: Record<number, { choice: string; correct: boolean }>
  flaggedIds: number[]
  targets: string[]
  sources: string[]
  showCompanionIcons?: boolean
  onSelectQuestion: (q: AtlasQuestionRecord) => void
  onApplyFilter: (opts: {
    attemptFilter?: '' | 'unused' | 'correct' | 'incorrect' | 'flagged' | 'notes'
    target?: string
    source?: string
    search?: string
  }) => void
  onOpenMasteryDrawer: () => void
  onLaunchWeakAreaBlock: () => void
  onToggleTheme: () => void
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const commandItems = useMemo(() => {
    const qLower = query.trim().toLowerCase()
    const items: {
      id: string
      group: string
      title: string
      subtitle: string
      badge?: string
      tone?: string
      action: () => void
    }[] = []

    // Quick Actions & Status Filters
    const quickFilters: {
      id: string
      title: string
      subtitle: string
      badge: string
      action: () => void
    }[] = [
      {
        id: 'act-mastery',
        title: 'Open Domain Mastery & Analytics Drawer',
        subtitle: 'View Stats Band & Clinical Domain Summary Cards',
        badge: 'Shortcut: M',
        action: () => {
          onClose()
          onOpenMasteryDrawer()
        },
      },
      {
        id: 'act-weak-block',
        title: 'Launch Weak-Area Adaptive Practice Block',
        subtitle: 'Start a focused Tutor block on your lowest-accuracy sub-topics',
        badge: 'Study Plan',
        action: () => {
          onClose()
          onLaunchWeakAreaBlock()
        },
      },
      {
        id: 'flt-incorrect',
        title: 'Filter Question Bank: Incorrect Answers Only',
        subtitle: 'Review missed questions in the ANCA-associated vasculitis library',
        badge: 'Status',
        action: () => {
          onClose()
          onApplyFilter({ attemptFilter: 'incorrect' })
        },
      },
      {
        id: 'flt-flagged',
        title: 'Filter Question Bank: Flagged for Review',
        subtitle: 'Jump to bookmarked questions',
        badge: `${flaggedIds.length} Flagged`,
        action: () => {
          onClose()
          onApplyFilter({ attemptFilter: 'flagged' })
        },
      },
      {
        id: 'flt-unused',
        title: 'Filter Question Bank: Unanswered Questions',
        subtitle: 'Show only unused questions',
        badge: 'Status',
        action: () => {
          onClose()
          onApplyFilter({ attemptFilter: 'unused' })
        },
      },
      {
        id: 'act-theme',
        title: 'Toggle Light / Dark Theme',
        subtitle: 'Switch clinical reading surface appearance',
        badge: 'Theme',
        action: () => {
          onClose()
          onToggleTheme()
        },
      },
    ]

    for (const qf of quickFilters) {
      if (!qLower || `${qf.title} ${qf.subtitle}`.toLowerCase().includes(qLower)) {
        items.push({ ...qf, group: 'Quick Actions & Status Filters' })
      }
    }

    // Matching Decision Targets & Trial Sources
    for (const t of targets) {
      if (!qLower || t.toLowerCase().includes(qLower)) {
        items.push({
          id: `target-${t}`,
          group: 'Decision Targets & Guidelines',
          title: `Target: ${t}`,
          subtitle: 'Filter Question Bank by clinical decision target',
          badge: 'Decision Target',
          action: () => {
            onClose()
            onApplyFilter({ target: t })
          },
        })
      }
    }

    for (const s of sources.slice(0, 8)) {
      if (!qLower || s.toLowerCase().includes(qLower)) {
        items.push({
          id: `source-${s}`,
          group: 'Decision Targets & Guidelines',
          title: `Source: ${s}`,
          subtitle: /^KDIGO/i.test(s) ? 'KDIGO 2024 Clinical Practice Guideline' : 'Landmark ANCA Vasculitis Trial',
          badge: 'Trial / Guideline',
          action: () => {
            onClose()
            onApplyFilter({ source: s })
          },
        })
      }
    }

    // Matching Questions (Quick Jump by Q# or clinical stem text)
    const matchedQuestions = questions
      .filter((q) => {
        if (!qLower) return q.id <= 12
        const code = `q${q.id} q#${q.id} q${String(q.id).padStart(3, '0')}`
        return `${code} ${q.title} ${q.body} ${q.source} ${q.topic} ${q.target || ''}`
          .toLowerCase()
          .includes(qLower)
      })
      .slice(0, 14)

    for (const q of matchedQuestions) {
      const code = q.title.split(' · ')[0] || `Q#${q.id}`
      const stemPreview = q.title.split(' · ').slice(1).join(' · ') || q.body
      const att = attempts[q.id]
      const { subtype } = classifyQuestionVasculitisSubtypeAndOrgan(q)
      items.push({
        id: `q-${q.id}`,
        group: 'Jump Directly to Question',
        title: `${code} · ${stemPreview}`,
        subtitle: `${subtype} • ${q.target || q.topic} • ${q.source}`,
        badge: att ? (att.correct ? '✓ Correct' : '✕ Incorrect') : flaggedIds.includes(q.id) ? '★ Flagged' : 'Unanswered',
        tone: att ? (att.correct ? 'correct' : 'incorrect') : undefined,
        action: () => {
          onClose()
          onSelectQuestion(q)
        },
      })
    }

    return items
  }, [
    query,
    questions,
    attempts,
    flaggedIds,
    targets,
    sources,
    onClose,
    onOpenMasteryDrawer,
    onLaunchWeakAreaBlock,
    onApplyFilter,
    onToggleTheme,
    onSelectQuestion,
  ])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  if (!open) return null

  return (
    <div
      className="cmdModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Jump and Filter Command Palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cmdModalSurface animatePopover"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((prev) => (commandItems.length ? (prev + 1) % commandItems.length : 0))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((prev) =>
              commandItems.length ? (prev - 1 + commandItems.length) % commandItems.length : 0
            )
          } else if (e.key === 'Enter' && commandItems[activeIndex]) {
            e.preventDefault()
            commandItems[activeIndex].action()
          }
        }}
      >
        <div className="cmdModalInputRow">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="cmdModalInput"
            placeholder="Jump to Q# (e.g. Q014), search KDIGO 2024 / Rituximab / Dosing, or filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="cmdModalClearBtn"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
            >
              Clear
            </button>
          )}
          <kbd className="kbdHint">ESC</kbd>
        </div>

        <div className="cmdModalList" role="listbox">
          {commandItems.length === 0 ? (
            <div className="cmdModalEmpty">
              No questions or filters match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            commandItems.map((item, idx) => {
              const prevGroup = idx > 0 ? commandItems[idx - 1].group : null
              const showGroupHeading = item.group !== prevGroup
              const isSelected = idx === activeIndex
              return (
                <React.Fragment key={item.id}>
                  {showGroupHeading && <div className="cmdModalGroupHeading">{item.group}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="cmdModalItemBtn"
                    data-active={isSelected ? 'true' : undefined}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.action}
                  >
                    <div className="cmdModalItemLeft">
                      <span
                        className="cmdModalItemTitle"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        {showCompanionIcons &&
                          (item.group === 'Decision Targets & Guidelines' ||
                            item.group === 'Jump Directly to Question') && (
                            <PixelANCA_Y_Antibody
                              size={14}
                              variant={
                                `${item.title} ${item.subtitle}`.toLowerCase().includes('mpo') ||
                                `${item.title} ${item.subtitle}`.toLowerCase().includes('mpa')
                                  ? 'p-anca'
                                  : 'c-anca'
                              }
                            />
                          )}
                        <span>{item.title}</span>
                      </span>
                      <span className="cmdModalItemSub">{item.subtitle}</span>
                    </div>
                    {item.badge && (
                      <span className="cmdModalItemBadge" data-tone={item.tone}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              )
            })
          )}
        </div>

        <div className="cmdModalFooter">
          <span>
            <kbd className="kbdHint">↑</kbd> <kbd className="kbdHint">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="kbdHint">↵</kbd> to select
          </span>
          <span>
            <kbd className="kbdHint">M</kbd> for Domain Mastery Drawer
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * 5. 21st.dev Edge-Anchored Slide-Over Drawer ("Domain Mastery & Analytics" Drawer)
 * Houses the Stats Band and Clinical Domain Summary Cards inside an on-demand slide-over drawer
 * so statistics never crowd the centered clinical vignette.
 */
export function MasteryAtlasDrawer({
  open,
  onClose,
  questions,
  attempts,
  flaggedIds,
  notesCount,
  streakCount,
  showCompanionIcons,
  onFilterByStatus,
  onSelectDomain,
}: {
  open: boolean
  onClose: () => void
  questions: AtlasQuestionRecord[]
  attempts: Record<number, { choice: string; correct: boolean }>
  flaggedIds: number[]
  notesCount: number
  streakCount: number
  showCompanionIcons?: boolean
  activeQuestionId?: number | null
  onSelectQuestion?: (q: AtlasQuestionRecord) => void
  onFilterByStatus: (status: '' | 'unused' | 'correct' | 'incorrect' | 'flagged') => void
  onSelectDomain?: (domainId: string) => void
}) {
  const totalCount = questions.length
  const completedCount = useMemo(() => questions.filter((q) => Boolean(attempts[q.id])).length, [questions, attempts])
  const correctCount = useMemo(() => questions.filter((q) => attempts[q.id]?.correct === true).length, [questions, attempts])
  const wrongCount = useMemo(() => questions.filter((q) => attempts[q.id]?.correct === false).length, [questions, attempts])
  const accuracyPct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  const sixAxisMetrics = useMemo(
    () => computeSixAxisVasculitisMetrics(questions, attempts, flaggedIds),
    [questions, attempts, flaggedIds]
  )

  if (!open) return null

  return (
    <div
      className="masteryDrawerBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Domain Mastery and Analytics Drawer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <aside className="masteryDrawerPanel">
        <header className="masteryDrawerHeader">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showCompanionIcons && (
              <PixelKidneyPair size={24} masteryPercent={accuracyPct} />
            )}
            <div>
              <span className="masteryDrawerKicker">ON-DEMAND CLINICAL ANALYTICS</span>
              <h2 className="masteryDrawerTitle">Domain Mastery &amp; Analytics</h2>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <kbd className="kbdHint">M</kbd>
            <button
              type="button"
              className="secondaryPillBtn"
              onClick={onClose}
              aria-label="Close Domain Mastery & Analytics Drawer"
            >
              Close ✕
            </button>
          </div>
        </header>

        <div className="masteryDrawerContent">
          {/* 1. Headline Session KPI Stats Band */}
          <StatsBand
            accuracyPct={accuracyPct}
            completedCount={completedCount}
            totalCount={totalCount}
            correctCount={correctCount}
            wrongCount={wrongCount}
            streakCount={streakCount}
            flaggedCount={flaggedIds.length}
            notesCount={notesCount}
            showCompanionIcons={showCompanionIcons}
            onClickAccuracy={() => {
              onClose()
              onFilterByStatus('correct')
            }}
            onClickCompleted={() => {
              onClose()
              onFilterByStatus('')
            }}
            onClickStreak={() => {
              onClose()
              onFilterByStatus('correct')
            }}
            onClickFlagged={() => {
              onClose()
              onFilterByStatus('flagged')
            }}
          />

          {/* 2. Clinical Domain Summary Cards */}
          <VasculitisDomainRadar
            metrics={sixAxisMetrics}
            showCompanionIcons={showCompanionIcons}
            onSelectDomain={(domainId) => {
              onClose()
              onSelectDomain?.(domainId)
            }}
          />
        </div>
      </aside>
    </div>
  )
}

