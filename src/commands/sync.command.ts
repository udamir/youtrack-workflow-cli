import inquirer from "inquirer"
import ora from "ora"

import { YoutrackService, ProjectService } from "../services"
import { isError, printItemStatus } from "../utils"
import { PROGRESS_STATUS, SYNC_STRATEGY_AUTO, SYNC_STRATEGY_SKIP, WORKFLOW_STATUS } from "../consts"
import { FileWatcher } from "../services/file-watcher.service"
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
    force,
    debounce = 1000
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
      text: `Syncing workflow: ${workflow} (${completedCount}/${workflows.length})`,
      color: "blue",
    }).start()
    
    try {
      // Get workflow status
      const status = await projectService.workflowStatus(workflow)
    
      if (status === WORKFLOW_STATUS.MODIFIED) {
        await projectService.uploadWorkflow(workflow)
      } else if (status === WORKFLOW_STATUS.OUTDATED) {
        await projectService.downloadYoutrackWorkflow(workflow)
      } else if (status === WORKFLOW_STATUS.CONFLICT) {
        await resolveConflict(workflow, projectService, watch || force || SYNC_STRATEGY_AUTO)
      } else if (status === WORKFLOW_STATUS.NEW) {
        await projectService.uploadWorkflow(workflow)
      } 

      // Stop spinner to print status line
      spinner.stop()

      printItemStatus(workflow, PROGRESS_STATUS.WARNING, status === WORKFLOW_STATUS.SYNCED ? status : `${status} -> ${WORKFLOW_STATUS.SYNCED}`)
      
      completedCount++
      
    } catch (error) {
      // Failed to sync workflow
      spinner.stop()
      printItemStatus(workflow, PROGRESS_STATUS.FAILED, error instanceof Error ? error.message : "Unknown error")
    }
  }
  
  // Set up watch mode if requested
  if (watch) {
    console.log('\nStarting watch mode. Press Ctrl+C to exit.');
    
    // Set up file watching
    const fileWatcher = new FileWatcher(projectService, {
      forceStrategy: watch || SYNC_STRATEGY_SKIP,
      debounceMs: debounce
    })
    
    // Start watching the workflows
    fileWatcher.watch(process.cwd(), workflows)
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\nStopping watch mode...')
      fileWatcher.stop()
      process.exit(0)
    })
    
    // Keep the process running
    setInterval(() => {}, 1000)
  }
}

/**
 * Resolve a conflict for a workflow
 * @param workflow Workflow name
 * @param projectService Project service
 * @param strategy Force strategy (if undefined, will prompt user)
 */
async function resolveConflict(
  workflow: string,
  projectService: ProjectService,
  strategy?: SyncStrategy
): Promise<void> {
  printItemStatus(workflow, PROGRESS_STATUS.WARNING, "Conflict detected")
  
  if (!strategy) {
    // Prompt user for conflict resolution strategy
    const { selectedStrategy } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedStrategy",
        message: `Select conflict resolution strategy for ${workflow}`,
        choices: [
          { name: "Auto (try to merge changes)", value: "auto" },
          { name: "Pull (overwrite local changes)", value: "pull" },
          { name: "Push (overwrite server changes)", value: "push" },
          { name: "Skip (do nothing)", value: "skip" }
        ]
      }
    ])
    
    strategy = selectedStrategy
  }
  
  // Execute the selected strategy
  switch (strategy) {
    case "auto":
      try {
        printItemStatus(workflow, PROGRESS_STATUS.INFO, "Attempting to merge changes...")
        
        // Pull first to get latest changes
        await projectService.downloadYoutrackWorkflow(workflow)
        
        // Then push our changes
        await projectService.uploadWorkflow(workflow)
        
        printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully merged and pushed changes")
      } catch (error) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, `Failed to merge: ${(error as Error).message}`)
      }
      break
      
    case "pull":
      printItemStatus(workflow, PROGRESS_STATUS.INFO, "Pulling changes (overwriting local changes)")
      await projectService.downloadYoutrackWorkflow(workflow)
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully pulled from YouTrack")
      break
      
    case "push":
      printItemStatus(workflow, PROGRESS_STATUS.INFO, "Pushing changes (overwriting server changes)")
      await projectService.uploadWorkflow(workflow)
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully pushed to YouTrack")
      break
      
    case "skip":
      printItemStatus(workflow, PROGRESS_STATUS.INFO, "Skipped conflict resolution")
      break
  }
}
