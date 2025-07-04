export const LOCK_FILE_NAME = "ytw.lock"

/**
 * ANSI color codes for terminal output
 */
export const COLORS = {
  // Foreground colors
  FG: {
    BLACK: "\x1b[30m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    WHITE: "\x1b[37m",
    GRAY: "\x1b[90m",
  },
  // Styles
  STYLE: {
    BRIGHT: "\x1b[1m",
    DIM: "\x1b[2m",
    ITALIC: "\x1b[3m",
    UNDERLINE: "\x1b[4m",
  },
  // Reset code
  RESET: "\x1b[0m",
} as const

/**
 * Log levels for workflow logs
 */
export const LEVELS = {
  INFO: "INFO",
  ERROR: "ERROR",
  WARNING: "WARNING",
  DEBUG: "DEBUG",
} as const

export const WORKFLOW_STATUS = {
  SYNCED: "Synced",
  MODIFIED: "Modified",
  OUTDATED: "Outdated",
  CONFLICT: "Conflict",
  MISSING: "Missing",
  NEW: "New",
  UNKNOWN: "Unknown",
} as const

export const WORKFLOW_STATUS_DATA = {
  [WORKFLOW_STATUS.SYNCED]: {
    icon: "✓",
    color: COLORS.FG.GREEN,
    description: "Synced",
  },
  [WORKFLOW_STATUS.MODIFIED]: {
    icon: "↑",
    color: COLORS.FG.YELLOW,
    description: "Modified locally",
  },
  [WORKFLOW_STATUS.OUTDATED]: {
    icon: "↓",
    color: COLORS.FG.BLUE,
    description: "Outdated (server has newer version)",
  },
  [WORKFLOW_STATUS.CONFLICT]: {
    icon: "!",
    color: COLORS.FG.RED,
    description: "Conflict",
  },
  [WORKFLOW_STATUS.MISSING]: {
    icon: "?",
    color: COLORS.FG.MAGENTA,
    description: "Missing locally",
  },
  [WORKFLOW_STATUS.NEW]: {
    icon: "+",
    color: COLORS.FG.CYAN,
    description: "New (not on server)",
  },
  [WORKFLOW_STATUS.UNKNOWN]: {
    icon: "-",
    color: COLORS.FG.WHITE,
    description: "Unknown status",
  },
} as const

export const PROGRESS_STATUS = {
  SUCCESS: "success",
  WARNING: "warning",
  FAILED: "failed",
  INFO: "info",
} as const

export const PROGRESS_STATUS_DATA = {
  [PROGRESS_STATUS.SUCCESS]: {
    icon: "✓",
    color: COLORS.FG.GREEN,
  },
  [PROGRESS_STATUS.WARNING]: {
    icon: "⚠",
    color: COLORS.FG.YELLOW,
  },
  [PROGRESS_STATUS.FAILED]: {
    icon: "✗",
    color: COLORS.FG.RED,
  },
  [PROGRESS_STATUS.INFO]: {
    icon: "ℹ",
    color: COLORS.FG.BLUE,
  },
} as const

export const LINT_STATUS = {
  OK: "ok",
  WARNING: "warning",
  FAILED: "failed",
} as const

export const LINT_STATUS_DATA = {
  [LINT_STATUS.OK]: {
    icon: "●",
    color: COLORS.FG.GREEN,
  },
  [LINT_STATUS.WARNING]: {
    icon: "●",
    color: COLORS.FG.YELLOW,
  },
  [LINT_STATUS.FAILED]: {
    icon: "●",
    color: COLORS.FG.RED,
  },
} as const

export const SYNC_TYPE = {
  PULL: "pull",
  PUSH: "push",
  SKIP: "skip",
} as const

export const WATCH_EVENT = {
  ADD: "add",
  CHANGE: "change",
  UNLINK: "unlink",
} as const

export const SYNC_STATUS = {
  PULLED: "pulled",
  PUSHED: "pushed",
  SKIPPED: "skipped",
  FAILED: "failed",
  SYNCED: "synced",
} as const
