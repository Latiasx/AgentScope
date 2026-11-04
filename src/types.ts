export type EventKind = 'task' | 'tool' | 'edit' | 'message' | 'warning' | 'finish'
export type EventStatus = 'info' | 'success' | 'error'

export interface ReplayEvent {
  id: string
  kind: EventKind
  title: string
  detail: string
  status: EventStatus
  command?: string
  atMs?: number
}

export interface ReplayRun {
  schemaVersion: 1
  id: string
  taskId: string
  taskTitle: string
  strategy: string
  description: string
  source: 'illustrative' | 'recorded'
  model?: string
  captureDate?: string
  events: ReplayEvent[]
  metrics: {
    inputTokens?: number
    outputTokens?: number
    toolCalls?: number
    durationMs?: number
  }
  evaluation: {
    status: 'passed' | 'failed' | 'not_run'
    testsPassed?: number
    testsTotal?: number
    notes?: string
  }
}

const kinds: EventKind[] = ['task', 'tool', 'edit', 'message', 'warning', 'finish']
const statuses: EventStatus[] = ['info', 'success', 'error']

export function isReplayRun(input: unknown): input is ReplayRun {
  if (!input || typeof input !== 'object') return false
  const r = input as Partial<ReplayRun>
  if (r.schemaVersion !== 1 || typeof r.id !== 'string' || typeof r.taskId !== 'string'
      || typeof r.taskTitle !== 'string' || typeof r.strategy !== 'string'
      || typeof r.description !== 'string' || !['illustrative', 'recorded'].includes(r.source ?? '')
      || !Array.isArray(r.events) || r.events.length === 0 || !r.metrics || !r.evaluation
      || !['passed', 'failed', 'not_run'].includes(r.evaluation.status)) return false
  return r.events.every((e: ReplayEvent) => e && typeof e.id === 'string'
    && typeof e.title === 'string' && typeof e.detail === 'string'
    && kinds.includes(e.kind) && statuses.includes(e.status))
}
