import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, Braces, Check,
  CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Code2,
  Download, Eye, FileCode2, GitBranch, Layers, Pause, Play, RotateCcw,
  ShieldCheck, Sparkles, Terminal, Upload, Zap
} from 'lucide-react'
import type { ReplayEvent, ReplayRun } from './types'
import { isReplayRun } from './types'

function formatCount(n?: number): string {
  if (n === undefined) return '—'
  return Intl.NumberFormat('en-US', { notation: n > 999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n)
}
function formatDuration(ms?: number): string {
  if (ms === undefined) return '—'
  return ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} sec`
}
function kindLabel(event: ReplayEvent): string {
  return ({ task: 'INITIALIZED', tool: 'TOOL CALL', edit: 'FILE CHANGE', message: 'MESSAGE', warning: 'OBSERVATION', finish: 'COMPLETED' })[event.kind]
}
const eventIcons = { task: Sparkles, tool: Terminal, edit: FileCode2, message: Braces, warning: CircleAlert, finish: BadgeCheck }

function AgentAvatar({ event, playing }: { event: ReplayEvent, playing: boolean }) {
  return <div className={`character-character ${playing ? 'agent-busy' : ''} ${event.status === 'error' ? 'agent-warn' : ''}`} aria-label="Illustrated replay character">
    <div className="agent-aura" />
    <div className="agent-shadow" />
    <div className="agent-body">
      <div className="antenna"><span /></div>
      <div className="agent-head">
        <span className="agent-eye" /><span className="agent-eye" />
        <span className="agent-mouth" />
      </div>
      <div className="agent-neck" />
      <div className="agent-chest"><span className="agent-light" /> <span className="agent-seam"/></div>
      <div className="agent-arm arm-left" /><div className="agent-arm arm-right" />
    </div>
    <div className="orbit orbit-1">✳</div><div className="orbit orbit-2">✦</div>
  </div>
}

function Metric({ label, value, detail }: { label: string, value: string, detail?: string }) {
  return <div className="metric">
    <span className="metric-label">{label}</span>
    <strong>{value}</strong>
    {detail && <span className="metric-detail">{detail}</span>}
  </div>
}

export default function App() {
  const [runs, setRuns] = useState<ReplayRun[]>([])
  const [selectedId, setSelectedId] = useState('demo-test-first')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showCompare, setShowCompare] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [loadError, setLoadError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    const base = import.meta.env.BASE_URL
    async function load() {
      try {
        const indexRes = await fetch(`${base}traces/index.json`)
        if (!indexRes.ok) throw new Error('Could not load trace index')
        const paths: unknown = await indexRes.json()
        if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string' && /^[-\w]+\.json$/.test(p))) {
          throw new Error('Unexpected trace index format')
        }
        const data = await Promise.all(paths.map(async (p: string) => {
          const res = await fetch(`${base}traces/${p}`)
          if (!res.ok) throw new Error(`Could not load ${p}`)
          const parsed: unknown = await res.json()
          if (!isReplayRun(parsed)) throw new Error(`Invalid schema in ${p}`)
          return parsed
        }))
        if (active) setRuns(data)
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Failed to load traces')
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const selected = runs.find(r => r.id === selectedId) ?? runs[0]
  const events = selected?.events ?? []
  const current = events[Math.min(step, Math.max(0, events.length - 1))]
  const compareRuns = runs.filter(r => r.taskId === selected?.taskId)

  useEffect(() => {
    if (!playing || events.length === 0) return
    const interval = window.setInterval(() => {
      setStep(s => Math.min(s + 1, events.length - 1))
    }, 1450 / speed)
    return () => window.clearInterval(interval)
  }, [playing, speed, events.length])

  useEffect(() => {
    if (events.length && step >= events.length - 1) setPlaying(false)
  }, [step, events.length])

  function chooseRun(id: string) {
    setSelectedId(id)
    setStep(0)
    setPlaying(false)
    setShowCompare(false)
  }
  function togglePlay() {
    if (!events.length) return
    if (step >= events.length - 1) setStep(0)
    setPlaying(!playing)
  }
  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    try {
      if (file.size > 2_000_000) throw new Error('Please upload a JSON trace smaller than 2 MB.')
      const data: unknown = JSON.parse(await file.text())
      if (!isReplayRun(data)) throw new Error('Invalid trace. Expected AgentScope schemaVersion 1.')
      // A local file is not sent to a server. Do not treat uploaded data as trusted HTML.
      const safe = { ...data, id: `upload-${Date.now()}` }
      setRuns(previous => [...previous.filter(run => !run.id.startsWith('upload-')), safe])
      setSelectedId(safe.id)
      setPlaying(false)
      setShowCompare(false)
      setStep(0)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to read file')
    } finally {
      e.target.value = ''
    }
  }
  function downloadSelected() {
    if (!selected) return
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected.id}.json`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-glyph">✳</span><span>agent<span className="brand-muted">scope</span></span><span className="version-pill">v0.1</span></div>
      <nav className="toplinks" aria-label="Main navigation">
        <a className="nav-current" href="#workspace">Explore</a>
        <a href="#method">How it works</a>
      </nav>
      <span className="live-notice"><span className="notice-dot"/> NO LIVE INFERENCE</span>
    </header>

    <main>
      <section className="intro" id="workspace">
        <div className="eyebrow"><span className="eyebrow-line" /> AN INTERACTIVE AGENT OBSERVATORY <span className="eyebrow-line" /></div>
        <h1>See the work <span>behind</span><br/> the answer<span className="orange-period">.</span></h1>
        <p className="intro-copy">Follow recorded AI agent executions, inspect each decision point, and discover why different approaches lead to different outcomes.</p>
        <div className="intro-chips"><span><Eye size={14}/> Observe</span><span><GitBranch size={14}/> Compare</span><span><ShieldCheck size={14}/> Evaluate</span></div>
      </section>

      <section className="workbench" aria-label="Replay workbench">
        <aside className="work-sidebar">
          <div className="panel-title"><span>01 / EXPERIMENTS</span><Layers size={15}/></div>
          <div className="scenario-title">API VALIDATION</div>
          <div className="run-list">
            {runs.length === 0 && !loadError && <div className="run-placeholder">Loading experiments…</div>}
            {loadError && <div className="error-banner">{loadError}</div>}
            {runs.map((run, i) => <button key={run.id} className={`run-option ${selected?.id === run.id ? 'run-selected' : ''}`} onClick={() => chooseRun(run.id)}>
              <div className="run-number">{String(i + 1).padStart(2,'0')}</div>
              <div className="run-content"><strong>{run.strategy}</strong><span>{run.source === 'illustrative' ? 'Demo replay' : 'Recorded trace'}</span></div>
              <ChevronRight size={15}/>
            </button>)}
          </div>
          <div className="sidebar-bottom">
            <div className="sidebar-note"><span className="info-star">✳</span><p>What you're seeing is a replay, not a live AI conversation.</p></div>
            <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => { void handleUpload(e) }} aria-label="Upload AgentScope trace JSON" />
            <button className="upload-button" onClick={() => fileInput.current?.click()}><Upload size={16}/> Import your own trace</button>
            {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
          </div>
        </aside>

        <div className="main-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">02 / EXECUTION REPLAY</span><h2>{selected?.taskTitle ?? 'Loading experiment…'}</h2><p>{selected?.description}</p></div>
            <span className="origin-tag">{selected?.source === 'illustrative' ? 'ILLUSTRATIVE DATA' : 'RECORDED RUN'}</span>
          </div>
          <div className="execution-scene">
            <div className="scene-decoration"><span>AGENT / 01</span><span>WORKSPACE ACTIVE</span></div>
            {current ? <AgentAvatar event={current} playing={playing}/> : <div className="empty-state">Loading trace…</div>}
            <div className="scene-caption"><span className={`status-dot ${current?.status === 'error' ? 'warning-dot' : ''}`} /> {current ? (current.kind === 'finish' ? 'TASK COMPLETE' : playing ? 'REPLAYING ACTIVITY' : 'AWAITING NEXT STEP') : 'LOADING'}</div>
          </div>

          {current && <div className="event-focus">
            <div className="event-focus-header"><span className="event-kind">{kindLabel(current)}</span><span className="event-count">EVENT {String(step+1).padStart(2,'0')} / {String(events.length).padStart(2,'0')}</span></div>
            <div className="event-focus-main"><div className={`event-glyph status-${current.status}`}>{(() => { const Icon = eventIcons[current.kind]; return <Icon size={21}/> })()}</div><div><h3>{current.title}</h3><p>{current.detail}</p></div></div>
            {current.command && <div className="code-line"><span>$</span><code>{current.command}</code></div>}
          </div>}

          <div className="playback-controls">
            <button className="icon-button" title="Restart" onClick={() => { setStep(0); setPlaying(false) }} disabled={!current}><RotateCcw size={17}/></button>
            <button className="icon-button" title="Previous step" onClick={() => { setPlaying(false); setStep(i=>Math.max(0,i-1)) }} disabled={step===0}><ChevronLeft size={20}/></button>
            <button className="play-button" onClick={togglePlay} disabled={!current}>{playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}{playing ? 'Pause' : step===events.length - 1 ? 'Replay' : 'Play execution'}</button>
            <button className="icon-button" title="Next step" onClick={() => { setPlaying(false); setStep(i=>Math.min(events.length-1,i+1)) }} disabled={!current || step>=events.length-1}><ChevronRight size={20}/></button>
            <div className="progress-area"><span>STEP {events.length ? step+1 : 0} / {events.length}</span><input aria-label="Replay progress" type="range" min="0" max={Math.max(0, events.length-1)} value={step} onChange={e => { setStep(Number(e.target.value)); setPlaying(false) }} disabled={!current} /></div>
            <select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select>
          </div>

          <div className="timeline-head"><div><span className="section-kicker">03 / TRACE</span><h3>What happened, step by step</h3></div><span className="trace-count">{events.length} EVENTS</span></div>
          <div className="timeline">
            {events.map((event, idx) => { const Icon = eventIcons[event.kind]; return <button key={event.id} className={`timeline-item ${idx===step?'timeline-active':''} ${idx<step?'timeline-done':''}`} onClick={()=>{setPlaying(false);setStep(idx)}}>
              <div className="timeline-marker"><Icon size={14}/></div>
              <div className="timeline-text"><strong>{event.title}</strong><span>{kindLabel(event)}</span></div><span className="timeline-index">{String(idx+1).padStart(2,'0')}</span>
            </button> })}
          </div>
        </div>

        <aside className="inspector">
          <div className="panel-title"><span>04 / INSPECTOR</span><Activity size={15}/></div>
          <div className="inspector-section"><span className="small-label">EXECUTION STRATEGY</span><h3>{selected?.strategy ?? '—'}</h3><p>{selected?.description ?? '—'}</p></div>
          <div className="inspector-section"><span className="small-label">RUN METRICS</span>
            <div className="metrics-grid">
              <Metric label="INPUT TOKENS" value={formatCount(selected?.metrics.inputTokens)}/>
              <Metric label="OUTPUT TOKENS" value={formatCount(selected?.metrics.outputTokens)}/>
              <Metric label="TOOL CALLS" value={formatCount(selected?.metrics.toolCalls)}/>
              <Metric label="DURATION" value={formatDuration(selected?.metrics.durationMs)}/>
            </div>
          </div>
          <div className="inspector-section"><span className="small-label">EVALUATION</span>
            <div className={`evaluation-pill eval-${selected?.evaluation.status ?? 'not_run'}`}>
              {selected?.evaluation.status === 'passed' ? <CheckCircle2 size={17}/> : selected?.evaluation.status === 'failed' ? <CircleAlert size={17}/> : <Clock3 size={17}/>}
              {selected?.evaluation.status === 'passed' ? 'Passed checks' : selected?.evaluation.status === 'failed' ? 'Failed checks' : 'Not evaluated'}
            </div>
            <p>{selected?.evaluation.notes ?? 'No independent evaluation has been attached to this run.'}</p>
          </div>
          <div className="inspector-section provenance"><span className="small-label">PROVENANCE</span>
            <div className="provenance-row"><span>Source</span><strong>{selected?.source === 'illustrative' ? 'Hand-authored demo' : 'Codex JSONL import'}</strong></div>
            <div className="provenance-row"><span>Model</span><strong>{selected?.model ?? 'Not specified'}</strong></div>
            <div className="provenance-row"><span>Task ID</span><strong>{selected?.taskId ?? '—'}</strong></div>
          </div>
          <div className="inspector-actions"><button className="compare-button" disabled={compareRuns.length<2} onClick={()=>setShowCompare(c=>!c)}><GitBranch size={16}/>{showCompare?'Hide comparison':'Compare strategies'}<ArrowRight size={16}/></button><button className="download-button" disabled={!selected} onClick={downloadSelected}><Download size={15}/> Export trace JSON</button></div>
        </aside>
      </section>

      {showCompare && compareRuns.length>=2 && <section className="comparison" aria-label="Strategy comparison"><div className="comparison-header"><span className="section-kicker">05 / COMPARISON</span><h2>Same task. Different paths.</h2><p>These demo values illustrate the comparison layout, not benchmark findings.</p></div><div className="comparison-grid">{compareRuns.map(r=><article key={r.id} className="comparison-card"><div className="comparison-card-header"><strong>{r.strategy}</strong><span>{r.source === 'illustrative' ? 'DEMO' : 'RECORDED'}</span></div><div className="comparison-metrics"><div><span>Input tokens</span><strong>{formatCount(r.metrics.inputTokens)}</strong></div><div><span>Tool calls</span><strong>{formatCount(r.metrics.toolCalls)}</strong></div><div><span>Checks</span><strong>{r.evaluation.status === 'not_run' ? 'Not run' : `${r.evaluation.testsPassed ?? '—'} / ${r.evaluation.testsTotal ?? '—'}`}</strong></div></div><button onClick={()=>{chooseRun(r.id);document.getElementById('workspace')?.scrollIntoView({behavior:'smooth'})}}>Open replay <ArrowRight size={15}/></button></article>)}</div></section>}

      <section className="method" id="method"><div><span className="section-kicker">HOW IT WORKS</span><h2>Record once.<br/><em>Explore indefinitely.</em></h2></div><div className="method-steps"><div><div className="method-icon"><Code2 size={20}/></div><strong>01 / CAPTURE</strong><p>Run Codex locally and save the JSONL stream. The visitor never calls an AI API.</p></div><div><div className="method-icon"><Braces size={20}/></div><strong>02 / NORMALIZE</strong><p>Convert supported events into an intentionally limited, human-reviewable replay schema.</p></div><div><div className="method-icon"><Zap size={20}/></div><strong>03 / REPLAY</strong><p>Stream the saved sequence into a visual timeline and compare configured runs.</p></div></div></section>
    </main>
    <footer className="footer"><div><span className="brand-glyph">✳</span> AGENTSCOPE <span className="footer-separator">/</span> BUILD 0.1</div><div><span><Check size={13}/> No live inference</span><span><ArrowLeft size={13}/> Made to explore <ArrowRight size={13}/></span></div></footer>
  </div>
}
