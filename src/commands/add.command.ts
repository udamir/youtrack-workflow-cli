import inquirer from "inquirer"
import ora from "ora"

import { isError, printNewVersionWarning, progressStatus, StatusCounter } from "../utils"
import { YoutrackService, ProjectService } from "../services"
import { printItemStatus } from "../tools/console.tools"

/**
 * Command to add workflows to a project
 * @returns Results of the command execution
 */
export const addCommand = async (workflows: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
  await printNewVersionWarning()

  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  // Create services
  const youtrackService = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrackService)

  if (workflows.length === 0) {
    try {
      // Get all available workflows from YouTrack
      const notAddedWorkflows = await projectService.notAddedWorkflows()

      if (!notAddedWorkflows.length) {
        console.log("No workflows available to add")
        return
      }

      // Show prompt to select workflows
      const selected = await inquirer.prompt<{ workflows: string[] }>([
        {
          type: "checkbox",
          name: "workflows",
          message: "Select workflows to add:",
          choices: notAddedWorkflows.map((w) => w.name),
        },
      ])

      if (!selected.workflows || selected.workflows.length === 0) {
        console.log("No workflows selected")
        return
      }

      workflows.push(...selected.workflows)
    } catch (error) {
      console.error("Error fetching available workflows:", error)
      return
    }
  }

  // Process workflows and track progress
  const counter = new StatusCounter()

  for (const workflow of workflows) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `${workflow}: ...\nAdding workflow to project (${counter.total}/${workflows.length})`,
      color: "blue",
    }).start()

    const result = await projectService.addWorkflow(workflow)

    // Stop spinner to print status line
    spinner.stop()

    printItemStatus(workflow, progressStatus(result.status), result.message)

    counter.inc(result.status)
  }

  console.log(
    `\nSuccessfully added workflows: ${counter.get("success")} (${counter.get("skipped")} skipped, ${counter.get("error")} failed)`,
  )
}
