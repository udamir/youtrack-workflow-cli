import ora from "ora"

import { COLORS, LINT_STATUS, LINT_STATUS_DATA, PROGRESS_STATUS } from "../consts"
import { printItemStatus } from "../tools/console.tools"
import { printNewVersionWarning } from "../utils"
import { colorize, colorizeIcon } from "../utils"
import { readLockFile } from "../tools/fs.tools"
import { LintingService } from "../services"

export const lintCommand = async (workflow: string[], { typeCheck }: { typeCheck: boolean }) => {
  await printNewVersionWarning()

  // Load configuration from package.json
  const lintingService = new LintingService({
    enableEslint: true,
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
    `${colorizeIcon(eCount ? LINT_STATUS_DATA[LINT_STATUS.FAILED] : wCount ? LINT_STATUS_DATA[LINT_STATUS.WARNING] : LINT_STATUS_DATA[LINT_STATUS.OK])} ${workflowName}: ${message.join(", ")}`,
  )
}

export const printLintResult = (errors: string[], warnings: string[]) => {
  if (errors.length > 0 || warnings.length > 0) {
    // Print detailed errors and warnings
    errors.forEach((msg) => console.log(`  ${colorizeIcon(LINT_STATUS_DATA[LINT_STATUS.FAILED])} ${msg}`))
    warnings.forEach((msg) => console.log(`  ${colorizeIcon(LINT_STATUS_DATA[LINT_STATUS.WARNING])} ${msg}`))
  }
}
