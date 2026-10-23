import { expect, test } from 'claude-code/testing'

import {
  EMPTY_FEED, agentRow, applyAgentDone, applyAgentTool, applySpawn, applyTaskResult, clearTurn, clip, progressOf, taskLine, toolKindOf,
} from '../hooks/feed'
import type { Feed } from '../types'

const NOW = 1_000_000

test('TaskCreate adds a pending task; TaskUpdate moves it; in_progress sets startedAt', () => {
  let f = applyTaskResult(EMPTY_FEED, 'TaskCreate', { subject: 'Write feed' }, { task: { id: '1', subject: 'Write feed' } }, NOW)
  expect(f.tasks).toEqual([{ id: '1', subject: 'Write feed', status: 'pending' }])
  expect(f.source).toBe('tasks')
  f = applyTaskResult(f, 'TaskUpdate', { taskId: '1', status: 'in_progress' }, { success: true, taskId: '1', updatedFields: ['status'], statusChange: { from: 'pending', to: 'in_progress' } }, NOW + 5)
  expect(f.tasks[0]!.status).toBe('in_progress')
  expect(f.startedAt).toBe(NOW + 5)
  f = applyTaskResult(f, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: true, taskId: '1', updatedFields: ['status'], statusChange: { from: 'in_progress', to: 'completed' } }, NOW + 9)
  expect(f.tasks[0]!.status).toBe('completed')
})

test('a TaskUpdate for an unseen id names it task <id> until TaskList names it', () => {
  let f = applyTaskResult(EMPTY_FEED, 'TaskUpdate', { taskId: '7', status: 'in_progress' }, { success: true, taskId: '7', updatedFields: ['status'], statusChange: { from: 'pending', to: 'in_progress' } }, NOW)
  expect(f.tasks).toEqual([{ id: '7', subject: 'task 7', status: 'in_progress' }])
  f = applyTaskResult(f, 'TaskList', {}, { tasks: [{ id: '7', subject: 'Polish nyan', status: 'in_progress', blockedBy: [] }, { id: '8', subject: 'Release', status: 'pending', blockedBy: ['7'] }] }, NOW)
  expect(f.tasks.map(t => t.subject)).toEqual(['Polish nyan', 'Release'])
})

test('TodoWrite fills the list only while native tasks are not in use; an empty list clears', () => {
  let f = applyTaskResult(EMPTY_FEED, 'TodoWrite', {}, { oldTodos: [], newTodos: [{ content: 'a', status: 'in_progress', activeForm: 'Doing a' }, { content: 'b', status: 'pending', activeForm: 'Doing b' }] }, NOW)
  expect(f.source).toBe('todos')
  expect(f.tasks.map(t => t.subject)).toEqual(['a', 'b'])
  f = applyTaskResult(f, 'TaskCreate', { subject: 'n' }, { task: { id: '1', subject: 'n' } }, NOW)
  expect(f.source).toBe('tasks')
  expect(f.tasks.map(t => t.subject)).toEqual(['n'])
  f = applyTaskResult(f, 'TodoWrite', {}, { oldTodos: [], newTodos: [{ content: 'z', status: 'pending', activeForm: 'z' }] }, NOW)
  expect(f.tasks.map(t => t.subject)).toEqual(['n'])
  f = applyTaskResult(f, 'TaskList', {}, { tasks: [] }, NOW)
  expect(f.tasks).toEqual([])
  expect(f.source).toBeNull()
})

test('a denied call or a result without the expected fields leaves the feed unchanged', () => {
  const f = applyTaskResult(EMPTY_FEED, 'TaskCreate', { subject: 'x' }, { task: { id: '1', subject: 'x' } }, NOW)
  expect(applyTaskResult(f, 'TaskCreate', {}, undefined, NOW)).toBe(f)
  expect(applyTaskResult(f, 'TaskUpdate', {}, { success: false, taskId: '1', updatedFields: [] }, NOW)).toBe(f)
  expect(applyTaskResult(f, 'TodoWrite', {}, { nonsense: true }, NOW)).toBe(f)
  expect(applyTaskResult(f, 'Bash', {}, { result: 'out' }, NOW)).toBe(f)
})

test('agents spawn, pick up a tool, and finish', () => {
  let f = applySpawn(EMPTY_FEED, { id: 'a1', description: 'review the diff', type: 'reviewer' }, NOW)
  f = applySpawn(f, { id: 'a2', description: 'run the tests', type: 'checker' }, NOW + 1)
  f = applyAgentTool(f, 'a1', 'Grep: TODO')
  f = applyAgentTool(f, 'zz', 'Bash: ls')
  expect(f.agents.map(a => [a.id, a.tool])).toEqual([['a1', 'Grep: TODO'], ['a2', undefined]])
  f = applyAgentDone(f, 'a1')
  expect(f.agents.map(a => a.id)).toEqual(['a2'])
  expect(applyAgentDone(f, 'none')).toBe(f)
})

test('clearTurn drops tasks, startedAt, running and every agent still listed', () => {
  let f = applySpawn(EMPTY_FEED, { id: 'a1', description: 'd', type: 'x' }, NOW)
  f = applyTaskResult(f, 'TaskCreate', { subject: 'x' }, { task: { id: '1', subject: 'x' } }, NOW)
  f = { ...f, running: { c1: { tool: 'Bash', label: 'Bash: ls' } }, startedAt: NOW }
  expect(clearTurn(f)).toEqual(EMPTY_FEED)
})

