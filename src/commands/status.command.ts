import inquirer from "inquirer"

import { COLORS, STATUS_COLORS, WORKFLOW_STATUS, WORKFLOW_SYMBOL } from "../consts"
import { YoutrackService, ProjectService } from "../services"
import { isError, colorize } from "../utils"

/**
 * Command handler for checking workflow status
 * @param options Command options
 */
export const statusCommand = async ({ host = "", token = "" } = {}): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrack = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrack)

  try {
    const statuses = await projectService.checkStatus()

    if (Object.keys(statuses).length === 0) {
      console.log("No workflows found in package.json")
      return
    }

    // Display individual workflow results with colored symbols and status
    for (const [name, status] of Object.entries(statuses)) {
      const symbol = WORKFLOW_SYMBOL[status]
      const color = STATUS_COLORS[status]
      const coloredSymbol = colorize(symbol, color, COLORS.STYLE.BRIGHT)
      const coloredStatus = colorize(status, color)

      console.log(`${coloredSymbol} ${name}: ${coloredStatus}`)
    }

    // Statistics summary in a single line

    const syncedCount = Object.values(statuses).filter((s) => s === WORKFLOW_STATUS.SYNCED).length
    const modifiedCount = Object.values(statuses).filter((s) => s === WORKFLOW_STATUS.MODIFIED).length
    const outdatedCount = Object.values(statuses).filter((s) => s === WORKFLOW_STATUS.OUTDATED).length
    const conflictCount = Object.values(statuses).filter((s) => s === WORKFLOW_STATUS.CONFLICT).length
    const missingCount = Object.values(statuses).filter((s) => s === WORKFLOW_STATUS.MISSING).length
    const newCount = Object.values(statuses).filter((s) => s === WORKFLOW_STATUS.NEW).length

    const totalCount = Object.keys(statuses).length
    const summaryParts = []

    if (syncedCount > 0) summaryParts.push(colorize(`${syncedCount} synced`, COLORS.FG.GREEN))
    if (modifiedCount > 0) summaryParts.push(colorize(`${modifiedCount} modified`, COLORS.FG.YELLOW))
    if (outdatedCount > 0) summaryParts.push(colorize(`${outdatedCount} outdated`, COLORS.FG.BLUE))
    if (conflictCount > 0) summaryParts.push(colorize(`${conflictCount} conflicts`, COLORS.FG.RED))
    if (missingCount > 0) summaryParts.push(colorize(`${missingCount} missing`, COLORS.FG.MAGENTA))
    if (newCount > 0) summaryParts.push(colorize(`${newCount} new`, COLORS.FG.CYAN))

    const summary = summaryParts.join(", ")
    console.log(`\nSummary: ${totalCount} total workflows (${summary})`)

    // Interactive actions based on workflow status
    const hasModified = modifiedCount > 0 || newCount > 0
    const hasOutdated = outdatedCount > 0

    if (hasModified || hasOutdated) {
      const choices = []

      if (hasOutdated) {
        choices.push({ name: `Pull ${outdatedCount} outdated workflow(s) from YouTrack`, value: "pull" })
      }

      if (hasModified) {
        choices.push({ name: `Push ${modifiedCount + newCount} modified workflow(s) to YouTrack`, value: "push" })
      }

      if (hasModified && hasOutdated) {
        choices.push({ name: "Both: Pull outdated and push modified workflows", value: "both" })
      }

      choices.push({ name: "Cancel - take no action", value: "cancel" })

      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices,
        },
      ])

      if (action === "cancel") {
        console.log("No action taken.")
        return
      }

      if (action === "pull" || action === "both") {
        const outdatedWorkflows = Object.entries(statuses)
          .filter(([_, status]) => status === WORKFLOW_STATUS.OUTDATED)
          .map(([name]) => name)

        console.log(`\nPulling ${outdatedWorkflows.length} outdated workflow(s)...`)
        for (const workflow of outdatedWorkflows) {
          await projectService.downloadYoutrackWorkflow(workflow)
        }
        console.log("Pull completed successfully.")
      }

      if (action === "push" || action === "both") {
        const modifiedWorkflows = Object.entries(statuses)
          .filter(([_, status]) => status === WORKFLOW_STATUS.MODIFIED || status === WORKFLOW_STATUS.NEW)
          .map(([name]) => name)

        console.log(`\nPushing ${modifiedWorkflows.length} modified workflow(s)...`)
        for (const workflow of modifiedWorkflows) {
          await projectService.uploadWorkflow(workflow)
        }
        console.log("Push completed successfully.")
      }
    } else {
      console.log(colorize("All workflows are in sync.", COLORS.FG.GREEN))
    }
  } catch (error) {
    console.error("Error checking workflow status:", error)
  }
}
