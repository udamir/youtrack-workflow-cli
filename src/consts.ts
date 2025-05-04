export const WORKFLOW_STATUS = {
  SYNCED: "Synced",
  MODIFIED: "Modified",
  OUTDATED: "Outdated",
  CONFLICT: "Conflict",
  MISSING: "Missing",
  NEW: "New",
  UNKNOWN: "Unknown",
} as const

export const WORKFLOW_SYMBOL = {
  [WORKFLOW_STATUS.SYNCED]: "✓",
  [WORKFLOW_STATUS.MODIFIED]: "↑",
  [WORKFLOW_STATUS.OUTDATED]: "↓",
  [WORKFLOW_STATUS.CONFLICT]: "!",
  [WORKFLOW_STATUS.MISSING]: "?",
  [WORKFLOW_STATUS.NEW]: "+",
  [WORKFLOW_STATUS.UNKNOWN]: "-",
} as const

export const WORKFLOW_DESCRIPTION = {
  [WORKFLOW_STATUS.SYNCED]: "Synced",
  [WORKFLOW_STATUS.MODIFIED]: "Modified locally",
  [WORKFLOW_STATUS.OUTDATED]: "Outdated (server has newer version)",
  [WORKFLOW_STATUS.CONFLICT]: "Conflict",
  [WORKFLOW_STATUS.MISSING]: "Missing locally",
  [WORKFLOW_STATUS.NEW]: "New (not on server)",
  [WORKFLOW_STATUS.UNKNOWN]: "Unknown status",
} as const

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
  },
  // Styles
  STYLE: {
    BRIGHT: "\x1b[1m",
    DIM: "\x1b[2m",
    ITALIC: "\x1b[3m",
    UNDERLINE: "\x1b[4m",
  },
  // Reset code
  RESET: "\x1b[0m"
} as const

// Color mapping for workflow status colors
export const STATUS_COLORS = {
  [WORKFLOW_STATUS.SYNCED]: COLORS.FG.GREEN,
  [WORKFLOW_STATUS.MODIFIED]: COLORS.FG.YELLOW,
  [WORKFLOW_STATUS.OUTDATED]: COLORS.FG.BLUE,
  [WORKFLOW_STATUS.CONFLICT]: COLORS.FG.RED,
  [WORKFLOW_STATUS.MISSING]: COLORS.FG.MAGENTA,
  [WORKFLOW_STATUS.NEW]: COLORS.FG.CYAN,
  [WORKFLOW_STATUS.UNKNOWN]: COLORS.FG.WHITE,
} as const

export const PROGRESS_STATUS = {
  SUCCESS: "success",
  WARNING: "warning",
  FAILED: "failed"
} as const

export const PROGRESS_STATUS_ICON = {
  [PROGRESS_STATUS.SUCCESS]: '✓',
  [PROGRESS_STATUS.WARNING]: '⚠',
  [PROGRESS_STATUS.FAILED]: '✗',
} as const

// Color mapping for workflow status colors
export const PROGRESS_STATUS_COLOR = {
  [PROGRESS_STATUS.SUCCESS]: COLORS.FG.GREEN,
  [PROGRESS_STATUS.WARNING]: COLORS.FG.YELLOW,
  [PROGRESS_STATUS.FAILED]: COLORS.FG.RED,
} as const
