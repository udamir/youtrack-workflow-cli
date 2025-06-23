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

export const colorizeIcon = ({ icon, color }: { icon: string; color: string }): string => {
  return `${color}${icon}${COLORS.RESET}`
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
  const statusData = PROGRESS_STATUS_DATA[status]
  console.log(`${" ".repeat(shift)}${colorizeIcon(statusData)} ${item}: ${colorize(message, statusData.color)}`)
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
 * Format a date into a human-readable string
 * @param date Date to format
 * @param includeTime Whether to include time in the output
 * @returns Formatted date string
 */
export function formatDate(date: Date, includeTime = true): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  if (!includeTime) {
    return `${year}-${month}-${day}`
  }

  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Prettify workflow name and message content by:
 * 1. Removing 'scripts/' prefix from workflow names if present
 * 2. Replacing "<js> " with newlines
 * 3. Converting character position information in stacktrace lines to position within the line
 * @param text Text to prettify
 * @param fileContent File content to calculate position within lines
 * @returns Prettified text
 */
export const prettifyStacktrace = (text: unknown, fileContent: string): string => {
  // Handle non-string input or undefined/null
  if (text === null || text === undefined) return ""

  // Convert to string if it's not already a string
  const textStr = String(text)

  // First replace scripts/ prefix with just the workflow name
  let result = textStr.replace(/\(scripts\//g, "( ")

  // Then replace all instances of <js> with newlines, handling both with and without spaces
  result = result.replace(/,?<js> /g, "\n ")

  // Convert absolute character positions to positions within lines
  // Example: action(templates/action-template.js:26:911-926) -> action(templates/action-template.js:26:10)
  result = result.replace(/(\.js:(\d+)):(\d+)-(\d+)/g, (match, fileLinePart, lineNum, startChar, endChar) => {
    const lines = fileContent.substring(0, Number.parseInt(startChar, 10)).split("\n")
    return `${fileLinePart}:${lines[Number.parseInt(lineNum, 10) - 1]?.length ?? 0} `
  })

  return result
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
    this._counters[status] = (this._counters[status] || 0) + 1
  }

  /**
   * Get the count for a specific status
   * @param status Status to get count for
   * @returns Count of items in the specified status
   */
  public get(status: string): number {
    return this._counters[status] || 0
  }

  /**
   * Get the total count of all statuses
   * @returns Total count of all statuses
   */
  public get total(): number {
    return Object.values(this._counters).reduce((acc, count) => acc + count, 0)
  }
}

// Types for the result object with discriminated union
type Success<T> = [T, null]

type Failure<E> = [null, E]

type Result<T, E = Error> = Success<T> | Failure<E>

/**
 * Wraps a promise and returns a tuple with the result or error
 * @param promise Promise to wrap
 * @returns Tuple with the result or error
 */
export const tryCatch = async <T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> => {
  try {
    const data = await promise
    return [data, null]
  } catch (error) {
    return [null, error as E]
  }
}
