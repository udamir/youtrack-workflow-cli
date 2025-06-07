import inquirer from "inquirer"
import ora from "ora"

import { COLORS, PROGRESS_STATUS, SYNC_STATUS, SYNC_TYPE, WORKFLOW_STATUS } from "../consts"
import { YoutrackService, ProjectService, LintingService, WatchService } from "../services"
import { colorize, isError, printItemStatus, StatusCounter } from "../utils"
import { printLintResult, printLintSummary } from "./lint.command"
import { printWorkflowStatus } from "./status.command"
import type { SyncStatus, SyncType } from "../types"

type SyncCommandOptions = {
  host?: string
  token?: string
  watch?: SyncType
  force?: SyncType
  debounce?: number
  lint?: boolean
  typeCheck?: boolean
  maxWarnings?: number
}

/**
 * Command to synchronize workflows between local files and YouTrack
 * @param options Command options
 */
export const syncCommand = async (
  workflows: string[] = [],
  { host = "", token = "", watch, force, lint, typeCheck, maxWarnings }: SyncCommandOptions = {},
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

  // Initialize linting service with configuration from package.json
  const lintingService = new LintingService({
    enableEslint: lint,
    enableTypeCheck: typeCheck,
    maxWarnings,
  })

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
        return printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Already in sync")
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
      printWorkflowStatus(workflow, WORKFLOW_STATUS.CONFLICT, fileStatus)

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
    async (workflow) => {
      const { errors, warnings } = await lintingService.lintWorkflow(workflow)
      spinner.stop()
      if (errors.length) {
        printLintSummary(`${workflow}: ${colorize("sync failed", COLORS.FG.RED)}`, errors, warnings)
        statuses.inc(SYNC_STATUS.FAILED)
      } else {
        printLintSummary(workflow, errors, warnings)
      }
      printLintResult(errors, warnings)
      return !errors.length
    },
  )

  spinner.stop()

  // Set up watch mode if requested
  if (watch) {
    if (statuses.get(SYNC_STATUS.FAILED) + statuses.get(SYNC_STATUS.SKIPPED) > 0) {
      console.log("\nCannot start watch mode with failed or skipped workflows. Resolve conflicts/errors first.")
      return
    }

    // Create watch service with event handlers
    const watchService = new WatchService(projectService, lintingService, {
      // Display file change events
      onFileChange: (workflowName, filename, eventType) => {
        const checkNeeded = lintingService.config.enableEslint || lintingService.config.enableTypeCheck
        printItemStatus(
          `${workflowName}/${filename}`,
          PROGRESS_STATUS.INFO,
          `${eventType} detected${checkNeeded ? ". Checking workflow:" : ""}`,
        )
      },

      // Display linting results
      onLintResult: (workflowName, errors, warnings) => {
        printLintSummary(workflowName, errors, warnings)
        printLintResult(errors, warnings)
      },

      // Display sync results
      onSyncResult: (workflowName, status, message) => {
        const statusType =
          status === SYNC_STATUS.PUSHED
            ? PROGRESS_STATUS.SUCCESS
            : status === SYNC_STATUS.FAILED
              ? PROGRESS_STATUS.FAILED
              : PROGRESS_STATUS.INFO

        printItemStatus(`${workflowName}`, statusType, message || status)
      },
    })

    // Start watching
    await watchService.startWatching(workflowsToWatch.map(({ name }) => name))

    console.log("\nWatching for changes...")
    console.log("Press Ctrl+C to exit.")
  }
}
