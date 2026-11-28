import React, { useEffect, useRef, useState } from 'react'

export type Facet = {
  name: string
  value: string
  options: string[]
  change: (v: string) => void
}

function FacetPicker({
  name,
  value,
  options,
  change,
  alignRight = false,
}: Facet & { alignRight?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const searchable = options.length > 6

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  function select(item: string) {
    change(item)
    setOpen(false)
    trigger.current?.focus()
  }

  const matches = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))

  return (
    <div
      className="facet"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <div className="facetControlGroup" data-selected={Boolean(value)}>
        <button
          className="facetButton"
          ref={trigger}
          type="button"
          aria-expanded={open}
          data-selected={Boolean(value)}
          onClick={() => {
            setQuery('')
            setOpen((prev) => !prev)
          }}
        >
          <span className="facetLabelName">{name}</span>
          {value ? (
            <>
              <span className="facetValueColon" aria-hidden="true">:</span>
              <strong className="facetSelectedValue">{value}</strong>
            </>
          ) : (
            <span className="facetAllPlaceholder">All</span>
          )}
          <span aria-hidden="true" className="facetChevron">
            {open ? '▴' : '▾'}
          </span>
        </button>

        {value && (
          <button
            type="button"
            className="facetInlineClearBtn"
            aria-label={`Clear ${name} filter`}
            title={`Clear ${name}: ${value}`}
            onClick={(e) => {
              e.stopPropagation()
              change('')
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div
          className="facetPanel animatePopover"
          data-align={alignRight ? 'right' : 'left'}
          aria-label={name}
        >
          <div className="facetPanelHeader">
            <span>Filter by {name}</span>
            {value && (
              <button
                type="button"
                className="facetPanelResetLink"
                onClick={() => select('')}
              >
                Reset
              </button>
            )}
          </div>

          {searchable && (
            <div className="facetSearchInputWrap">
              <input
                autoFocus
                aria-label={'Find ' + name.toLowerCase()}
                placeholder={'Search ' + name.toLowerCase() + '…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}

          <div className="facetList" role="listbox" aria-label={name + ' options'}>
            {['', ...matches].map((item) => {
              const isSelected = value === item
              return (
                <button
                  key={item || '__all__'}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() => select(item)}
                >
                  <span className="facetOptionText">{item || `All ${name}`}</span>
                  <span className="facetOptionCheck" aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                </button>
              )
            })}
            {!matches.length && <small>No matching {name.toLowerCase()}</small>}
          </div>
        </div>
      )}
    </div>
  )
}

export function SearchToolbar({
  search,
  onSearch,
  facets,
  recent,
  onRecent,
  activeFilterCount = 0,
  onClearAll,
  sidebarOpen,
  onToggleSidebar,
}: {
  search: string
  onSearch: (v: string) => void
  facets: Facet[]
  recent: boolean
  onRecent: () => void
  activeFilterCount?: number
  onClearAll?: () => void
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}) {
  const statusFacet = facets.find((f) => f.name === 'Status')
  const quickStatusOptions = ['All', 'Unanswered', 'Incorrect', 'Correct', 'Flagged', 'With Notes']

  return (
    <div className="libraryTools">
      {/* Row 1: 21st.dev Command Search Row + Sidebar Toggle */}
      <div className="searchCommandRow">
        {onToggleSidebar && (
          <button
            type="button"
            className="sidebarToggleBtn"
            aria-pressed={Boolean(sidebarOpen)}
            onClick={onToggleSidebar}
            title="Toggle Decision Target Sidebar (Shortcut: [)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <line x1="9" y1="4" x2="9" y2="20" />
            </svg>
            <span>Topics</span>
            <kbd className="kbdHint">[</kbd>
          </button>
        )}

        <div className="librarySearch">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            id="question-search"
            aria-label="Search questions"
            placeholder="Search clinical vignettes, trials, or decision targets…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onSearch('')
                document.getElementById('question-search')?.focus()
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Organized Horizontal Filter Bar (Quick Status Segmented Pills + Facet Dropdowns) */}
      <div className="filterBarHorizontalRow">
        {statusFacet && (
          <div className="quickStatusSegmented" role="group" aria-label="Filter by question status">
            {quickStatusOptions.map((opt) => {
              const isAll = opt === 'All'
              const isActive = isAll ? !statusFacet.value : statusFacet.value === opt
              return (
                <button
                  key={opt}
                  type="button"
                  className="quickStatusPillBtn"
                  aria-pressed={isActive}
                  onClick={() => statusFacet.change(isAll ? '' : opt)}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )}

        <div className="compactFacetCluster" role="group" aria-label="Filter dropdowns">
          {facets.map((f, idx) => (
            <FacetPicker
              key={f.name}
              {...f}
              alignRight={idx >= facets.length - 2}
            />
          ))}

          <button
            type="button"
            className="recentSwitch"
            aria-pressed={recent}
            onClick={onRecent}
            title="Show recently added questions"
          >
            <span>Recent</span>
          </button>

          {activeFilterCount > 0 && onClearAll && (
            <button
              type="button"
              className="activeFilterResetBtn"
              onClick={onClearAll}
              title="Clear all active filters"
            >
              <span className="activeFilterCountBadge">{activeFilterCount}</span>
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