test('progressOf: done/total, a seven-cell bar and the elapsed time; null without tasks', () => {
  expect(progressOf(EMPTY_FEED, NOW)).toBeNull()
  const tasks: Feed['tasks'] = [
    { id: '1', subject: 'a', status: 'completed' },
    { id: '2', subject: 'b', status: 'completed' },
    { id: '3', subject: 'c', status: 'completed' },
    { id: '4', subject: 'd', status: 'in_progress' },
    { id: '5', subject: 'e', status: 'pending' },
    { id: '6', subject: 'f', status: 'pending' },
    { id: '7', subject: 'g', status: 'pending' },
  ]
  const p = progressOf({ ...EMPTY_FEED, tasks, source: 'tasks', startedAt: NOW - 134_000 }, NOW)
  expect(p).toEqual({ done: 3, total: 7, bar: '▮▮▮▯▯▯▯', elapsed: '2m 14s', text: '3/7 ▮▮▮▯▯▯▯ 2m 14s', ratio: '3/7' })
  expect(progressOf({ ...EMPTY_FEED, tasks: tasks.map(t => ({ ...t, status: 'completed' as const })), source: 'tasks', startedAt: null }, NOW)!.text).toBe('7/7 ▮▮▮▮▮▮▮')
})

test('taskLine: the in-progress task, clipped; the first pending when none runs; empty without tasks', () => {
  expect(taskLine(EMPTY_FEED, 40)).toBe('')
  const f: Feed = { ...EMPTY_FEED, source: 'tasks', tasks: [{ id: '1', subject: 'Done thing', status: 'completed' }, { id: '2', subject: 'Implement the feed model for the companion block', status: 'in_progress' }] }
  expect(taskLine(f, 30)).toBe('▸ Implement the feed model fo…')
  expect(taskLine({ ...f, tasks: [{ id: '3', subject: 'Next', status: 'pending' }] }, 30)).toBe('▹ Next')
})

test('agentRow: type, description, tool; as many as fit, then +n more', () => {
  let f = applySpawn(EMPTY_FEED, { id: 'a1', description: 'review the diff', type: 'reviewer' }, NOW)
  f = applyAgentTool(f, 'a1', 'Grep: TODO')
  f = applySpawn(f, { id: 'a2', description: 'run the tests', type: 'checker' }, NOW)
  f = applySpawn(f, { id: 'a3', description: 'a very long description that goes on and on and on past thirty cells', type: 'general-purpose' }, NOW)
  expect(agentRow(f, 200)).toBe('⤷ reviewer · review the diff (Grep)  │  checker · run the tests  │  general-purpose · a very long description that …')
  expect(agentRow(f, 60)).toBe('⤷ reviewer · review the diff (Grep)  │  +2 more')
  expect(agentRow(EMPTY_FEED, 60)).toBe('')
})

test('toolKindOf', () => {
  expect(['Bash', 'Edit', 'Read', 'Grep', 'Agent', 'WebSearch', 'mcp__peek__show_image'].map(toolKindOf)).toEqual(['bash', 'edit', 'read', 'search', 'agent', 'web', 'other'])
  expect(['Write', 'NotebookEdit', 'Glob', 'WebFetch', 'Task', 'MultiEdit'].map(toolKindOf)).toEqual(['edit', 'edit', 'search', 'web', 'agent', 'edit'])
})

test('clip keeps CJK widths and strips control characters', () => {
  expect(clip('abc\u0007def', 10)).toBe('abcdef')
  expect(clip('中文字符串测试', 8)).toBe('中文字…')
  expect(clip('short', 5)).toBe('short')
})

test('the names the caller passes in are used: a task named by id, the agents past what fits', () => {
  const f = applyTaskResult(EMPTY_FEED, 'TaskUpdate', { taskId: '7', status: 'in_progress' }, { success: true, taskId: '7', updatedFields: ['status'], statusChange: { from: 'pending', to: 'in_progress' } }, NOW, id => `任务 ${id}`)
  expect(f.tasks[0]!.subject).toBe('任务 7')
  let g = applySpawn(EMPTY_FEED, { id: 'a1', description: 'review the diff', type: 'reviewer' }, NOW)
  g = applySpawn(g, { id: 'a2', description: 'run the tests', type: 'checker' }, NOW)
  g = applySpawn(g, { id: 'a3', description: 'lint', type: 'linter' }, NOW)
  expect(agentRow(g, 40, n => `+${n} más`)).toBe('⤷ reviewer · review the diff  │  +2 más')
})

test('EMPTY_FEED is frozen: a consumer cannot corrupt the reset value', () => {
  expect(Object.isFrozen(EMPTY_FEED)).toBe(true)
  expect(Object.isFrozen(EMPTY_FEED.tasks)).toBe(true)
  expect(Object.isFrozen(EMPTY_FEED.agents)).toBe(true)
  expect(Object.isFrozen(EMPTY_FEED.running)).toBe(true)
  expect(() => (EMPTY_FEED.tasks as unknown[]).push(1)).toThrow()
})
