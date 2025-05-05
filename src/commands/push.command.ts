import inquirer from "inquirer"
import ora from "ora"

import { WorkflowError, WorkflowNotFoundError, YouTrackApiError } from "../errors"
import { PROGRESS_STATUS, WORKFLOW_STATUS } from "../consts"
import { YoutrackService, ProjectService } from "../services"
import { isError, printItemStatus } from "../utils"

/**
 * Command for pushing workflows to YouTrack
 */
export const pushCommand = async (
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
    console.error("No workflows in project. Add workflows first.")
    return
  }

  if (workflows.length === 1 && workflows[0] === "@") {
    // Case: @ - prompt user to select workflows
    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "workflows",
        message: "Select workflows to push to YouTrack:",
        choices: Object.keys(projectService.workflows),
      },
    ])

    if (!selected.workflows || selected.workflows.length === 0) {
      console.log("No workflows selected")
      return
    }

    workflowsToProcess.push(...selected.workflows)
  } else if (!workflows.length) {
    // Case: No arguments - show status and let user select workflows
    try {
      // Get all workflow statuses
      const availableWorkflows = Object.keys(projectService.workflows)
      
      // Check statuses of workflows for better selection
      const statuses: Record<string, string> = {}
      let completedCount = 0
      
      // Create a spinner for checking statuses
      const statusSpinner = ora({
        text: `Checking workflow statuses (0/${availableWorkflows.length})`,
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
        statusSpinner.text = `Checking workflow statuses (${completedCount}/${availableWorkflows.length})`
      }
      
      statusSpinner.stop()
      
      // Create choices based on statuses
      const choices = availableWorkflows.map(workflow => {
        const status = statuses[workflow]
        return {
          name: `${workflow} (${status})`,
          value: workflow,
          disabled: status === WORKFLOW_STATUS.SYNCED || status === WORKFLOW_STATUS.MISSING
        }
      })

      // Show prompt for user to select workflows
      const selected = await inquirer.prompt([
        {
          type: "checkbox",
          name: "workflows",
          message: "Select workflows to push to YouTrack:",
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
    // Case: Specific workflows provided as arguments
    workflowsToProcess = workflows
  }

  console.log(`Will push ${workflowsToProcess.length} workflow(s) to YouTrack`)
  
  // Process workflows and track progress
  let completedCount = 0
  let successCount = 0
  let failCount = 0

  for (const workflow of workflowsToProcess) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `Pushing workflow to YouTrack (${completedCount}/${workflowsToProcess.length})`,
      color: 'blue',
    }).start()
    
    try {
      await projectService.uploadWorkflow(workflow)
      spinner.stop()
      
      // Workflow pushed successfully
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Pushed successfully")
      successCount++
    } catch (error) {
      spinner.stop()
      failCount++
      
      if (error instanceof WorkflowNotFoundError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else if (error instanceof YouTrackApiError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else if (error instanceof WorkflowError) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, error.message)
      } else {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, "Failed to push to YouTrack")
      }
    }
    
    completedCount++
  }

  console.log(`\nPushed workflows: ${successCount}/${workflowsToProcess.length} (${failCount} failed)`)
}
