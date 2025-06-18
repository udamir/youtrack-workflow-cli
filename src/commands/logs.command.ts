import inquirer from "inquirer"
import ora from "ora"

import { YoutrackService, LogService, type WorkflowRule } from "../services"
import { isManifestExists } from "../tools/fs.tools"
import { colorize, formatDate, prettifyStacktrace } from "../utils"
import type { RuleLog } from "../types"
import { COLORS } from "../consts"

// Map log levels to colors
const LOG_LEVEL_COLORS: Record<string, string> = {
  INFO: COLORS.FG.CYAN,
  ERROR: COLORS.FG.RED,
  WARNING: COLORS.FG.YELLOW,
  DEBUG: COLORS.FG.GREEN,
}

/**
 * Print logs for a workflow rule
 * @param workflowName Name of the workflow
 * @param ruleName Name of the rule file
 * @param logs Array of log entries
 */
const printLogs = (workflowName: string, ruleName: string, logs: RuleLog[]) => {
  for (const log of logs) {
    const level = log.level || "INFO"
    const timestamp = log.timestamp ? formatDate(new Date(log.timestamp)) : "--"
    const levelColor = LOG_LEVEL_COLORS[level] || COLORS.RESET

    console.log(
      `[${timestamp}] ${colorize(workflowName, COLORS.FG.MAGENTA)}:${colorize(ruleName, COLORS.FG.BLUE)} ` +
        `[${colorize(level, levelColor)}]\n${log.message || ""}`,
    )

    // Print stacktrace if available
    if (log.stacktrace) {
      console.log(colorize(`${prettifyStacktrace(log.stacktrace, workflowName)}`, COLORS.FG.GRAY))
    }
  }
}

/**
 * Logs command implementation
 */
export const logsCommand = async (
  workflowNames: string[],
  {
    host,
    token,
    top = 10,
    watch = false,
    interval = 5000,
  }: { host: string; token: string; top: number; watch: boolean; interval: number },
): Promise<void> => {
  const youtrackService = new YoutrackService(host, token)
  const logService = new LogService(youtrackService)

  // Initialize spinner
  const spinner = ora("Fetching workflows...").start()

  try {
    // Get available workflows
    const serverWorkflows = await youtrackService.fetchWorkflows()

    const workflows = serverWorkflows.filter((w) => isManifestExists(w.name))

    if (workflowNames.length === 0) {
      // Validate specified workflows
      const invalidWorkflows = workflowNames.filter((name) => !workflows.some((w) => w.name === name))

      if (invalidWorkflows.length > 0) {
        spinner.fail(`Invalid workflow names: ${invalidWorkflows.join(", ")}`)
        return
      }
    }

    // If no workflows specified, show selection menu
    const workflowsToProcess = workflowNames.length
      ? workflows.filter((w) => workflowNames.includes(w.name))
      : workflows
    const workflowRules = workflowsToProcess.reduce(
      (res, workflow) => {
        res.push(
          ...workflow.rules.map((r) => ({
            name: `${workflow.name}/${r.name}`,
            value: {
              workflowId: workflow.id,
              ruleId: r.id,
              workflowName: workflow.name,
              ruleName: r.name,
            },
          })),
        )
        return res
      },
      [] as { name: string; value: WorkflowRule }[],
    )

    spinner.stop()

    const { selectedRules } = await inquirer.prompt<{ selectedRules: WorkflowRule[] }>([
      {
        type: "checkbox",
        name: "selectedRules",
        message: "Select rules to view logs for:",
        choices: workflowRules,
        validate: (input) => (input.length > 0 ? true : "Please select at least one rule"),
      },
    ])

    spinner.start("Fetching logs...")

    // One-time fetch
    const rulesLogs = await logService.fetchWorkflowRulesLogs(selectedRules, top)
    spinner.stop()

    for (const { workflowName, ruleName, logs } of rulesLogs) {
      printLogs(workflowName, ruleName, logs)
    }

    if (watch) {
      // Watch mode
      spinner.succeed(
        `Watching logs for workflows: \n  - ${selectedRules.map((r) => `${r.workflowName}/${r.ruleName}`).join(",\n  - ")}`,
      )
      console.log("Press Ctrl+C to stop watching\n")

      // Start watching logs
      await logService.startWatchingLogs(selectedRules, printLogs, interval)

      // Keep process running
      process.on("SIGINT", () => {
        logService.stopWatchingLogs()
        console.log("\nStopped watching logs")
        process.exit(0)
      })
    }
  } catch (error) {
    spinner.fail(`Error fetching logs: ${error instanceof Error ? error.message : String(error)}`)
  }
}
