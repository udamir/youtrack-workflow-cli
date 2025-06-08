import inquirer from "inquirer"
import ora from "ora"

import { YoutrackService, ProjectService, LintingService, WatchService } from "../services"
import { PROGRESS_STATUS, SYNC_STATUS, SYNC_TYPE, WORKFLOW_STATUS } from "../consts"
import { isError, printItemStatus, StatusCounter, tryCatch } from "../utils"
import { printLintResult, printLintSummary } from "./lint.command"
import { printWorkflowStatus } from "./status.command"
import type { SyncStatus, SyncType } from "../types"
import { executeScript } from "../tools/script.tools"
import { readPackageJson } from "../tools/fs.tools"

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

  const [workflowsToWatch, error] = await tryCatch(projectService.projectWorkflows(workflows))

  if (error) {
    console.error(error.message)
    return
  }

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

  // Create spinner for tracking progress
  const spinner = ora({
    text: `${workflowsToWatch[0].name}: ...\nSyncing workflow (0/${workflowsToWatch.length})`,
    color: "blue",
  }).start()

  const statuses = new StatusCounter()
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

  await projectService.syncWorkflows(
    workflowsToWatch.map(({ name }) => name),
    {
      onConflict: async (workflow) => {
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
      onSync: async (workflow, status, index) => {
        spinner.stop()
        printSyncStatus(workflow, status)
        statuses.inc(status)

        // Execute post-push script if workflow was pushed and post-push script exists
        if (status === SYNC_STATUS.PUSHED && ytw?.postpush) {
          await runScript(ytw?.postpush, workflow)
        }

        if (index + 1 < workflowsToWatch.length) {
          spinner.start(
            `${workflowsToWatch[index + 1].name}: ...\nSyncing workflow (${index + 1}/${workflowsToWatch.length})`,
          )
        }
      },
      preUploadCheck: async (workflow) => {
        const { errors, warnings } = await lintingService.lintWorkflow(workflow)
        spinner.stop()
        if (errors.length) {
          printLintSummary?.(workflow, errors, warnings)
          statuses?.inc(SYNC_STATUS.FAILED)
          return false
        }

        printLintSummary(`${workflow}: Lint results`, errors, warnings)
        printLintResult?.(errors, warnings)

        // Execute pre-push script if pre-push script exists
        if (ytw?.prepush) {
          return runScript(ytw?.prepush, workflow)
        }

        return true // Only proceed with pushing if linting passes and pre-push script succeeds
      },
    },
  )

  spinner.stop()

  // Set up watch mode if requested
  if (watch) {
    if (statuses.get(SYNC_STATUS.FAILED) + statuses.get(SYNC_STATUS.SKIPPED) > 0) {
      console.log("\nCannot start watch mode with failed or skipped workflows. Resolve conflicts/errors first.")
      return
    }

    const watchService = new WatchService(projectService, {
      // Display file change events
      onFileChange: async (workflowName, filename, eventType) => {
        const checkNeeded = lintingService.config.enableEslint || lintingService.config.enableTypeCheck
        printItemStatus(
          `${workflowName}/${filename}`,
          PROGRESS_STATUS.INFO,
          `${eventType} detected${checkNeeded ? ". Checking workflow:" : ""}`,
        )

        if (checkNeeded) {
          const lintResult = await lintingService.lintWorkflow(workflowName)
          if (lintResult.errors.length) {
            printLintSummary?.(workflowName, lintResult.errors, lintResult.warnings)
            printLintResult?.(lintResult.errors, lintResult.warnings)
            return false
          }
        }

        if (ytw?.prepush) {
          await runScript(ytw?.prepush, workflowName)
        }

        return true
      },

      // Custom onSyncResult handler that implements pre/post-push scripts
      onSyncResult: async (workflowName, status, message) => {
        const statusType =
          status === SYNC_STATUS.PUSHED
            ? PROGRESS_STATUS.SUCCESS
            : status === SYNC_STATUS.FAILED
              ? PROGRESS_STATUS.FAILED
              : PROGRESS_STATUS.INFO

        printItemStatus(`${workflowName}`, statusType, message || status)

        // Run post-push script after successful upload
        if (ytw?.postpush && status === SYNC_STATUS.PUSHED) {
          await runScript(ytw?.postpush, workflowName)
        }
      },
    })

    // Start watching
    await watchService.startWatching(workflowsToWatch.map(({ name }) => name))

    console.log("\nWatching for changes...")
    console.log("Press Ctrl+C to exit.")
  }
}
