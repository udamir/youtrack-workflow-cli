import { readLocalWorkflowFiles, writeLocalWorkflowFiles, readLockFile, writeLockFile, isLocalWorkflow, deleteLocalWorkflowFiles, isManifestExists } from "../tools/fs.tools"
import { WorkflowNotFoundError, WorkflowNotInProjectError } from "../errors"
import type { WorkflowFile, WorkflowStatus, WorkflowHash } from "../types"
import { calculateWorkflowHash } from "../tools/hash.tools"
import type { YoutrackService } from "./youtrack.service"
import { WORKFLOW_STATUS, COLORS } from "../consts"

type WorkflowDataCache = {
  files: WorkflowFile[]
  hash: string
  fileHashes: Record<string, string>
}

export type ActionResult = {
  success: boolean
  skipped: boolean
  error?: Error
  message: string
}

export class ProjectService {
  private _workflows: Record<string, WorkflowHash> = {}
  private _serverCache: Record<string, WorkflowDataCache | null> = {}
  private _localCache: Record<string, WorkflowDataCache | null> = {}


  constructor(private readonly youtrack: YoutrackService) {
    const data = readLockFile()
    this._workflows = data?.workflows || {}
  }

  /**
   * Save workflows to lock file
   * @param workflows Workflows to save
   */
  public updateLockFile(workflows?: Record<string, WorkflowHash>) {
    const pkg = readLockFile()

    pkg.workflows = workflows || this._workflows

    writeLockFile(pkg)
  }

  /**
   * Get a list of workflows in the project
   * @returns Array of workflow names
   */
  public async projectWorkflows(): Promise<string[]> {
    const serverWorkflows = await this.youtrack.fetchWorkflows()
    return serverWorkflows.filter(isManifestExists)
  }

  /**
   * Cache a workflow from the local filesystem
   * @param name Workflow name
   * @returns Cached workflow data or null if not found
   */
  public async cacheLocalWorkflow(name: string) {
    if (this._localCache[name]) {
      return this._localCache[name]
    }

    try {
      const localWorkflowFiles = await readLocalWorkflowFiles(name)
      const { hash, fileHashes: files } = calculateWorkflowHash(localWorkflowFiles)
      
      this._localCache[name] = {
        files: localWorkflowFiles,
        hash,
        fileHashes: files
      }
    } catch (error) {
      this._localCache[name] = null
    }

    return this._localCache[name]
  }

  /**
   * Upload a workflow to YouTrack
   * @param name Workflow name
   * @throws {WorkflowNotInProjectError} If the workflow doesn't exist in the project
   * @throws {WorkflowNotFoundError} If the workflow files don't exist
   */
  public async uploadWorkflow(name: string) {
    if (!isLocalWorkflow(name)) {
      throw new WorkflowNotInProjectError(name)
    }

    const localCache = await this.cacheLocalWorkflow(name)
    if (!localCache) {
      throw new WorkflowNotFoundError(name)
    }
    const { files, ...rest } = localCache

    await this.youtrack.uploadWorkflow(name, files)

    this._workflows[name] = rest
    this.updateLockFile()
  }

  /**
   * Fetch a workflow from YouTrack and cache it
   * @param name Workflow name
   * @returns Cached workflow data or null if not found
   */
  public async cacheYoutrackWorkflow(name: string) {
    if (this._serverCache[name]) {
      return this._serverCache[name]
    }

    try {
      const workflowFiles = await this.youtrack.fetchWorkflow(name)
      if (!workflowFiles) {
        this._serverCache[name] = null
      } else {
        const { hash, fileHashes: files } = calculateWorkflowHash(workflowFiles)
        
        this._serverCache[name] = {
          files: workflowFiles,
          hash,
          fileHashes: files
        }
      }
    } catch (error) {
      this._serverCache[name] = null
    }

    return this._serverCache[name]
  }

  /**
   * Fetch a workflow from YouTrack and save it to the project
   * @param name Workflow name
   * @throws {WorkflowNotFoundError} If the workflow could not be fetched
   */
  public async downloadYoutrackWorkflow(name: string) {
    const data = await this.cacheYoutrackWorkflow(name)
    if (!data) {
      throw new WorkflowNotFoundError(name)
    }
    const { files, ...rest } = data
    await writeLocalWorkflowFiles(files, name)
    this._workflows[name] = rest
  }

  /**
   * Get the status of a workflow
   * @param name Workflow name
   * @returns Workflow status
   */
  public async workflowStatus(name: string): Promise<WorkflowStatus> {
    const workflow = this._workflows[name]
    const serverCache = await this.cacheYoutrackWorkflow(name)
    const localCache = await this.cacheLocalWorkflow(name)
    
    if (!workflow || (localCache?.hash === serverCache?.hash && localCache?.hash !== workflow.hash)) {
      this._workflows[name] = {
        hash: localCache?.hash || serverCache?.hash || '',
        fileHashes: localCache?.fileHashes || serverCache?.fileHashes || {}
      }
      this.updateLockFile()
    }
    
    switch (true) {
      case workflow === undefined:
        return WORKFLOW_STATUS.UNKNOWN
      case localCache === undefined:
        return WORKFLOW_STATUS.MISSING
      case serverCache === undefined:
        return WORKFLOW_STATUS.NEW
      case workflow.hash !== localCache?.hash &&
        workflow.hash !== serverCache?.hash &&
        localCache?.hash !== serverCache?.hash:
        return WORKFLOW_STATUS.CONFLICT
      case workflow.hash !== localCache?.hash:
        return WORKFLOW_STATUS.MODIFIED
      case workflow.hash !== serverCache?.hash:
        return WORKFLOW_STATUS.OUTDATED
      default:
        return WORKFLOW_STATUS.SYNCED
    }
  }

