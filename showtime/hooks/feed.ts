// The feed: what the companion block and the scenes read about the turn (its
// tasks, its subagents, its running tools), reduced from tool results and
// agent events. Pure: no engine, no clock; `now` comes in.
import { textWidth } from './cells'
import type { Feed, FeedAgent, FeedTask, TaskStatus } from '../types'

export const EMPTY_FEED: Feed = { tasks: [], source: null, startedAt: null, agents: [], running: {} }

export type ToolKind = 'bash' | 'edit' | 'read' | 'search' | 'agent' | 'web' | 'other'

const STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed']
const isStatus = (v: unknown): v is TaskStatus => STATUSES.includes(v as TaskStatus)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Control characters out, width-aware clipping with an ellipsis. */
export function clip(text: string, width: number): string {
  const clean = Array.from(text.replace(/[\u0000-\u001f\u007f]/g, ''))
  if (textWidth(clean.join('')) <= width) return clean.join('')
  let out = ''
  for (const ch of clean) {
    if (textWidth(out + ch) > width - 1) break
    out += ch
  }
  return `${out}…`
}

/** What a task tool's result does to the feed; the same feed back for anything it cannot read. */
export function applyTaskResult(feed: Feed, tool: string, input: unknown, result: unknown,
  now: number,
  taskName: (id: string) => string = id => `task ${id}`,
): Feed {
  if (!isRecord(result)) return feed
  if (tool === 'TaskCreate') {
    const task = result.task
    if (!isRecord(task) || typeof task.id !== 'string' || typeof task.subject !== 'string') return feed
    const tasks = feed.source === 'tasks' ? feed.tasks.filter(t => t.id !== task.id) : []
    return { ...feed, source: 'tasks', tasks: [...tasks, { id: task.id, subject: task.subject, status: 'pending' }] }
  }
  if (tool === 'TaskUpdate') {
    const change = result.statusChange
    if (result.success !== true || typeof result.taskId !== 'string' || !isRecord(change) || !isStatus(change.to)) return feed
    const id = result.taskId
    const tasks = feed.source === 'tasks' ? [...feed.tasks] : []
    const at = tasks.findIndex(t => t.id === id)
    if (at === -1) tasks.push({ id, subject: taskName(id), status: change.to })
    else tasks[at] = { ...tasks[at]!, status: change.to }
    return { ...feed, source: 'tasks', tasks, startedAt: change.to === 'in_progress' ? now : feed.startedAt }
  }
  if (tool === 'TaskList') {
    if (!Array.isArray(result.tasks)) return feed
    const tasks: FeedTask[] = []
    for (const t of result.tasks) {
      if (!isRecord(t) || typeof t.id !== 'string' || typeof t.subject !== 'string' || !isStatus(t.status)) return feed
      tasks.push({ id: t.id, subject: t.subject, status: t.status })
    }
    return tasks.length === 0 ? { ...feed, tasks: [], source: null } : { ...feed, source: 'tasks', tasks }
  }
  if (tool === 'TaskGet') {
    const task = result.task
    if (!isRecord(task) || typeof task.id !== 'string' || typeof task.subject !== 'string' || !isStatus(task.status)) return feed
    const tasks = feed.tasks.map(t => (t.id === task.id ? { ...t, subject: task.subject as string, status: task.status as TaskStatus } : t))
    return { ...feed, tasks }
  }
  if (tool === 'TodoWrite') {
    if (feed.source === 'tasks' || !Array.isArray(result.newTodos)) return feed
    const tasks: FeedTask[] = []
    for (const [i, t] of result.newTodos.entries()) {
      if (!isRecord(t) || typeof t.content !== 'string' || !isStatus(t.status)) return feed
      tasks.push({ id: String(i), subject: t.content, status: t.status })
    }
    if (tasks.length === 0) return { ...feed, tasks: [], source: null }
    const started = tasks.some(t => t.status === 'in_progress') && !feed.tasks.some(t => t.status === 'in_progress')
    return { ...feed, source: 'todos', tasks, startedAt: started ? now : feed.startedAt }
  }
  return feed
}

export function applySpawn(feed: Feed, agent: { id: string; description: string; type: string }, now: number): Feed {
  const kept = feed.agents.filter(a => a.id !== agent.id)
  return { ...feed, agents: [...kept, { ...agent, since: now }] }
}

export function applyAgentTool(feed: Feed, agentId: string, label: string | undefined): Feed {
  if (!feed.agents.some(a => a.id === agentId)) return feed
  return { ...feed, agents: feed.agents.map(a => (a.id === agentId ? { ...a, tool: label } : a)) }
}

export function applyAgentDone(feed: Feed, agentId: string): Feed {
  if (!feed.agents.some(a => a.id === agentId)) return feed
  return { ...feed, agents: feed.agents.filter(a => a.id !== agentId) }
}

/** The main turn ended: tasks, timing, running tools and any agent left go. */
export function clearTurn(_feed: Feed): Feed {
  return EMPTY_FEED
}

/** `12s`, `3m 05s`, `1h 02m`. */
function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

export type Progress = { done: number; total: number; bar: string; elapsed: string; text: string; ratio: string }

export function progressOf(feed: Feed, now: number): Progress | null {
  const total = feed.tasks.length
  if (total === 0) return null
  const done = feed.tasks.filter(t => t.status === 'completed').length
  const lit = Math.round((done / total) * 7)
  const bar = '▮'.repeat(lit) + '▯'.repeat(7 - lit)
  const elapsed = feed.startedAt === null || done === total ? '' : duration(now - feed.startedAt)
  const ratio = `${done}/${total}`
  return { done, total, bar, elapsed, ratio, text: [ratio, bar, elapsed].filter(Boolean).join(' ') }
}

export function taskLine(feed: Feed, width: number): string {
  const current = feed.tasks.find(t => t.status === 'in_progress')
  if (current) return clip(`▸ ${current.subject}`, width)
  const next = feed.tasks.find(t => t.status === 'pending')
  return next ? clip(`▹ ${next.subject}`, width) : ''
}

const SEP = '  │  '

/** One line for the agents running: as many as fit in `width`, the rest counted. */
export function agentRow(feed: Feed, width: number, more: (n: number) => string = n => `+${n} more`): string {
  if (feed.agents.length === 0) return ''
  const parts = feed.agents.map(a => {
    const tool = a.tool ? ` (${a.tool.split(':')[0]})` : ''
    return `${a.type} · ${clip(a.description, 30)}${tool}`
  })
  let line = '⤷ '
  for (let i = 0; i < parts.length; i++) {
    const left = parts.length - i
    const tail = left > 1 ? `${SEP}${more(left - 1)}` : ''
    const candidate = line + (i > 0 ? SEP : '') + parts[i]
    if (textWidth(candidate + tail) > width && i > 0) return `${line}${SEP}${more(left)}`
    line = candidate
  }
  return line
}

export function toolKindOf(tool: string): ToolKind {
  if (tool === 'Bash') return 'bash'
  if (tool === 'Edit' || tool === 'MultiEdit' || tool === 'Write' || tool === 'NotebookEdit') return 'edit'
  if (tool === 'Read') return 'read'
  if (tool === 'Grep' || tool === 'Glob') return 'search'
  if (tool === 'Agent' || tool === 'Task') return 'agent'
  if (tool === 'WebSearch' || tool === 'WebFetch') return 'web'
  return 'other'
}

export function agentsOf(feed: Feed): FeedAgent[] {
  return feed.agents
}
