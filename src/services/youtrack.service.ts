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

type ProjectEntity = {
  id: string
  name: string
  shortName: string
}

type CustomFieldEntity = {
  id: string
  bundle: {
    id: string
  }
  field: {
    name: string
    fieldType: {
      isMultiValue: boolean
      isBundleType: boolean
      valueType: string
    }
  }
  canBeEmpty: boolean
}

type CustomFieldBundleEntity = {
  id: string
  name: string
}

type WorkflowItemEntity = {
  id: string
  name: string
}

export type CustomFieldInfo = {
  name: string
  type: string
  canBeEmpty: boolean
  isBundleType: boolean
  isMultiValue: boolean
  values?: string[]
}

/**
 * Service for interacting with YouTrack API
 */
export class YoutrackService {
  constructor(
    private readonly host: string,
    private readonly token: string,
  ) {}

  /**
   * Private method to handle fetch requests to YouTrack API
   * @param path API path (without host)
   * @param options Additional fetch options
   * @param errorMessage Custom error message for non-OK responses
   * @returns JSON response data
   * @throws Error if request fails
   */
  private async fetch<T>(path: string, type: "json" | "blob" = "json", options: RequestInit = {}): Promise<T> {
    // Construct full URL
    const url = new URL(path, this.host)

    // Set up default headers with authorization
    const headers = {
      Authorization: `Bearer ${this.token}`,
      ...(type === "blob" ? { Accept: "application/zip" } : {}),
      ...options.headers,
    }

    // Create params object with headers
    const params = {
      ...options,
      headers,
    }

    // Make the request
    const response = await fetch(url, params)

    // Handle common error cases
    if (response.status === 401) {
      throw new YouTrackApiError("Unauthorized: YOUTRACK_TOKEN is invalid", response.status)
    }

    if (!response.ok) {
      const text = await response.text()
      throw new YouTrackApiError(`Request failed with status ${response.status}: ${path}`, response.status, text)
    }

    // Parse JSON response
    return type === "json" ? response.json() : (response.blob() as Promise<T>)
  }

  /**
   * Fetch all workflows from YouTrack
   * @returns Array of workflow names
   */
  public async fetchWorkflows(): Promise<string[]> {
    try {
      const data = await this.fetch<WorkflowEntity[]>("/api/admin/workflows?fields=id,name&$top=-1")
      return data.map(({ name }) => name)
    } catch (error) {
      if (error instanceof YouTrackApiError) {
        throw error
      }
      throw new YouTrackApiError(
        `Cannot fetch workflows from '${this.host}'`,
        500,
        error instanceof Error ? error.message : "Unknown error",
      )
    }
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

    try {
      const blob = await this.fetch<Blob>(`/api/admin/workflows/${workflowName}`, "blob")

      // Convert blob to buffer and unzip
      const arrayBuffer = await blob.arrayBuffer()
      return unzipWorkflowFiles(Buffer.from(arrayBuffer))
    } catch (error) {
      if (error instanceof YouTrackApiError) {
        throw error
      }
      throw new YouTrackApiError(
        `Error while fetching workflow '${workflow}' from '${this.host}'`,
        500,
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }

  /**
   * Upload a workflow to YouTrack
   * @param files Workflow files
   * @returns True if successful
   * @throws {YouTrackApiError} If the workflow cannot be uploaded
   */
  public async uploadWorkflow(workflowName: string, files: WorkflowFile[]): Promise<boolean> {
    const zipBuffer = await zipWorkflowFiles(files)

    // Create a Blob from the buffer
    const blob = new Blob([zipBuffer], { type: "application/zip" })

    // Create FormData and append the file
    const form = new FormData()
    form.append("file", blob, `${workflowName}.zip`)

    try {
      await this.fetch("/api/admin/workflows/import", "json", { method: "POST", body: form })
    } catch (error) {
      if (error instanceof YouTrackApiError) {
        throw error
      }
      throw new YouTrackApiError(
        `Error while uploading workflow '${workflowName}' to '${this.host}'`,
        500,
        error instanceof Error ? error.message : "Unknown error",
      )
    }

    return true
  }

  /**
   * Get all projects from YouTrack
   * @returns Array of project entities
   * @throws {YouTrackApiError} If the projects cannot be fetched
   */
  public async fetchProjects(): Promise<ProjectEntity[]> {
    try {
      return this.fetch("/api/admin/projects?fields=id,name,shortName")
    } catch (error) {
      if (error instanceof YouTrackApiError) {
        throw error
      }
      throw new YouTrackApiError(
        `Cannot fetch projects from '${this.host}'`,
        500,
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }

  /**
   * Get custom fields for a project
   * @param projectId Project ID
   * @returns Array of custom field information
   */
  public async getProjectCustomFields(projectId: string): Promise<CustomFieldInfo[]> {
    try {
      const fields = await this.fetch<CustomFieldEntity[]>(
        `/api/admin/projects/${projectId}/customFields?top=-1&fields=id,bundle(id),field(name,fieldType(isMultiValue,isBundleType,valueType)),canBeEmpty`,
      )

      const customFields: CustomFieldInfo[] = []
      for (const field of fields) {
        const fieldValues: CustomFieldInfo = {
          name: field.field.name,
          type: field.field.fieldType.valueType,
          canBeEmpty: field.canBeEmpty,
          isBundleType: field.field.fieldType.isBundleType,
          isMultiValue: field.field.fieldType.isMultiValue,
        }
        if (field.bundle) {
          const bundle = await this.getCustomFieldBundle(field.field.fieldType.valueType, field.bundle.id)
          fieldValues.values = bundle.map(({ name }) => name)
        }
        customFields.push(fieldValues)
      }

      return customFields
    } catch (error) {
      if (error instanceof YouTrackApiError) {
        throw error
      }
      throw new YouTrackApiError(
        `Cannot fetch custom fields for project '${projectId}' from '${this.host}'`,
        500,
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }

  /**
   * Get custom field bundle
   * @param type Custom field type
   * @param bundleId Bundle ID
   * @returns Array of custom field bundle entities
   * @throws {YouTrackApiError} If the custom field bundle cannot be fetched
   */
  public async getCustomFieldBundle(type: string, bundleId: string): Promise<CustomFieldBundleEntity[]> {
    try {
      return this.fetch<CustomFieldBundleEntity[]>(
        `/api/admin/customFieldSettings/bundles/${type}/${bundleId}/values?top=-1&fields=id,name`,
      )
    } catch (error) {
      if (error instanceof YouTrackApiError) {
        throw error
      }
      throw new YouTrackApiError(
        `Cannot fetch custom field bundle for type '${type}' and bundle ID '${bundleId}' from '${this.host}'`,
        500,
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }

  /**
   * Get project work item types (workflows)
   * @param projectId Project ID
   * @returns Array of work item type names
   */
  public async getProjectWorkflowItems(projectId: string): Promise<string[]> {
    try {
      const response = await this.fetch<{ workItemTypes?: WorkflowItemEntity[] }>(
        `/api/admin/projects/${projectId}/timeTrackingSettings?fields=workItemTypes(id,name)&$top=-1`,
      )

      // Extract work item type names from the response
      if (response?.workItemTypes && Array.isArray(response.workItemTypes)) {
        return response.workItemTypes.map((item) => item.name)
      }

      return [] // Return empty array if no work item types were found
    } catch (error) {
      if (error instanceof YouTrackApiError) {
        throw error
      }
      throw new YouTrackApiError(
        `Cannot fetch work item types for project '${projectId}' from '${this.host}'`,
        500,
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }
}
