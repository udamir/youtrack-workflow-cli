import inquirer from "inquirer"
import ora from "ora"

import { WorkflowError, WorkflowNotFoundError } from "../errors"
import { YoutrackService, ProjectService } from "../services"
import { PROGRESS_STATUS, WORKFLOW_STATUS } from "../consts"
import { isError, printItemStatus } from "../utils"

/**
 * Command for pulling workflows from YouTrack
 */
export const pullCommand = async (
  workflows: string[] = [], 
  { host = "", token = "" } = {}
): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrackService = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrackService)

  let workflowsToProcess: string[] = []

  if (!projectService.workflows.length) {
    console.error("Add workflow first, or specify workflow name.")
    return
  }

  if (workflows.length > 0) {
    // Case: Specific workflows provided as arguments
    workflowsToProcess = workflows
  } else if (workflows.length === 1 && workflows[0] === "@") {
    // Special case: '@' - prompt user to select workflows with status info
    try {
      // Get all workflow statuses
      const availableWorkflows = Object.keys(projectService.workflows)
      
      // Check statuses of workflows for better selection
      const statuses: Record<string, string> = {}
      let completedCount = 0
      
      // Create a spinner for checking statuses
      const statusSpinner = ora({
        text: `Checking workflow statuses (${completedCount}/${availableWorkflows.length})`,
        color: 'blue',
      }).start()
      
      for (const workflow of availableWorkflows) {
        try {
          const status = await projectService.workflowStatus(workflow)
          statuses[workflow] = status
        } catch (error) {
          statuses[workflow] = WORKFLOW_STATUS.UNKNOWN
        }
        
        completedCount++
      }
      
      statusSpinner.stop()
      
      // Create choices based on statuses
      const choices = availableWorkflows.map(workflow => {
        const status = statuses[workflow]
        const statusText = status ? ` (${status})` : ''
        return {
          name: `${workflow}${statusText}`,
          value: workflow
        }
      })

      // Show prompt for user to select workflows
      const selected = await inquirer.prompt([
        {
          type: "checkbox",
          name: "workflows",
          message: "Select workflows to pull:",
          choices,
        },
      ])

      if (!selected.workflows || selected.workflows.length === 0) {
        console.log("No workflows selected")
        return
      }

      workflowsToProcess.push(...selected.workflows)
    } catch (error) {
      console.error("Error checking workflow status:", error)
      return
    }
  } else {
    // Case: No arguments - pull all project workflows
    console.log("Pulling all project workflows...")
    workflowsToProcess = Object.keys(projectService.workflows)
  }

  console.log(`Will pull ${workflowsToProcess.length} workflow(s)`)
  
  // Process workflows and track progress
  let completedCount = 0
  let successCount = 0
  let failCount = 0

  for (const workflow of workflowsToProcess) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `Pulling workflow from YouTrack (${completedCount}/${workflowsToProcess.length})`,
      color: 'blue',
    }).start()
    
    try {
      await projectService.downloadYoutrackWorkflow(workflow)
      spinner.stop()
      
      // Workflow pulled successfully
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Pulled successfully")
      successCount++
    } catch (error) {
      spinner.stop()
      failCount++
      
      if (error instanceof WorkflowNotFoundError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else if (error instanceof WorkflowError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, "Failed to pull")
      }
    }
    
    completedCount++
  }

  console.log(`\nPulled workflows: ${successCount}/${workflowsToProcess.length} (${failCount} failed)`)
}
