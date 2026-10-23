export type FinaleState = { kind: 'answer' | 'aborted' | 'error'; label: string; id: string }
export type Preview = { theme: string; id: string }
/** What the running turn is doing, and the tool when it is running one. */
export type Activity = { act: 'think' | 'tool' | 'ask' | 'say' | 'wait'; tool?: string }
export type PetStats = { xp: number; love: number }

/** A run of cells in a pet's frame. */
export type DockSeg = { text: string; c?: string; bg?: string; b?: boolean; d?: boolean }

/**
 * The companion as spinner publishes it (`showtime.dock`) for whoever draws it:
 * one loop of its current state. Kept alike in spinner's and hud's contracts.
 */
export type DockPet = {
  /** Changes with the state or a pat: the player starts over. */
  id: string
  /** Distinct frames, each its rows of runs. */
  frames: DockSeg[][][]
  /** The frames in play order, by index. */
  order: number[]
  ms: number
  /** Cells the pet takes across. */
  width: number
  bubble: string
  tone: 'plain' | 'ask' | 'error' | 'aborted' | 'sleep'
  /** `Lv.3 ♥12`. */
  stats: string
  /** The feed's current task, `▸ Write the feed`; absent without one, or with the feed off. */
  task?: string
  /** The plan's progress beside the stats, `1/4 ▮▮▯▯▯▯▯ 2m 14s`; absent as `task` is. */
  progress?: string
  /** The progress alone, `1/4`, for the one-row pet. */
  ratio?: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type FeedTask = { id: string; subject: string; status: TaskStatus }
export type FeedAgent = { id: string; description: string; type: string; tool?: string; since: number }
/** The running tools of the main loop, by tool_use_id. */
export type Running = Record<string, { tool: string; label: string }>
/** What the companion block and the scenes read: tasks, subagents, running tools. Plain data. */
export type Feed = {
  tasks: FeedTask[]
  source: 'tasks' | 'todos' | null
  /** When the in-progress task began, else when the turn began; null between turns. */
  startedAt: number | null
  agents: FeedAgent[]
  running: Running
}

declare module 'claude-code' {
  interface PluginState {
    showtime: {
      theme: string
      choice: string
      isHidden: boolean | null
      isStageOff: boolean | null
      isCompanionOff: boolean | null
      isFeedOff: boolean | null
      finale: FinaleState | null
      preview: Preview | null
      activity: Activity
      mood: 'hello' | 'ready' | 'aborted' | 'error' | 'sleep'
      pet: PetStats
      pat: string | null
      /** What the pet says for a moment about a command that just ran: tests, a commit. */
      news: { kind: 'testPass' | 'testFail' | 'commit'; id: string } | null
      /** The pet for whoever draws it; null while it is off. */
      dock: DockPet | null
      /** Whether a turn is running. */
      isTurn: boolean
      /** True while a `/` or `@` picker is open above the band. */
      isPicking: boolean
      /** Tasks, subagents and running tools of the turn. */
      feed: Feed
    }
    /** hud's side of the pet's place (read only). */
    hud: {
      /** True while hud draws the pet beside its rows. */
      dock: boolean
      /** Counts the pats hud's drawing of the pet took. */
      petPats: number
    }
  }
}
