import { zipWorkflowFiles, unzipWorkflowFiles } from "../../tools/zip.tools"
import type { WorkflowFile } from "../../types"
import { YouTrackApiError } from "../../errors"
import { tryCatch } from "../../utils"
import type {
  WorkflowEntity,
  ProjectEntity,
  CustomFieldEntity,
  CustomFieldBundleEntity,
  WorkflowItemEntity,
  RuleLog,
  CustomFieldInfo,
} from "./youtrack.types"

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
      throw new YouTrackApiError(null, "Unauthorized: YOUTRACK_TOKEN is invalid", response.status)
    }

    if (!response.ok) {
      const text = await response.text()
      throw new YouTrackApiError(null, `Request failed with status ${response.status}: ${path}`, response.status, text)
    }

    // Parse JSON response
    return type === "json" ? response.json() : (response.blob() as Promise<T>)
  }

  /**
   * Fetch all workflows from YouTrack
   * @returns Array of workflow entities
   */
  public async fetchWorkflows(): Promise<WorkflowEntity[]> {
    const [data, error] = await tryCatch(
      this.fetch<WorkflowEntity[]>(
        "/api/admin/workflows?fields=id,name,rules(id,name,title)&$top=-1&query=language:JS,mps",
      ),
    )
    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch workflows from '${this.host}'`)
    }
    return data
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

    const [blob, error] = await tryCatch(this.fetch<Blob>(`/api/admin/workflows/${workflowName}`, "blob"))
    if (error) {
      throw new YouTrackApiError(error, `Error while fetching workflow '${workflow}' from '${this.host}'`)
    }

    // Convert blob to buffer and unzip
    const arrayBuffer = await blob.arrayBuffer()
    return unzipWorkflowFiles(Buffer.from(arrayBuffer))
  }

  /**
   * Upload a workflow to YouTrack
   * @param files Workflow files
   * @throws {YouTrackApiError} If the workflow cannot be uploaded
   */
  public async uploadWorkflow(workflowName: string, files: WorkflowFile[]): Promise<void> {
    const zipBuffer = await zipWorkflowFiles(files)

    // Create a Blob from the buffer
    const blob = new Blob([zipBuffer], { type: "application/zip" })

    // Create FormData and append the file
    const form = new FormData()
    form.append("file", blob, `${workflowName}.zip`)

    const [_, error] = await tryCatch(this.fetch("/api/admin/workflows/import", "json", { method: "POST", body: form }))
    if (error) {
      throw new YouTrackApiError(error, `Error while uploading workflow '${workflowName}' to '${this.host}'`)
    }
  }

  /**
   * Get all projects from YouTrack
   * @returns Array of project entities
   * @throws {YouTrackApiError} If the projects cannot be fetched
   */
  public async fetchProjects(): Promise<ProjectEntity[]> {
    try {
      return this.fetch<ProjectEntity[]>("/api/admin/projects?fields=id,name,shortName")
    } catch (error) {
      throw new YouTrackApiError(error, `Cannot fetch projects from '${this.host}'`)
    }
  }

  /**
   * Get custom fields for a project
   * @param projectId Project ID
   * @returns Array of custom field information
   */
  public async getProjectCustomFields(projectId: string): Promise<CustomFieldInfo[]> {
    const [fields, error] = await tryCatch(
      this.fetch<CustomFieldEntity[]>(
        `/api/admin/projects/${projectId}/customFields?top=-1&fields=id,bundle(id),field(name,fieldType(isMultiValue,isBundleType,valueType)),canBeEmpty`,
      ),
    )

    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch custom fields for project '${projectId}' from '${this.host}'`)
    }

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
      throw new YouTrackApiError(
        error,
        `Cannot fetch custom field bundle for type '${type}' and bundle ID '${bundleId}' from '${this.host}'`,
      )
    }
  }

  /**
   * Get project work item types (workflows)
   * @param projectId Project ID
   * @returns Array of work item type names
   */
  public async getProjectWorkflowItems(projectId: string): Promise<string[]> {
    const [response, error] = await tryCatch(
      this.fetch<{ workItemTypes?: WorkflowItemEntity[] }>(
        `/api/admin/projects/${projectId}/timeTrackingSettings?fields=workItemTypes(id,name)&$top=-1`,
      ),
    )

    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch work item types for project '${projectId}' from '${this.host}'`)
    }

    // Extract work item type names from the response
    if (response?.workItemTypes && Array.isArray(response.workItemTypes)) {
      return response.workItemTypes.map((item) => item.name)
    }

    return [] // Return empty array if no work item types were found
  }

  /**
   * Get workflow logs
   * @param workflowId Workflow ID
   * @param ruleId Rule ID
   * @param fromTimestamp Timestamp to filter logs from
   * @returns Array of rule logs
   */
  public async getWorkflowLogs(workflowId: string, ruleId: string, fromTimestamp: number): Promise<RuleLog[]> {
    try {
      return this.fetch<RuleLog[]>(
        `/api/admin/workflows/${workflowId}/rules/${ruleId}/logs?$top=-1&fields=id,level,message,presentation,stacktrace,timestamp,username&query=${fromTimestamp}`,
      )
    } catch (error) {
      throw new YouTrackApiError(
        error,
        `Cannot fetch logs for workflow rule '${ruleId}' in workflow '${workflowId}' from '${this.host}'`,
      )
    }
  }
}
