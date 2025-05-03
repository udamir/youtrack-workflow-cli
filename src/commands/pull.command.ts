import inquirer from "inquirer"

import { WORKFLOW_SYMBOL, WORKFLOW_DESCRIPTION, STATUS_COLORS, COLORS } from "../consts"
import { YoutrackService, ProjectService } from "../services"
import { isError, colorize } from "../utils"

/**
 * Command handler for pulling workflows from YouTrack
 * @param workflows Workflow names to pull
 * @param options Command options
 */
export const pullCommand = async (workflows: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
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
    console.error("Add workflow first, or specify workflow name.")
    return
  }

  if (workflows.length === 1 && workflows[0] === "@") {
    // Case 1: Question mark - prompt user to select workflows with status info
    const statuses = await projectService.checkStatus()

    const choices = Object.entries(statuses).map(([name, status]) => {
      const symbol = WORKFLOW_SYMBOL[status]
      const color = STATUS_COLORS[status]
      const coloredSymbol = colorize(symbol, color, COLORS.STYLE.BRIGHT)
      const coloredStatus = colorize(WORKFLOW_DESCRIPTION[status], color)

      return {
        name: `${name} (${coloredSymbol} ${coloredStatus})`,
        value: name,
      }
    })

    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to pull:",
        choices,
      },
    ])

    if (!selected.workflows.length) {
      console.log("No workflows selected. Exiting.")
      return
    }

    console.log("Selected workflows:", selected.workflows)
    workflowsToProcess = selected.workflows
  } else if (workflows.length > 0) {
    // Case 2: Specific workflows provided as arguments
    workflowsToProcess = workflows
  } else {
    // Case 3: No arguments - pull all project workflows
    console.log("Pulling all project workflows...")
    workflowsToProcess = projectService.workflows.map((w) => w.name)
  }

  console.log(`Will pull ${workflowsToProcess.length} workflow(s):`, workflowsToProcess)

  for (const workflow of workflowsToProcess) {
    try {
      await projectService.downloadYoutrackWorkflow(workflow)
      console.log(`${colorize("✓", COLORS.FG.GREEN)} ${workflow}: pulled successfully`)
    } catch (error) {
      console.error(`${colorize("✗", COLORS.FG.RED)} ${workflow}: failed to pull`, error)
    }
  }

  console.log(`\n${colorize("All workflows processed.", COLORS.FG.GREEN)}`)
}
