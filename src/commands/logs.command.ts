import inquirer from "inquirer"
import ora from "ora"

import { colorize, formatDate, prettifyStacktrace, tryCatch } from "../utils"
import { YoutrackService, LogService, type WorkflowRule } from "../services"
import { isManifestExists, readLocalWorkflowFile } from "../tools/fs.tools"
import type { RuleLog } from "../types"
import { COLORS } from "../consts"

// Map log levels to colors
const LOG_LEVEL_COLORS: Record<string, string> = {
  INFO: COLORS.FG.CYAN,
  ERROR: COLORS.FG.RED,
  WARNING: COLORS.FG.YELLOW,
  DEBUG: COLORS.FG.GREEN,
}

type ParsedLogTarget = { type: "workflow"; name: string } | { type: "rule"; workflowName: string; ruleName: string }

/**
 * Parse a log target argument into either a workflow or workflow/rule target
 * @param arg The argument to parse (e.g., "my-workflow" or "my-workflow/my-rule")
 * @returns Parsed target object
 */
const parseLogTarget = (arg: string): ParsedLogTarget => {
  const slashIndex = arg.indexOf("/")
  if (slashIndex > 0 && slashIndex < arg.length - 1) {
    return {
      type: "rule",
      workflowName: arg.substring(0, slashIndex),
      ruleName: arg.substring(slashIndex + 1),
    }
  }
  return { type: "workflow", name: arg }
}

/**
 * Print logs for a workflow rule
 * @param workflowName Name of the workflow
 * @param ruleName Name of the rule file
 * @param logs Array of log entries
 */
const printLogs = (workflowName: string, ruleName: string, logs: RuleLog[]) => {
  let fileContent = ""
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
      if (!fileContent) {
        fileContent = readLocalWorkflowFile(workflowName, `${ruleName}.js`)
      }
      console.log(colorize(`${prettifyStacktrace(log.stacktrace, fileContent)}`, COLORS.FG.GRAY))
    }
  }
}

/**
 * Logs command implementation
 */
export const logsCommand = async (
  targets: string[],
  { host, token, top, watch, all }: { host: string; token: string; top: number; watch?: number; all: boolean },
): Promise<void> => {
  const youtrackService = new YoutrackService(host, token)
  const logService = new LogService(youtrackService)

  // Initialize spinner
  const spinner = ora("Fetching workflows...").start()

  // Get available workflows
  const [serverWorkflows, err] = await tryCatch(youtrackService.fetchWorkflows())

  if (err) {
    spinner.fail(`Error fetching workflows: ${err.message}`)
    return
  }

  const workflows = serverWorkflows.filter((w) => isManifestExists(w.name))

  // Parse targets into workflow-only and rule-specific targets
  const parsedTargets = targets.map(parseLogTarget)
  const workflowTargets = parsedTargets.filter((t): t is { type: "workflow"; name: string } => t.type === "workflow")
  const ruleTargets = parsedTargets.filter(
    (t): t is { type: "rule"; workflowName: string; ruleName: string } => t.type === "rule",
  )

  // Resolve rule-specific targets directly
  const directRules: WorkflowRule[] = []
  for (const target of ruleTargets) {
    const workflow = workflows.find((w) => w.name === target.workflowName)
    if (!workflow) {
      spinner.fail(`Workflow '${target.workflowName}' not found`)
      return
    }
    const rule = workflow.rules.find((r) => r.name === target.ruleName)
    if (!rule) {
      spinner.fail(`Rule '${target.ruleName}' not found in workflow '${target.workflowName}'`)
      return
    }
    directRules.push({
      workflowId: workflow.id,
      ruleId: rule.id,
      workflowName: workflow.name,
      ruleName: rule.name,
    })
  }

  // Handle workflow-only targets
  const workflowNames = workflowTargets.map((t) => t.name)

  // Validate specified workflows
  if (workflowNames.length > 0) {
    const invalidWorkflows = workflowNames.filter((name) => !workflows.some((w) => w.name === name))
    if (invalidWorkflows.length > 0) {
      spinner.fail(`Invalid workflow names: ${invalidWorkflows.join(", ")}`)
      return
    }
  }

  // Build workflow rules for workflow-only targets (used for --all or prompt)
  const workflowsToProcess =
    workflowNames.length > 0 ? workflows.filter((w) => workflowNames.includes(w.name)) : workflows
  const workflowRulesForPrompt = workflowsToProcess.reduce(
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

  // If we have direct rules and no workflow targets, skip prompt/all logic
  const hasWorkflowTargets = workflowNames.length > 0 || targets.length === 0
  const needsSelection = hasWorkflowTargets && !all && workflowRulesForPrompt.length > 0

  if (workflowRulesForPrompt.length === 0 && directRules.length === 0) {
    spinner.fail("No workflows found. Add workflows first.")
    return
  }

  spinner.stop()

  const selectedRules: WorkflowRule[] = [...directRules]

  if (hasWorkflowTargets) {
    if (all) {
      // Add all rules from workflow targets
      selectedRules.push(...workflowRulesForPrompt.map(({ value }) => value))
    } else if (needsSelection) {
      // Prompt for selection from workflow targets
      const { selectedRules: selectedRulesFromPrompt } = await inquirer.prompt<{ selectedRules: WorkflowRule[] }>([
        {
          type: "checkbox",
          name: "selectedRules",
          message: "Select rules to view logs for:",
          choices: workflowRulesForPrompt,
          validate: (input) => (input.length > 0 || directRules.length > 0 ? true : "Please select at least one rule"),
        },
      ])
      selectedRules.push(...selectedRulesFromPrompt)
    }
  }

  if (selectedRules.length === 0) {
    spinner.fail("No rules selected")
    return
  }

  spinner.start("Fetching logs...")

  // One-time fetch
  const [rulesLogs, error] = await tryCatch(logService.fetchWorkflowRulesLogs(selectedRules, top))
  spinner.stop()

  if (error) {
    spinner.fail(`Error fetching logs: ${error.message}`)
    return
  }

  for (const { workflowName, ruleName, logs } of rulesLogs) {
    printLogs(workflowName, ruleName, logs)
  }

  if (watch) {
    // Watch mode
    spinner.succeed(
      `Watching logs for workflows (${watch}ms interval): \n  - ${selectedRules.map((r) => `${r.workflowName}/${r.ruleName}`).join(",\n  - ")}`,
    )
    console.log("Press Ctrl+C to stop watching\n")

    let watchingCount = selectedRules.length

    // Start watching logs
    await logService.startWatchingLogs(
      selectedRules,
      printLogs,
      (workflowName, ruleName, message) => {
        console.error(`Error fetching logs for ${workflowName}/${ruleName}: ${message}`)
        watchingCount--
        if (watchingCount === 0) {
          logService.stopWatchingLogs()
          console.log("\nStopped watching logs")
          process.exit(0)
        }
      },
      watch,
    )

    // Keep process running
    process.on("SIGINT", () => {
      logService.stopWatchingLogs()
      console.log("\nStopped watching logs")
      process.exit(0)
    })
  }
}
