import inquirer from "inquirer"
import ora from "ora"

import { PROGRESS_STATUS, SYNC_STATUS, SYNC_TYPE, WATCH_EVENT, WORKFLOW_STATUS, WORKFLOW_STATUS_DATA } from "../consts"
import { isError, printItemStatus, progressStatus, StatusCounter } from "../utils"
import type { SyncStatus, SyncType, WatchEvent } from "../types"
import { YoutrackService, ProjectService } from "../services"
import { watchWorkflows } from "../tools/watcher.tools"

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
  { host = "", token = "", watch, force }: SyncCommandOptions = {},
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

  const workflowsToWatch = await projectService.projectWorkflows(workflows)

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
    text: `${workflowsToWatch[0].name}: ...\nSyncing workflow (0/${workflowsToWatch.length})`,
    color: "blue",
  }).start()

  const statuses = new StatusCounter()

  await projectService.syncWorkflows(
    workflowsToWatch.map(({ name }) => name),
    async (workflow) => {
      const fileStatus = await projectService.getWorkflowFileStatus(workflow)

      spinner.stop()
      printItemStatus(workflow, PROGRESS_STATUS.FAILED, "Conflict")
      Object.entries(fileStatus).forEach(([file, status]) => {
        if (status !== WORKFLOW_STATUS.SYNCED) {
          printItemStatus(file, progressStatus(status), WORKFLOW_STATUS_DATA[status].description, 3)
        }
      })

      if (force) {
        return force
      }

      const selected = await inquirer.prompt<{ syncType: SyncType }>([
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
      statuses.inc(status)
      if (index + 1 < workflowsToWatch.length) {
        spinner.start(
          `${workflowsToWatch[index + 1].name}: ...\nSyncing workflow (${index + 1}/${workflowsToWatch.length})`,
        )
      }
    },
  )

  spinner.stop()

  // Set up watch mode if requested
  if (watch) {
    if (statuses.get(SYNC_STATUS.FAILED) + statuses.get(SYNC_STATUS.SKIPPED) > 0) {
      console.log("\nCannot start watch mode with failed or skipped workflows. Resolve conflicts first.")
      return
    }

    const workflowMap = new Map(workflowsToWatch.map((w) => [w.name, w]))

    console.log("\nStarting watch mode. Press Ctrl+C to exit.")
    let syncing = false
    let debounced: NodeJS.Timeout | null = null

    const syncWorkflow = async (workflowName: string, filename: string, eventType: WatchEvent) => {
      if (syncing && !debounced) {
        debounced = setTimeout(() => syncWorkflow(workflowName, filename, eventType), 1000)
        return
      }
      syncing = true

      const workflow = workflowMap.get(workflowName)
      if (!workflow) {
        console.log(`Workflow ${workflowName} not found`)
        return
      }

      if (!filename.endsWith(".js")) {
        console.log(`File ${filename} is skipped - it is not a JavaScript file`)
        return
      }

      const ruleName = filename.replace(".js", "")

      // const spinner = ora({
      //   text: `${workflowName}: ...\nSyncing workflow`,
      //   color: "blue",
      // }).start()

      try {
        await projectService.updateSyncedWorkflow(
          workflow,
          eventType === WATCH_EVENT.ADD ? filename : [],
          eventType === WATCH_EVENT.UNLINK ? filename : [],
          eventType === WATCH_EVENT.CHANGE ? filename : [],
          (workflowName, fileName, status) => {
            // spinner.stop()
            if (status === SYNC_STATUS.PUSHED) {
              printItemStatus(`${workflowName}/${ruleName}`, PROGRESS_STATUS.SUCCESS, `"${eventType}" synced`)
            }
          }
        )
      } catch (error) {
        // spinner.stop()
        printItemStatus(`${workflowName}/${ruleName}`, PROGRESS_STATUS.FAILED, error instanceof Error ? error.message : "Unknown error")
      }

      syncing = false
      if (debounced) {
        clearTimeout(debounced)
        debounced = null
      }
    }

    const stop = await watchWorkflows(
      workflowsToWatch.map(({ name }) => name),
      syncWorkflow,
    )

    // Handle process termination
    process.on("SIGINT", () => {
      console.log("\nStopping watch mode...")
      stop()
      process.exit(0)
    })
  }
}
