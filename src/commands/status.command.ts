import ora from "ora"

import { PROGRESS_STATUS, WORKFLOW_STATUS, WORKFLOW_STATUS_DATA } from "../consts"
import { isError, printItemStatus, StatusCounter } from "../utils"
import type { ProgressStatus, WorkflowStatus } from "../types"
import { YoutrackService, ProjectService } from "../services"
import { isManifestExists } from "../tools/fs.tools"

/**
 * Command to check the status of workflows in a project
 * @param options Command options
 */
export const statusCommand = async ({ host = "", token = "" } = {}): Promise<void> => {
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
  const counter = new StatusCounter()

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
      text: `${workflow}: ...\nChecking workflow status (${counter.total}/${workflows.length})`,
      color: "blue",
    }).start()

    try {
      // Get workflow status
      const status = await projectService.workflowStatus(workflow)
      counter.inc(status)

      const fileStatus = status === WORKFLOW_STATUS.CONFLICT ? await projectService.getWorkflowFileStatus(workflow) : {}

      // Stop spinner to print status line
      spinner.stop()

      printItemStatus(workflow, progressStatus(status), WORKFLOW_STATUS_DATA[status].description)
      Object.entries(fileStatus).forEach(([file, status]) => {
        if (status !== WORKFLOW_STATUS.SYNCED) {
          printItemStatus(file, progressStatus(status), WORKFLOW_STATUS_DATA[status].description, 3)
        }
      })
    } catch (err) {
      // Failed to check workflow status
      counter.inc(WORKFLOW_STATUS.UNKNOWN)
      spinner.stop()
      printItemStatus(workflow, PROGRESS_STATUS.FAILED, err instanceof Error ? err.message : "Error checking status")
    }
  }

  // Display overall status message
  if (counter.get(WORKFLOW_STATUS.SYNCED) === workflows.length) {
    console.log("All workflows are in sync.")
  } else {
    // Display statistics summary
    const summaryParts = []
    if (counter.get(WORKFLOW_STATUS.SYNCED) > 0) summaryParts.push(`${counter.get(WORKFLOW_STATUS.SYNCED)} synced`)
    if (counter.get(WORKFLOW_STATUS.MODIFIED) > 0)
      summaryParts.push(`${counter.get(WORKFLOW_STATUS.MODIFIED)} modified`)
    if (counter.get(WORKFLOW_STATUS.OUTDATED) > 0)
      summaryParts.push(`${counter.get(WORKFLOW_STATUS.OUTDATED)} outdated`)
    if (counter.get(WORKFLOW_STATUS.CONFLICT) > 0)
      summaryParts.push(`${counter.get(WORKFLOW_STATUS.CONFLICT)} conflicts`)
    if (counter.get(WORKFLOW_STATUS.MISSING) > 0) summaryParts.push(`${counter.get(WORKFLOW_STATUS.MISSING)} missing`)
    if (counter.get(WORKFLOW_STATUS.NEW) > 0) summaryParts.push(`${counter.get(WORKFLOW_STATUS.NEW)} new`)

    const summary = summaryParts.join(", ")
    console.log(`Workflows: ${summary}`)
  }
}
