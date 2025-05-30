import { COLORS, PROGRESS_STATUS, PROGRESS_STATUS_DATA, WORKFLOW_STATUS } from "./consts"
import type { ProgressStatus, ActionResult, WorkflowStatus } from "./types"

/**
 * Returns an action result with a success status
 * @param message Message to display
 * @returns Action result with success status
 */
export const successStatus = (message: string): ActionResult => ({ status: "success", message })

/**
 * Returns an action result with a skipped status
 * @param message Error message to display
 * @returns Action result with skipped status
 */
export const skippedStatus = (message: string): ActionResult => ({ status: "skipped", message })

/**
 * Returns an action result with an error status
 * @param message Error message to display
 * @returns Action result with error status
 */
export const errorStatus = (message: string): ActionResult => ({ status: "error", message })

/**
 * Returns the progress status based on the action result
 * @param status Action result status or workflow status to get progress status from
 * @returns Progress status
 */
export const progressStatus = (status: ActionResult["status"] | WorkflowStatus): ProgressStatus => {
  switch (status) {
    case "error":
    case WORKFLOW_STATUS.CONFLICT:
      return PROGRESS_STATUS.FAILED
    case "success":
    case WORKFLOW_STATUS.SYNCED:
    case WORKFLOW_STATUS.NEW:
      return PROGRESS_STATUS.SUCCESS
    default:
      return PROGRESS_STATUS.WARNING
  }
}

/**
 * Color a string with ANSI color codes
 * @param text Text to color
 * @param fgColor Foreground color
 * @param style Style modifier (optional)
 * @returns Colored string
 */
export const colorize = (text: string, fgColor: string, style?: string): string => {
  const prefix = [fgColor, style].filter(Boolean).join("")
  return `${prefix}${text}${COLORS.RESET}`
}

/**
 * Check if a condition is an error and log a message
 * @param condition Condition to check
 * @param message Error message to log
 * @returns True if the condition is an error, false otherwise
 */
export const isError = (condition: unknown, message: string): boolean => {
  if (!condition) {
    return false
  }
  console.error(message)
  return true
}

/**
 * Print the status of a workflow or project
 * @param item Name of the workflow or project
 * @param status Status of the workflow or project
 * @param message Message to display
 */
export const printItemStatus = (item: string, status: ProgressStatus, message: string, shift = 0) => {
  const { icon, color } = PROGRESS_STATUS_DATA[status]
  console.log(`${" ".repeat(shift)}${colorize(icon, color)} ${item}: ${colorize(message, color)}`)
}

/**
 * Remove all spaces and "-" from the name
 * @param input Input string
 * @param capitalizeFirst Capitalize the first letter
 * @param prefix Prefix to add if the string starts with a number
 * @returns Normalized string
 */
export function normalize(input: string, capitalizeFirst = false, prefix = "_"): string {
  const result = input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0 && !capitalizeFirst ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("")

  return result ? (/\d/.test(result[0]) ? prefix + result : result) : prefix
}

/**
 * Counter for tracking the number of items in each status
 */
export class StatusCounter {
  private _counters: Record<string, number> = {}

  /**
   * Increment the counter for a specific status
   * @param status Status to increment
   */
  public inc(status: string): void {
    if (!this._counters[status]) {
      this._counters[status] = 0
    }
    this._counters[status]++
  }

  /**
   * Get the count for a specific status
   * @param status Status to get count for
   * @returns Count of items in the specified status
   */
  public get(status: string): number {
    return this._counters[status] ?? 0
  }

  /**
   * Get the total count of all statuses
   * @returns Total count of all statuses
   */
  public get total(): number {
    return Object.values(this._counters).reduce((a, b) => a + b, 0)
  }
}
