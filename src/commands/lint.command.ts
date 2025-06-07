import ora from "ora"

import { COLORS, PROGRESS_STATUS, PROGRESS_STATUS_DATA } from "../consts"
import { colorize, colorizeIcon, printItemStatus } from "../utils"
import { readLockFile } from "../tools/fs.tools"
import { LintingService } from "../services"

export const lintCommand = async (workflow: string[], { typeCheck }: { typeCheck: boolean }) => {
  // Load configuration from package.json
  const lintingService = new LintingService({
    enableEslint: typeCheck,
    enableTypeCheck: typeCheck,
  })

  const workflowToProcess: string[] = workflow.length > 0 ? workflow : Object.keys(readLockFile()?.workflows ?? {})

  // Get workflows to lint
  if (workflowToProcess.length === 0) {
    console.error("No workflows found to lint")
    return
  }

  // Process each workflow
  for (const workflowPath of workflowToProcess) {
    const workflowName = workflowPath.split("/").pop() || workflowPath
    const spinner = ora({
      text: `Linting workflow: ${workflowName}`,
      color: "blue",
    }).start()

    try {
      const { warnings, errors } = await lintingService.lintWorkflow(workflowPath)

      spinner.stop()

      printLintSummary(workflowName, errors, warnings)
      printLintResult(errors, warnings)
    } catch (error) {
      spinner.stop()
      printItemStatus(workflowPath, PROGRESS_STATUS.FAILED, error instanceof Error ? error.message : "Unknown error")
    }
  }
}

export const printLintSummary = (workflowName: string, errors: string[], warnings: string[]) => {
  const eCount = errors.length
  const wCount = warnings.length

  const message: string[] = []
  if (eCount) {
    message.push(colorize(`${eCount} error(s)`, COLORS.FG.RED))
  }
  if (wCount) {
    message.push(colorize(`${wCount} warning(s)`, COLORS.FG.YELLOW))
  }
  if (!eCount && !wCount) {
    message.push(colorize("No issues found", COLORS.FG.GREEN))
  }

  console.log(
    `${colorizeIcon(eCount ? PROGRESS_STATUS_DATA[PROGRESS_STATUS.FAILED] : wCount ? PROGRESS_STATUS_DATA[PROGRESS_STATUS.WARNING] : PROGRESS_STATUS_DATA[PROGRESS_STATUS.SUCCESS])} ${workflowName}: ${message.join(", ")}`,
  )
}

export const printLintResult = (errors: string[], warnings: string[]) => {
  if (errors.length > 0 || warnings.length > 0) {
    // Print detailed errors and warnings
    errors.forEach((msg) => console.log(`  ${colorizeIcon(PROGRESS_STATUS_DATA[PROGRESS_STATUS.FAILED])} ${msg}`))
    warnings.forEach((msg) => console.log(`  ${colorizeIcon(PROGRESS_STATUS_DATA[PROGRESS_STATUS.WARNING])} ${msg}`))
  }
}
