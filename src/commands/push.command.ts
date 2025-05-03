import inquirer from "inquirer"

import { WORKFLOW_STATUS, WORKFLOW_SYMBOL, WORKFLOW_DESCRIPTION, STATUS_COLORS, COLORS } from "../consts"
import { WorkflowError, WorkflowNotFoundError, YouTrackApiError } from "../errors"
import { YoutrackService, ProjectService } from "../services"
import { isError, colorize } from "../utils"

/**
 * Command handler for pushing workflows to YouTrack
 * @param workflows Workflow names to push
 * @param options Command options
 */
export const pushCommand = async (workflows: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrack = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrack)

  let workflowsToProcess: string[] = []

  if (!projectService.workflows.length) {
    console.error("No workflows in project. Add workflows first.")
    return
  }

  if (workflows.length === 1 && workflows[0] === "?") {
    // Case 1: Status check - prompt user to select workflows
    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to push to YouTrack:",
        choices: projectService.workflows.map((w) => w.name),
      },
    ])

    if (!selected.workflows.length) {
      console.log("No workflows selected. Exiting.")
      return
    }

    console.log("Selected workflows:", selected.workflows)
    workflowsToProcess = selected.workflows
  } else if (!workflows.length) {
    // Case 2: No arguments - show status and let user select workflows
    let statuses: Record<string, keyof typeof WORKFLOW_SYMBOL> = {}
    try {
      statuses = await projectService.checkStatus()
    } catch (error) {
      if (error instanceof WorkflowError) {
        console.error(`Error checking workflow status: ${error.message}`)
      } else {
        console.error("Error checking workflow status:", error)
      }
      return
    }

    const choices = Object.entries(statuses).map(([name, status]) => {
      const color = STATUS_COLORS[status]
      const coloredSymbol = colorize(WORKFLOW_SYMBOL[status], color, COLORS.STYLE.BRIGHT)
      const coloredStatus = colorize(WORKFLOW_DESCRIPTION[status], color)

      return {
        name: `${name} (${coloredSymbol} ${coloredStatus})`,
        value: name,
        disabled: status === WORKFLOW_STATUS.SYNCED || status === WORKFLOW_STATUS.MISSING,
      }
    })

    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to push to YouTrack:",
        choices,
      },
    ])

    if (!selected.workflows.length) {
      console.log("No workflows selected. Exiting.")
      return
    }

    console.log("Selected workflows:", selected.workflows)
    workflowsToProcess = selected.workflows
  } else {
    // Case 3: Specific workflows provided as arguments
    workflowsToProcess = workflows
  }

  console.log(`Will push ${workflowsToProcess.length} workflow(s) to YouTrack`)

  let successCount = 0
  let failCount = 0

  for (const workflow of workflowsToProcess) {
    try {
      await projectService.uploadWorkflow(workflow)
      console.log(`${colorize("✓", COLORS.FG.GREEN)} ${workflow}: pushed successfully`)
      successCount++
    } catch (error) {
      failCount++
      if (error instanceof WorkflowNotFoundError) {
        console.error(`${colorize("✗", COLORS.FG.RED)} ${workflow}: ${error.message}`)
      } else if (error instanceof YouTrackApiError) {
        console.error(`${colorize("✗", COLORS.FG.RED)} ${workflow}: ${error.message}`)
        if (error.responseText) {
          console.error(`  Response details: ${error.responseText}`)
        }
      } else if (error instanceof WorkflowError) {
        console.error(`${colorize("✗", COLORS.FG.RED)} ${workflow}: ${error.message}`)
      } else {
        console.error(`${colorize("✗", COLORS.FG.RED)} ${workflow}: failed to push`, error)
      }
    }
  }

  console.log(
    `\n${colorize(`All workflows processed. Success: ${successCount}, Failed: ${failCount}`, COLORS.FG.GREEN)}`,
  )
}
