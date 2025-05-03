import { COLORS } from "./consts"

/**
 * Color a string with ANSI color codes
 * @param text Text to color
 * @param fgColor Foreground color
 * @param style Style modifier (optional)
 * @returns Colored string
 */
export const colorize = (text: string, fgColor: string, style?: string): string => {
  const prefix = [fgColor, style].filter(Boolean).join("")
  return `${prefix}${text}${COLORS.STYLE.RESET}`
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
