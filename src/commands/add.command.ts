import inquirer from "inquirer"

import { YoutrackService, ProjectService } from "../services"
import { isError } from "../utils"

/**
 * Command handler for adding workflows to the project
 * @param workflows Workflow names to add
 * @param options Command options
 */
export const addCommand = async (workflows: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrack = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrack)

  // If no workflows specified, prompt user to select
  if (!workflows.length) {
    const availableWorkflows: string[] = []
    try {
      availableWorkflows.push(...(await projectService.availableWorkflows()))
    } catch (error) {
      console.error("Error fetching available workflows:", error)
      return
    }

    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to add:",
        choices: availableWorkflows,
      },
    ])

    if (!selected.workflows.length) {
      console.log("No workflows selected. Exiting.")
      return
    }

    console.log("Selected workflows:", selected.workflows)
    workflows.push(...selected.workflows)
  }

  try {
    await projectService.addWorkflows(workflows)
    console.log("Workflows added successfully.")
  } catch (error) {
    console.error("Error adding workflows:", error)
  }
}
