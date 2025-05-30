import inquirer from "inquirer"
import ora from "ora"

import { isError, printItemStatus, progressStatus, StatusCounter } from "../utils"
import { YoutrackService, ProjectService } from "../services"

/**
 * Command to remove workflows from a project
 * @returns Results of the command execution
 */
export const removeCommand = async (workflows: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
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
      // Get project workflows from the workflows property
      const projectWorkflows = await projectService.projectWorkflows()

      if (projectWorkflows.length === 0) {
        console.log("No workflows in project")
        return
      }

      // Show prompt to select workflows to remove
      const selected = await inquirer.prompt([
        {
          type: "checkbox",
          name: "workflows",
          message: "Select workflows to remove:",
          choices: projectWorkflows.map((w) => w.name),
        },
      ])

      if (!selected.workflows || selected.workflows.length === 0) {
        console.log("No workflows selected")
        return
      }

      // Use selected workflows instead of modifying the parameter
      workflows.push(...selected.workflows)
    } catch (error) {
      console.error("Error fetching project workflows:", error)
      return
    }
  }

  // Process workflows and track progress
  const counter = new StatusCounter()

  for (const workflow of workflows) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `${workflow}: ...\nRemoving workflow from project (${counter.total}/${workflows.length})`,
      color: "blue",
    }).start()

    const result = await projectService.removeWorkflow(workflow)

    // Stop spinner to print status line
    spinner.stop()

    printItemStatus(workflow, progressStatus(result.status), result.message)

    counter.inc(result.status)
  }

  console.log(
    `\nSuccessfully removed workflows: ${counter.get("success")} (${counter.get("skipped")} skipped, ${counter.get("error")} failed)`,
  )
}
