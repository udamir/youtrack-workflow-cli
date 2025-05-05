import { zipWorkflowFiles, unzipWorkflowFiles } from "../tools/zip.tools"
import type { WorkflowFile } from "../types"
import { YouTrackApiError } from "../errors"

/**
 * YouTrack workflow entity type
 */
type WorkflowEntity = {
  id: string
  name: string
}

export class YoutrackService {
  constructor(
    private readonly host: string,
    private readonly token: string,
  ) {}

  /**
   * Fetch all workflows from YouTrack
   * @returns Array of workflow names
   */
  public async fetchWorkflows(): Promise<string[]> {
    const url = new URL("/api/admin/workflows?fields=id,name&$top=-1", this.host)
    const params = { headers: { Authorization: `Bearer ${this.token}` } }

    const response = await fetch(url, params)

    if (response.status === 401) {
      throw new Error("Unauthorized: YOUTRACK_TOKEN is invalid")
    }

    if (!response.ok) {
      throw new Error(`Cannot fetch workflows from '${this.host}'`)
    }

    const data = (await response.json()) as WorkflowEntity[]
    return data.map(({ name }) => name)
  }

  /**
   * Fetch a workflow from YouTrack
   * @param workflow Workflow name
   * @returns Workflow data as an array of WorkflowFile
   * @throws {YouTrackApiError} If the workflow cannot be fetched
   */
  public async fetchWorkflow(workflow: string): Promise<WorkflowFile[] | null> {
    // Remove @ prefix but don't encode the whole name
    const workflowName = workflow.replace(/^@/, "")
    const url = new URL(`/api/admin/workflows/${workflowName}`, this.host)
    const params = {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/zip",
      },
    }

    const response = await fetch(url, params)

    if (response.status === 401) {
      throw new Error("Unauthorized: YOUTRACK_TOKEN is invalid")
    }

    if (!response.ok) {
      let responseText = ""
      try {
        // Try to read response text if available
        responseText = await response.text()
      } catch {
        // Unable to read response text
      }
      
      throw new YouTrackApiError(
        `Cannot fetch workflow '${workflow}' from '${this.host}'`,
        response.status,
        responseText
      )
    }

    const blob = await response.blob()
    // Convert blob to buffer
    const arrayBuffer = await blob.arrayBuffer()
    return unzipWorkflowFiles(Buffer.from(arrayBuffer))
  }

  /**
   * Upload a workflow to YouTrack
   * @param files Workflow files
   * @returns True if successful
   * @throws {YouTrackApiError} If the workflow cannot be uploaded
   */
  public async uploadWorkflow(files: WorkflowFile[]): Promise<boolean> {
    const zipBuffer = await zipWorkflowFiles(files)

    const url = new URL("/api/admin/workflows", this.host)
    const params = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/zip",
      },
      body: zipBuffer,
    }

    const response = await fetch(url, params)

    if (response.status === 401) {
      throw new Error("Unauthorized: YOUTRACK_TOKEN is invalid")
    }

    if (!response.ok) {
      let responseText = ""
      try {
        // Try to read response text if available
        responseText = await response.text()
      } catch {
        // Unable to read response text
      }
      
      throw new YouTrackApiError(
        `Cannot upload workflow to '${this.host}'`,
        response.status,
        responseText
      )
    }

    return true
  }
}
