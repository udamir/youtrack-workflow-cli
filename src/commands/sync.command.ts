import inquirer from "inquirer"
import ora from "ora"

import { YoutrackService, ProjectService } from "../services"
import { isError, printItemStatus } from "../utils"
import { PROGRESS_STATUS, SYNC_STRATEGY_PULL, SYNC_STRATEGY_PUSH, WORKFLOW_STATUS } from "../consts"
import { watchWorkflows } from "../tools/watcher.tools"
import type { SyncStrategy } from "../types"

type SyncCommandOptions = {
  host?: string
  token?: string
  watch?: SyncStrategy
  force?: SyncStrategy
  debounce?: number
}

/**
 * Command to synchronize workflows between local files and YouTrack
 * @param options Command options
 */
export const syncCommand = async (
  workflows: string[] = [],
  { 
    host = "", 
    token = "", 
    watch,
    force
  }: SyncCommandOptions = {},
): Promise<void> => {
  // Validate required parameters
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  // Create services
  const youtrackService = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrackService)

  let workflowsToProcess = []

  // If no workflows specified, get all available workflows
  if (workflows.length === 0 && !force) {
    const projectWorkflows = await projectService.projectWorkflows()

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
      console.log("All workflows are up to date. No workflows to sync with YouTrack")
      return
    }

    // Show prompt for user to select workflows
    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to sync with YouTrack:",
        choices,
      },
    ])

    if (!selected.workflows || selected.workflows.length === 0) {
      console.log("No workflows selected")
      return
    }

    workflowsToProcess = selected.workflows
  } else if (workflows.length > 0) {
    workflowsToProcess.push(...workflows)
  } else {
    // No workflows provided and force is not set - process all workflows
    workflowsToProcess = await projectService.projectWorkflows()
  }

  // Process workflows
  let completedCount = 0
  
  for (const workflow of workflowsToProcess) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `${workflow}: ...\nSyncing workflow (${completedCount}/${workflows.length})`,
      prefixText: "  ",
      color: "blue",
    }).start()
    
    try {
      // Get workflow status
      const status = await projectService.workflowStatus(workflow)
      let message = ""

      if (status === WORKFLOW_STATUS.MODIFIED || status === WORKFLOW_STATUS.NEW || (status === WORKFLOW_STATUS.CONFLICT && force !== SYNC_STRATEGY_PUSH)) {
        await projectService.uploadWorkflow(workflow)
        message = "Pushed to YouTrack"
      } else if (status === WORKFLOW_STATUS.OUTDATED || (status === WORKFLOW_STATUS.CONFLICT && force === SYNC_STRATEGY_PULL)) {
        await projectService.downloadYoutrackWorkflow(workflow)
        message = "Downloaded from YouTrack"
      } else {
        message = "Skipped"
      }

      // Stop spinner to print status line
      spinner.stop()

      printItemStatus(workflow, PROGRESS_STATUS.WARNING, status === WORKFLOW_STATUS.SYNCED ? status : `${status} -> ${message}`)
      
      completedCount++
      
    } catch (error) {
      // Failed to sync workflow
      spinner.stop()
      printItemStatus(workflow, PROGRESS_STATUS.FAILED, error instanceof Error ? error.message : "Unknown error")
    }
  }

  if (!workflowsToProcess.length) {
    console.log("No workflows to sync")
    return
  }
  
  // Set up watch mode if requested
  if (watch) {
    console.log('\nStarting watch mode. Press Ctrl+C to exit.');
    
    const stop = await watchWorkflows(workflowsToProcess, async (workflowName) => {
      const spinner = ora({
        text: `${workflowName}: ...\nSyncing workflow`,
        prefixText: "  ",
        color: "blue",
      }).start()
      
      try {
        await projectService.uploadWorkflow(workflowName)
        spinner.stop()
        printItemStatus(workflowName, PROGRESS_STATUS.SUCCESS, "Pushed to YouTrack")
      } catch (error) {
        spinner.stop()
        printItemStatus(workflowName, PROGRESS_STATUS.FAILED, error instanceof Error ? error.message : "Unknown error")
      }
    })

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\nStopping watch mode...')
      stop()
      process.exit(0)
    })
  }
}
