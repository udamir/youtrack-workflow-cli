import { COLORS, PROGRESS_STATUS_DATA } from "../consts"
import { colorize, colorizeIcon } from "../utils"
import type { ProgressStatus } from "../types"

/**
 * Get visible length of a string (excluding ANSI color codes)
 * @param str String that may contain ANSI color codes
 * @returns Visible length of the string
 */
const getVisibleLength = (str: string): number => {
  let visibleLength = 0
  let inEscapeSequence = false

  for (let i = 0; i < str.length; i++) {
    // Check for the start of an ANSI escape sequence
    if (str[i] === "\u001b" && str[i + 1] === "[") {
      inEscapeSequence = true
      continue
    }

    // Check for the end of an ANSI escape sequence
    if (inEscapeSequence && /[A-Za-z]/.test(str[i])) {
      inEscapeSequence = false
      continue
    }

    // Count characters only when not in an escape sequence
    if (!inEscapeSequence) {
      visibleLength++
    }
  }

  return visibleLength
}

export const printFrame = (
  text: string[],
  options: {
    leftPadding?: number
    rightPadding?: number
    topPadding?: number
    bottomPadding?: number
    indentSize?: number
    frameColor?: string
  } = {},
) => {
  const {
    leftPadding = 3,
    rightPadding = 3,
    topPadding = 1,
    bottomPadding = 1,
    indentSize = 3,
    frameColor = COLORS.FG.YELLOW,
  } = options

  // Add extra padding to make the frame wider and more visually pleasing
  const frameWidth = Math.max(...text.map((line) => getVisibleLength(line))) + leftPadding + rightPadding
  const indent = " ".repeat(indentSize)

  // Frame elements
  const vFrame = colorize("│", frameColor)
  const topFrame = colorize(`${indent}╭${"─".repeat(frameWidth)}╮`, frameColor)
  const bottomFrame = colorize(`${indent}╰${"─".repeat(frameWidth)}╯`, frameColor)

  // Helper to center text in available space
  const centerLine = (text: string) => {
    const visibleLength = getVisibleLength(text)
    const paddingTotal = frameWidth - visibleLength
    const paddingLeft = Math.floor(paddingTotal / 2)
    const paddingRight = Math.ceil(paddingTotal / 2)
    return `${indent}${vFrame}${" ".repeat(paddingLeft)}${text}${" ".repeat(paddingRight)}${vFrame}`
  }

  // Create empty lines
  const emptyLine = `${indent}${vFrame}${" ".repeat(frameWidth)}${vFrame}`

  // Build frame with content
  const lines = [
    topFrame,
    ...Array(topPadding).fill(emptyLine),
    ...text.map((line) => centerLine(line)),
    ...Array(bottomPadding).fill(emptyLine),
    bottomFrame,
  ]

  console.log(lines.join("\n"))
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
