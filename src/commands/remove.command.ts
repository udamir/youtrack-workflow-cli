import inquirer from "inquirer"

import { YoutrackService, ProjectService } from "../services"
import { isError } from "../utils"

/**
 * Command handler for removing workflows from the project
 * @param workflows Workflow names to remove
 * @param options Command options
 */
export const removeCommand = async (
  workflows: string[] = [],
  { host = "", token = "", deleteFiles = false } = {},
): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrack = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrack)

  // If no workflows specified, prompt user to select from existing project workflows
  if (!workflows.length) {
    // Get the workflows currently in the project
    const projectWorkflows = projectService.workflows.map((w) => w.name)

    if (projectWorkflows.length === 0) {
      console.log("No workflows found in this project. Nothing to remove.")
      return
    }

    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to remove:",
        choices: projectWorkflows,
      },
    ])

    if (!selected.workflows.length) {
      console.log("No workflows selected. Exiting.")
      return
    }

    console.log("Selected workflows to remove:", selected.workflows)
    workflows.push(...selected.workflows)

    // Confirm workflow deletion if deleteFiles option is true

    if (!deleteFiles) {
      const confirm = await inquirer.prompt([
        {
          type: "confirm",
          name: "deleteFiles",
          message: "This will delete the workflow files from your filesystem. Continue?",
          default: false,
        },
      ])

      if (confirm.deleteFiles) {
        console.log("Confirmed file deletion. Workflows will be removed from the project and files will be deleted.")
        deleteFiles = true
      }
    }
  }

  try {
    await projectService.removeWorkflows(workflows, deleteFiles)
    console.log(`Workflows removed successfully${deleteFiles ? " and files deleted" : ""}.`)
  } catch (error) {
    console.error("Error removing workflows:", error)
  }
}
