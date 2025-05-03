import inquirer from "inquirer"

import { YoutrackService, ProjectService } from "../services"
import { WorkflowError, YouTrackApiError } from "../errors"
import { isError, colorize } from "../utils"
import { COLORS } from "../consts"

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
      if (error instanceof YouTrackApiError) {
        console.error(`Error fetching available workflows: ${error.message}`)
        if (error.responseText) {
          console.error("Response details:", error.responseText)
        }
      } else {
        console.error("Error fetching available workflows:", error)
      }
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
    const results = await projectService.addWorkflows(workflows)
    
    // Process and display results for each workflow
    for (const [workflow, result] of Object.entries(results)) {
      if (result.success) {
        console.log(`${colorize("✓", COLORS.FG.GREEN)} ${workflow}: ${result.message}`)
      } else if (result.skipped) {
        console.log(`${colorize("⧖", COLORS.FG.YELLOW)} ${workflow}: ${result.message}`)
      } else {
        console.log(`${colorize("✗", COLORS.FG.RED)} ${workflow}: ${result.message}`)
        if (result.error) {
          console.error(`  Error details: ${result.error.message}`)
        }
      }
    }
  } catch (error) {
    if (error instanceof WorkflowError) {
      console.error(`Error adding workflows: ${error.message}`)
    } else {
      console.error("Error adding workflows:", error)
    }
  }
}
