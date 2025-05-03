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
  [WORKFLOW_STATUS.SYNCED]: "Local files match YouTrack version",
  [WORKFLOW_STATUS.MODIFIED]: "Local files have changes not in YouTrack",
  [WORKFLOW_STATUS.OUTDATED]: "YouTrack version is ahead of local files",
  [WORKFLOW_STATUS.CONFLICT]: "Both local and YouTrack versions have changes",
  [WORKFLOW_STATUS.MISSING]: "Workflow exists in project but no local files",
  [WORKFLOW_STATUS.NEW]: "Local files exist but workflow not in YouTrack",
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
  // Text modifiers
  STYLE: {
    RESET: "\x1b[0m",
    BRIGHT: "\x1b[1m",
    DIM: "\x1b[2m",
    ITALIC: "\x1b[3m",
    UNDERLINE: "\x1b[4m",
  },
} as const

// Color configurations for each workflow status
export const STATUS_COLORS = {
  [WORKFLOW_STATUS.SYNCED]: COLORS.FG.GREEN,
  [WORKFLOW_STATUS.MODIFIED]: COLORS.FG.YELLOW,
  [WORKFLOW_STATUS.OUTDATED]: COLORS.FG.BLUE,
  [WORKFLOW_STATUS.CONFLICT]: COLORS.FG.RED,
  [WORKFLOW_STATUS.MISSING]: COLORS.FG.MAGENTA,
  [WORKFLOW_STATUS.NEW]: COLORS.FG.CYAN,
  [WORKFLOW_STATUS.UNKNOWN]: COLORS.FG.WHITE,
} as const
