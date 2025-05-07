import inquirer from "inquirer"
import ora from "ora"

import { WorkflowError, WorkflowNotFoundError, YouTrackApiError } from "../errors"
import { PROGRESS_STATUS, WORKFLOW_STATUS } from "../consts"
import { YoutrackService, ProjectService } from "../services"
import { isError, printItemStatus } from "../utils"

/**
 * Command for pushing workflows to YouTrack
 */
export const pushCommand = async (
  workflows: string[] = [],
  { host = "", token = "", force = false } = {}
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
  const availableWorkflows = Object.keys(projectService.workflows)

  if (!availableWorkflows.length) {
    console.error("No workflows in project. Add workflows first.")
    return
  }

  if (!workflows.length && !force) {
    // Check statuses of workflows for better selection
    const statuses: Record<string, string> = {}
    let completedCount = 0

    // Create a spinner for checking statuses
    const statusSpinner = ora({
      text: `Checking workflow statuses (0/${availableWorkflows.length})`,
      color: "blue",
    }).start()

    for (const workflow of availableWorkflows) {
      try {
        statuses[workflow] = await projectService.workflowStatus(workflow)
      } catch (error) {
        statuses[workflow] = WORKFLOW_STATUS.UNKNOWN
      }

      completedCount++
      statusSpinner.text = `Checking workflow statuses (${completedCount}/${availableWorkflows.length})`
    }

    statusSpinner.stop()

    // Create choices based on statuses
    const choices = availableWorkflows
      .filter((workflow) => statuses[workflow] !== WORKFLOW_STATUS.SYNCED)
      .map((workflow) => ({
        name: `${workflow} (${statuses[workflow]})`,
        value: workflow,
      }))

    if (!choices.length) {
      console.log("All workflows are up to date. No workflows to push to YouTrack")
      return
    }

    // Show prompt for user to select workflows
    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to push to YouTrack:",
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
    // Case: No arguments and force - push all project workflows
    workflowsToProcess = availableWorkflows
  }

  // Process workflows and track progress
  let completedCount = 0
  let successCount = 0
  let failCount = 0

  for (const workflow of workflowsToProcess) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `${workflow}: ...\nPushing workflow to YouTrack (${completedCount}/${workflowsToProcess.length})`,
      prefixText: "  ",
      color: "blue",
    }).start()

    try {
      await projectService.uploadWorkflow(workflow)
      spinner.stop()

      // Workflow pushed successfully
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Pushed successfully")
      successCount++
    } catch (error) {
      spinner.stop()
      failCount++

      if (error instanceof WorkflowNotFoundError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else if (error instanceof YouTrackApiError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.responseText || "")
      } else if (error instanceof WorkflowError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else {
        // For debugging - show more details on unexpected errors
        const errorMessage = error instanceof Error ? error.message : String(error)
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, `Failed to push: ${errorMessage}`)
      }
    }

    completedCount++
  }

  console.log(`\nPushed workflows: ${successCount}/${workflowsToProcess.length} (${failCount} failed)`)
}
