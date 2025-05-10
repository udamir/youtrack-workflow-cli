import inquirer from "inquirer"
import ora from "ora"

import { PROGRESS_STATUS, SYNC_STATUS, SYNC_TYPE } from "../consts"
import { YoutrackService, ProjectService } from "../services"
import { isError, printItemStatus } from "../utils"
import { watchWorkflows } from "../tools/watcher.tools"
import type { SyncStatus, SyncType } from "../types"

type SyncCommandOptions = {
  host?: string
  token?: string
  watch?: SyncType
  force?: SyncType
  debounce?: number
}

/**
 * Command to synchronize workflows between local files and YouTrack
 * @param options Command options
 */
export const syncCommand = async (
  workflows: string[] = [],
  { host = "", token = "", watch, force = SYNC_TYPE.SKIP }: SyncCommandOptions = {},
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

  const workflowsToWatch = workflows.length ? workflows : await projectService.projectWorkflows()

  // Sync workflows
  const printSyncStatus = (workflow: string, status: SyncStatus) => {
    switch (status) {
      case SYNC_STATUS.PUSHED:
        return printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Pushed to YouTrack")
      case SYNC_STATUS.PULLED:
        return printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Pulled from YouTrack")
      case SYNC_STATUS.SKIPPED:
        return printItemStatus(workflow, PROGRESS_STATUS.WARNING, "Skipped (conflict)")
      case SYNC_STATUS.FAILED:
        return printItemStatus(workflow, PROGRESS_STATUS.FAILED, "Failed to sync")
      case SYNC_STATUS.SYNCED:
        return printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Synced")
    }
  }

  if (!workflowsToWatch.length) {
    console.log("No workflows to sync")
    return
  }

  // Create spinner for tracking progress
  const spinner = ora({
    text: `${workflowsToWatch[0]}: ...\nSyncing workflow (0/${workflowsToWatch.length})`,
    color: "blue",
  }).start()

  await projectService.syncWorkflows(
    workflowsToWatch,
    async (workflow) => {
      spinner.stop()
      printItemStatus(workflow, PROGRESS_STATUS.FAILED, "Conflict")
      const selected = await inquirer.prompt([
        {
          type: "list",
          name: "syncType",
          message: "Select action for workflow",
          choices: [SYNC_TYPE.SKIP, SYNC_TYPE.PULL, SYNC_TYPE.PUSH],
        },
      ])

      return selected.syncType
    },
    (workflow, status, index) => {
      spinner.stop()
      printSyncStatus(workflow, status)
      if (index + 1 < workflowsToWatch.length) {
        spinner.start(`${workflowsToWatch[index + 1]}: ...\nSyncing workflow (${index + 1}/${workflowsToWatch.length})`)
      }
    },
  )

  spinner.stop()

  // Set up watch mode if requested
  if (watch) {
    console.log("\nStarting watch mode. Press Ctrl+C to exit.")
    let syncing = false
    let debounced: NodeJS.Timeout | null = null

    const syncWorkflow = async (workflowName: string) => {
      projectService.clearLocalWorkflowCache(workflowName)

      if (syncing && !debounced) {
        debounced = setTimeout(() => syncWorkflow(workflowName), 1000)
        return
      }
      syncing = true
      const spinner = ora({
        text: `${workflowName}: ...\nSyncing workflow`,
        color: "blue",
      }).start()

      await projectService.syncWorkflows(
        [workflowName],
        async () => force,
        (workflow, status) => {
          spinner.stop()
          printSyncStatus(workflow, status)
          syncing = false
          if (debounced) {
            clearTimeout(debounced)
            debounced = null
          }
        },
      )
    }

    const stop = await watchWorkflows(workflowsToWatch, syncWorkflow)

    // Handle process termination
    process.on("SIGINT", () => {
      console.log("\nStopping watch mode...")
      stop()
      process.exit(0)
    })
  }
}
