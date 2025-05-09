import inquirer from "inquirer"
import ora from "ora"

import { WorkflowError, WorkflowNotFoundError } from "../errors"
import { YoutrackService, ProjectService } from "../services"
import { PROGRESS_STATUS, WORKFLOW_STATUS } from "../consts"
import { isError, printItemStatus } from "../utils"

/**
 * Command for pulling workflows from YouTrack
 */
export const pullCommand = async (
  workflows: string[] = [],
  { host = "", token = "", force = false } = {},
): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrackService = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrackService)

  let workflowsToProcess: string[] = []
  const projectWorkflows = await projectService.projectWorkflows()

  if (!projectWorkflows.length) {
    console.error("No workflows in project. Add workflows first.")
    return
  }

  if (!workflows.length && !force) {
    // Create a spinner for checking statuses
    const statusSpinner = ora({
      text: "Checking workflow statuses ...",
      color: "blue",
    }).start()

    // Check statuses of workflows for better selection
    const statuses = await projectService.checkWorkflowStatuses(projectWorkflows)

    statusSpinner.stop()

    // Create choices based on statuses
    const choices = Object.entries(statuses)
      .filter(([_, status]) => status !== WORKFLOW_STATUS.SYNCED)
      .map(([workflow, status]) => ({
        name: `${workflow} (${status})`,
        value: workflow,
      }))

    if (!choices.length) {
      console.log("All workflows are up to date. No workflows to pull from YouTrack")
      return
    }

    // Show prompt for user to select workflows
    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to pull from YouTrack:",
        choices,
      },
    ])

    if (!selected.workflows || selected.workflows.length === 0) {
      console.log("No workflows selected")
      return
    }

    workflowsToProcess.push(...selected.workflows)
  } else if (workflows.length > 0) {
    // Case: Specific workflows provided as arguments
    workflowsToProcess = workflows
  } else {
    // Case: No arguments and force - pull all project workflows
    workflowsToProcess = projectWorkflows
  }

  // Process workflows and track progress
  let completedCount = 0
  let successCount = 0
  let failCount = 0

  for (const workflow of workflowsToProcess) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `${workflow}: ...\nPulling workflow from YouTrack (${completedCount}/${workflowsToProcess.length})`,
      prefixText: "  ",
      color: "blue",
    }).start()

    try {
      await projectService.downloadYoutrackWorkflow(workflow)
      spinner.stop()

      // Workflow pulled successfully
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Pulled successfully")
      successCount++
    } catch (error) {
      spinner.stop()
      failCount++

      if (error instanceof WorkflowNotFoundError || error instanceof WorkflowError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, "Failed to pull")
      }
    }

    completedCount++
  }

  console.log(`\nPulled workflows: ${successCount}/${workflowsToProcess.length} (${failCount} failed)`)
}