  /**
   * Get file-level status for a workflow
   * @param name Workflow name
   * @returns Record of filename to status mapping
   */
  public async getWorkflowFileStatus(name: string): Promise<Record<string, WorkflowStatus>> {
    const workflowLockData = this._workflows[name]
    // Get server and local caches
    const serverCache = await this.cacheYoutrackWorkflow(name)
    const localCache = await this.cacheLocalWorkflow(name)

    if (!localCache && !serverCache) {
      return {}
    }

    if (!workflowLockData || (localCache?.hash === serverCache?.hash && localCache?.hash !== workflowLockData.hash)) {
      this._workflows[name] = {
        hash: localCache?.hash || serverCache?.hash || '',
        fileHashes: localCache?.fileHashes || serverCache?.fileHashes || {}
      }
      this.updateLockFile()
    }

    const results: Record<string, WorkflowStatus> = {}
    const storedFileHashes = workflowLockData.fileHashes || {}
    
    // Process local files first
    if (localCache) {
      for (const [fileName, fileHash] of Object.entries(localCache.fileHashes)) {
        const storedHash = storedFileHashes[fileName]
        const serverHash = serverCache?.fileHashes[fileName]

        if (!storedHash) {
          // New local file
          results[fileName] = WORKFLOW_STATUS.NEW
        } else if (!serverHash) {
          // File exists locally but not on server
          results[fileName] = WORKFLOW_STATUS.NEW
        } else if (storedHash !== fileHash && storedHash !== serverHash && fileHash !== serverHash) {
          // Conflict: all three hashes are different
          results[fileName] = WORKFLOW_STATUS.CONFLICT
        } else if (storedHash !== fileHash) {
          // Local file modified
          results[fileName] = WORKFLOW_STATUS.MODIFIED
        } else if (storedHash !== serverHash) {
          // Server file modified
          results[fileName] = WORKFLOW_STATUS.OUTDATED
        } else {
          // File in sync
          results[fileName] = WORKFLOW_STATUS.SYNCED
        }
      }
    }

    // Process server files that might not exist locally
    if (serverCache) {
      for (const fileName of Object.keys(serverCache.fileHashes)) {
        if (results[fileName] === undefined) {
          // File exists on server but not locally
          results[fileName] = WORKFLOW_STATUS.MISSING
        }
      }
    }

    return results
  }

  /**
   * Check the status of all workflows in the project
   * @returns Record of workflow name to status mapping
   */
  public async checkWorkflowStatuses(workflows?: string[]): Promise<Record<string, WorkflowStatus>> {
    const statuses: Record<string, WorkflowStatus> = {}
    const _workflows = workflows || await this.projectWorkflows()

    for (const workflow of _workflows) {
      try {
        statuses[workflow] = await this.workflowStatus(workflow)
      } catch (error) {
        statuses[workflow] = WORKFLOW_STATUS.UNKNOWN
      }
    }

    return statuses
  }

  /**
   * Add a workflow to the project
   * @param name Workflow name
   * @param skipDownload Skip downloading workflow files from YouTrack
   * @returns Action result
   */
  public async addWorkflow(workflow: string): Promise<ActionResult> {
    if (isLocalWorkflow(workflow)) {
      return {
        success: false,
        skipped: true,
        message: "Workflow is already added"
      }
    }

    try {
      const data = await this.cacheYoutrackWorkflow(workflow)
      if (!data) {
        return {
          success: false,
          skipped: true,
          message: "Workflow is not found"
        }
      }
      
      const { files, ...rest } = data
      await writeLocalWorkflowFiles(files, workflow)
      this._workflows[workflow] = rest
      
      // Update lock file with the changed workflows list
      this.updateLockFile()

      return {
        success: true,
        skipped: false,
        message: `${COLORS.FG.GREEN}Added${COLORS.RESET}`
      }
    } catch (error) {
      return {
        success: false,
        skipped: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: "Failed to add workflow"
      }
    }
  }

  /**
   * Remove workflows from the project
   * @param workflows Array of workflow names to remove
   * @returns Results for each workflow processed
   */
  public async removeWorkflows(workflows: string[]): Promise<Record<string, ActionResult>> {
    const results: Record<string, ActionResult> = {}

    for (const workflow of workflows) {
      results[workflow] = await this.removeWorkflow(workflow)
    }

    return results
  }

  /**
   * Remove a workflow from the project
   * @param name Workflow name
   * @returns Action result
   */
  public async removeWorkflow(name: string): Promise<ActionResult> {
    try {
      if (!isLocalWorkflow(name)) {
        return {
          success: false,
          skipped: true,
          message: "Workflow is not in project",
        }
      }

      await deleteLocalWorkflowFiles(name)

      // Remove from lock file
      delete this._workflows[name]
      writeLockFile({ workflows: this._workflows })

      return {
        success: true,
        skipped: false,
        message: "Removed from project",
      }
    } catch (error) {
      return {
        success: false,
        skipped: false,
        error: error as Error,
        message: `Failed to remove workflow ${name}: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Get workflow file hashes
   * @param workflowName Workflow name
   * @returns Record of file hashes or empty object if not found
   */
  public async getWorkflowFileHashes(workflowName: string): Promise<Record<string, string>> {
    const workflowData = this._workflows[workflowName]
    return workflowData?.fileHashes || {}
  }

  /**
   * Get a list of available workflows in YouTrack
   * @returns Array of workflow names
   */
  public async notAddedWorkflows(): Promise<string[]> {
    const serverWorkflows = await this.youtrack.fetchWorkflows()
    return serverWorkflows.filter((w) => !isManifestExists(w))
  }
}
