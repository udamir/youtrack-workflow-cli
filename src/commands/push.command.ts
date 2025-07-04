import inquirer from "inquirer"
import ora from "ora"

import { isError, printNewVersionWarning, StatusCounter, tryCatch } from "../utils"
import { WorkflowError, WorkflowNotFoundError, YouTrackApiError } from "../errors"
import { YoutrackService, ProjectService } from "../services"
import { PROGRESS_STATUS, WORKFLOW_STATUS } from "../consts"
import { printItemStatus } from "../tools/console.tools"
import { executeScript } from "../tools/script.tools"
import { readPackageJson } from "../tools/fs.tools"

/**
 * Command for pushing workflows to YouTrack
 */
export const pushCommand = async (
  workflows: string[] = [],
  { host = "", token = "", force = false } = {},
): Promise<void> => {
  await printNewVersionWarning()

  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrackService = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrackService)

  let workflowsToProcess: string[] = []
  const [projectWorkflows, error] = await tryCatch(projectService.projectWorkflows(workflows))

  if (error) {
    console.error(error.message)
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
    workflowsToProcess = projectWorkflows.map((w) => w.name)
  }

  // Process workflows and track progress
  const counter = new StatusCounter()
  const { ytw } = readPackageJson()

  const runScript = async (script: string, workflow: string) => {
    const spinner = ora({
      text: `${workflow}: Running ${script} script (${script} ${workflow})`,
      color: "blue",
    }).start()
    const [result, error] = await tryCatch(executeScript(script, workflow))
    spinner.stop()

    if (error) {
      printItemStatus(
        workflow,
        PROGRESS_STATUS.WARNING,
        `Post-push script failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }

    printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Post-push script completed")
    if (result) {
      console.log(result)
    }
    return true
  }

  for (const workflow of workflowsToProcess) {
    // Execute pre-push script - this will throw if the script fails
    if (ytw?.prepush) {
      if (!(await runScript(ytw?.prepush, workflow))) {
        continue
      }
    }

    // Create spinner for tracking progress
    const spinner = ora({
      text: `${workflow}: ...\nPushing workflow to YouTrack (${counter.total}/${workflowsToProcess.length})`,
      color: "blue",
    }).start()

    try {
      await projectService.uploadWorkflow(workflow)
      spinner.stop()

      // Workflow pushed successfully
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Pushed successfully")
      counter.inc(PROGRESS_STATUS.SUCCESS)
    } catch (error) {
      spinner.stop()
      counter.inc(PROGRESS_STATUS.FAILED)

      if (error instanceof WorkflowNotFoundError || error instanceof WorkflowError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else if (error instanceof YouTrackApiError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.responseText || "")
      } else {
        // For debugging - show more details on unexpected errors
        const errorMessage = error instanceof Error ? error.message : String(error)
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, `Failed to push: ${errorMessage}`)
      }
    }

    if (ytw?.postpush) {
      await runScript(ytw?.postpush, workflow)
    }
  }

  console.log(
    `Pushed workflows: ${counter.get(PROGRESS_STATUS.SUCCESS)} (${counter.get(PROGRESS_STATUS.FAILED)} failed)`,
  )
}
