import inquirer from "inquirer"
import ora from "ora"

import { YoutrackService, ProjectService } from "../services"
import { isError, printItemStatus } from "../utils"
import { PROGRESS_STATUS } from "../consts"

/**
 * Command to add workflows to a project
 * @returns Results of the command execution
 */
export const addCommand = async (workflows: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  // Create services
  const youtrackService = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrackService)

  if (workflows.length === 0) {
    try {
      // Get all available workflows from YouTrack
      const availableWorkflows = await projectService.availableWorkflows()

      // Show prompt to select workflows
      const selected = await inquirer.prompt([
        {
          type: "checkbox",
          name: "workflows",
          message: "Select workflows to add:",
          choices: availableWorkflows,
        },
      ])

      if (!selected.workflows || selected.workflows.length === 0) {
        console.log("No workflows selected")
        return
      }

      workflows.push(...selected.workflows)
    } catch (error) {
      console.error("Error fetching available workflows:", error)
      return
    }
  }

  // Process workflows and track progress
  let completedCount = 0

  for (const workflow of workflows) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `Adding workflow to project (${completedCount}/${workflows.length})`,
      color: "blue",
    }).start()

    try {
      const result = await projectService.addWorkflow(workflow)

      // Stop spinner to print status line
      spinner.stop()

      const status = result.skipped
        ? PROGRESS_STATUS.WARNING
        : result.success
          ? PROGRESS_STATUS.SUCCESS
          : PROGRESS_STATUS.FAILED

      printItemStatus(workflow, status, result.message)
    } catch (err) {
      // Failed to add workflow
      printItemStatus(workflow, PROGRESS_STATUS.FAILED, err instanceof Error ? err.message : "Failed to remove workflow")
      spinner.stop()
    }
    completedCount++
  }

  console.log(`\nSuccessfully added workflows: ${workflows.length}/${workflows.length}`)
}
