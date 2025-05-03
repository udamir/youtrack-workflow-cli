import inquirer from "inquirer"

import { WORKFLOW_STATUS, WORKFLOW_SYMBOL, WORKFLOW_DESCRIPTION, STATUS_COLORS, COLORS } from "../consts"
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
    const statuses = await projectService.checkStatus()

    const choices = Object.entries(statuses).map(([name, status]) => {
      const symbol = WORKFLOW_SYMBOL[status]
      const color = STATUS_COLORS[status]
      const coloredSymbol = colorize(symbol, color, COLORS.STYLE.BRIGHT)
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

  for (const workflow of workflowsToProcess) {
    try {
      await projectService.uploadWorkflow(workflow)
      console.log(`${colorize("✓", COLORS.FG.GREEN)} ${workflow}: pushed successfully`)
    } catch (error) {
      console.error(`${colorize("✗", COLORS.FG.RED)} ${workflow}: failed to push`, error)
    }
  }

  console.log(`\n${colorize("All workflows processed.", COLORS.FG.GREEN)}`)
}
