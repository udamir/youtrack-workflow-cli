import { COLORS, PROGRESS_STATUS_COLOR, PROGRESS_STATUS_ICON } from "./consts"
import type { ProgressStatus } from "./types"

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
export const printItemStatus = (item: string, status: ProgressStatus, message: string) => {
  console.log(`   ${colorize(PROGRESS_STATUS_ICON[status], PROGRESS_STATUS_COLOR[status])} ${item}: ${colorize(message, PROGRESS_STATUS_COLOR[status])}`)
}
