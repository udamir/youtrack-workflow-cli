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
  IssueLinkType,
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

    const data = response.headers.get("Content-Type")?.includes("application/json")
      ? await response.json()
      : await response.blob()

    // Handle common error cases
    if (response.status === 401) {
      throw new YouTrackApiError(null, "Unauthorized: YOUTRACK_TOKEN is invalid", response.status)
    }

    if (!response.ok) {
      const message = data?.error_description.split("\n\n")[0] || "Unknown error"
      throw new YouTrackApiError(
        null,
        `Request failed with status ${response.status}: ${message.replace(/scripts\//g, "\n")}`,
        response.status,
      )
    }

    // Parse JSON response
    return data
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
   * @returns {Promise<WorkflowFile[] | null>} Workflow data as an array of WorkflowFile
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

    await this.fetch("/api/admin/workflows/import", "json", { method: "POST", body: form })
  }

  /**
   * Get all projects from YouTrack
   * @returns {Promise<ProjectEntity[]>} Array of project entities
   * @throws {YouTrackApiError} If the projects cannot be fetched
   */
  public async fetchProjects(): Promise<ProjectEntity[]> {
    const [data, error] = await tryCatch(this.fetch<ProjectEntity[]>("/api/admin/projects?fields=id,name,shortName&$top=-1"))
    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch projects from '${this.host}'`)
    }
    return data
  }

  /**
   * Get custom fields for a project
   * @param projectId Project ID
   * @returns {Promise<CustomFieldInfo[]>} Array of custom field information
   * @throws {YouTrackApiError} If the custom fields cannot be fetched
   */
  public async getProjectCustomFields(projectId: string): Promise<CustomFieldInfo[]> {
    const [fields, error] = await tryCatch(
      this.fetch<CustomFieldEntity[]>(
        `/api/admin/projects/${projectId}/customFields?top=-1&fields=id,bundle(id),field(name,fieldType(isMultiValue,isBundleType,valueType)),canBeEmpty`,
      ),
    )

    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch custom fields for project from '${this.host}'`)
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
   * @returns {Promise<CustomFieldBundleEntity[]>} Array of custom field bundle entities
   * @throws {YouTrackApiError} If the custom field bundle cannot be fetched
   */
  public async getCustomFieldBundle(type: string, bundleId: string): Promise<CustomFieldBundleEntity[]> {
    const [data, error] = await tryCatch(
      this.fetch<CustomFieldBundleEntity[]>(
        `/api/admin/customFieldSettings/bundles/${type}/${bundleId}/values?top=-1&fields=id,name`,
      ),
    )
    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch custom field bundle for type '${type}' from '${this.host}'`)
    }
    return data
  }

  /**
   * Get project work item types (workflows)
   * @param projectId Project ID
   * @returns {Promise<string[]>} Array of work item type names
   * @throws {YouTrackApiError} If the work item types cannot be fetched
   */
  public async getProjectWorkflowItems(projectId: string): Promise<string[]> {
    const [response, error] = await tryCatch(
      this.fetch<{ workItemTypes?: WorkflowItemEntity[] }>(
        `/api/admin/projects/${projectId}/timeTrackingSettings?fields=workItemTypes(id,name)&$top=-1`,
      ),
    )

    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch work item types for project from '${this.host}'`)
    }

    // Extract work item type names from the response
    if (response?.workItemTypes && Array.isArray(response.workItemTypes)) {
      return response.workItemTypes.map((item) => item.name)
    }

    return [] // Return empty array if no work item types were found
  }

  /**
   * Get issue link types
   * @returns {Promise<IssueLinkType[]>} Array of issue link types
   * @throws {YouTrackApiError} If the issue link types cannot be fetched
   */
  public async getIssueLinkTypes(): Promise<IssueLinkType[]> {
    const [response, error] = await tryCatch(
      this.fetch<IssueLinkType[]>(
        `/api/issueLinkTypes?fields=aggregation,directed,id,name,readOnly,sourceToTarget,targetToSource&$top=-1`,
      ),
    )
    if (error) {
      throw new YouTrackApiError(error, `Cannot fetch issue link types from '${this.host}'`)
    }
    return response
  }

  /**
   * Get workflow logs
   * @param workflowId Workflow ID
   * @param ruleId Rule ID
   * @param fromTimestamp Timestamp to filter logs from
   * @returns {Promise<RuleLog[]>} Array of rule logs
   * @throws {YouTrackApiError} If the workflow logs cannot be fetched
   */
  public async getWorkflowLogs(workflowId: string, ruleId: string, fromTimestamp = 0, top = -1): Promise<RuleLog[]> {
    const [data, error] = await tryCatch(
      this.fetch<RuleLog[]>(
        `/api/admin/workflows/${workflowId}/rules/${ruleId}/logs?$top=${top}&fields=id,level,message,presentation,stacktrace,timestamp,username&query=${fromTimestamp}`,
      ),
    )
    if (error) {
      throw new YouTrackApiError(null, `Cannot fetch logs for workflow rule from '${this.host}'`)
    }
    return data
  }
}
