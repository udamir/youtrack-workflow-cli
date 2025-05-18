import { COLORS, PROGRESS_STATUS_DATA } from "./consts"
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
export function normalize(input: string, capitalizeFirst = false, prefix = '_'): string {
  const result = input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0 && !capitalizeFirst
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join('');

  return result ? (/\d/.test(result[0]) ? prefix + result : result) : prefix;
}
