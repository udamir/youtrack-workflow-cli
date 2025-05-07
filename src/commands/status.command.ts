import ora from "ora"

import { PROGRESS_STATUS, WORKFLOW_STATUS, WORKFLOW_STATUS_DATA } from "../consts"
import type { ProgressStatus, WorkflowStatus } from "../types"
import { YoutrackService, ProjectService } from "../services"
import { isError, printItemStatus } from "../utils"
import { isManifestExists } from "../tools/fs.tools"

/**
 * Command to check the status of workflows in a project
 * @param options Command options
 */
export const statusCommand = async (
  { host = "", token = "" } = {},
): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  // Create services
  const youtrackService = new YoutrackService(host, token)
  const projectService = new ProjectService(youtrackService)

  // Get project workflows
  const serverWorkflows = await youtrackService.fetchWorkflows()

  const workflows = serverWorkflows.filter(isManifestExists)

  if (workflows.length === 0) {
    console.log("No workflows found")
    return
  }

  // Process workflows and track progress
  let completedCount = 0
  
  // Track counts for summary
  const statusCounts: Record<string, number> = {}
  for (const status of Object.values(WORKFLOW_STATUS)) {
    statusCounts[status] = 0
  }
  
  const progressStatus = (status: WorkflowStatus): ProgressStatus => {
    switch (status) {
      case WORKFLOW_STATUS.SYNCED:
      case WORKFLOW_STATUS.NEW: 
        return PROGRESS_STATUS.SUCCESS
      case WORKFLOW_STATUS.CONFLICT:
        return PROGRESS_STATUS.FAILED
      default: 
        return PROGRESS_STATUS.WARNING
    }
  }

  for (const workflow of workflows) {
    // Create spinner for tracking progress
    const spinner = ora({
      text: `${workflow}: ...\nChecking workflow status (${completedCount}/${workflows.length})`,
      prefixText: "  ",
      color: 'blue',
    }).start()
    
    try {
      // Get workflow status
      const status = await projectService.workflowStatus(workflow)
      statusCounts[status]++
      
      const fileStatus = status === WORKFLOW_STATUS.CONFLICT ? await projectService.getWorkflowFileStatus(workflow) : {}

      // Stop spinner to print status line
      spinner.stop()

      printItemStatus(workflow, progressStatus(status), WORKFLOW_STATUS_DATA[status].description)
      Object.entries(fileStatus).forEach(([file, status]) => {
        if (status !== WORKFLOW_STATUS.SYNCED) {
          printItemStatus(file, progressStatus(status), WORKFLOW_STATUS_DATA[status].description, 5)
        }
      })
      
    } catch (err) {
      // Failed to check workflow status
      statusCounts[WORKFLOW_STATUS.UNKNOWN]++
      spinner.stop()
      printItemStatus(workflow, PROGRESS_STATUS.FAILED, err instanceof Error ? err.message : "Error checking status")
    }
    
    completedCount++
  }
  
  // Display overall status message
  if (statusCounts[WORKFLOW_STATUS.SYNCED] === workflows.length) {
    console.log("All workflows are in sync.")
  } else {
    // Display statistics summary
    const summaryParts = []
    if (statusCounts[WORKFLOW_STATUS.SYNCED] > 0) 
      summaryParts.push(`${statusCounts[WORKFLOW_STATUS.SYNCED]} synced`)
    if (statusCounts[WORKFLOW_STATUS.MODIFIED] > 0) 
      summaryParts.push(`${statusCounts[WORKFLOW_STATUS.MODIFIED]} modified`)
    if (statusCounts[WORKFLOW_STATUS.OUTDATED] > 0) 
      summaryParts.push(`${statusCounts[WORKFLOW_STATUS.OUTDATED]} outdated`)
    if (statusCounts[WORKFLOW_STATUS.CONFLICT] > 0) 
      summaryParts.push(`${statusCounts[WORKFLOW_STATUS.CONFLICT]} conflicts`)
    if (statusCounts[WORKFLOW_STATUS.MISSING] > 0) 
      summaryParts.push(`${statusCounts[WORKFLOW_STATUS.MISSING]} missing`)
    if (statusCounts[WORKFLOW_STATUS.NEW] > 0) 
      summaryParts.push(`${statusCounts[WORKFLOW_STATUS.NEW]} new`)
      
    const summary = summaryParts.join(", ")
    console.log(`Workflows: ${summary}`)
  }
}
