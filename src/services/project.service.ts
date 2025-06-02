import {
  readLocalWorkflowFiles,
  writeLocalWorkflowFiles,
  readLockFile,
  writeLockFile,
  isLocalWorkflow,
  deleteLocalWorkflowFiles,
  isManifestExists,
} from "../tools/fs.tools"
import type { WorkflowFile, WorkflowStatus, WorkflowHash, SyncType, SyncStatus, ActionResult } from "../types"
import { WorkflowNotFoundError, WorkflowNotInProjectError } from "../errors"
import type { WorkflowEntity, YoutrackService } from "./youtrack.service"
import { errorStatus, skippedStatus, successStatus } from "../utils"
import { WORKFLOW_STATUS, SYNC_STATUS, SYNC_TYPE } from "../consts"
import { calculateWorkflowHash } from "../tools/hash.tools"

type WorkflowDataCache = {
  files: WorkflowFile[]
  hash: string
  fileHashes: Record<string, string>
}

export class ProjectService {
  private _lockData: Record<string, WorkflowHash> = {}
  private _serverCache: Record<string, WorkflowDataCache | null> = {}
  private _localCache: Record<string, WorkflowDataCache | null> = {}

  constructor(private readonly youtrack: YoutrackService) {
    const data = readLockFile()
    this._lockData = data?.workflows || {}
  }

  /**
   * Save workflows to lock file
   * @param workflowHashMap Workflows to save
   */
  public updateLockFile(workflowHashMap?: Record<string, WorkflowHash>) {
    const pkg = readLockFile()

    pkg.workflows = workflowHashMap || this._lockData

    writeLockFile(pkg)
  }

  /**
   * Get a list of workflows in the project
   * @returns Array of workflow entities
   */
  public async projectWorkflows(filter: string[] = []): Promise<WorkflowEntity[]> {
    const serverWorkflows = await this.youtrack.fetchWorkflows()
    return serverWorkflows.filter(({ name }) => isManifestExists(name) && (!filter.length || filter.includes(name)))
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
        fileHashes: files,
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
  public async uploadWorkflow(name: string, clearLocalCache = false) {
    if (!isLocalWorkflow(name)) {
      throw new WorkflowNotInProjectError(name)
    }

    if (clearLocalCache) {
      delete this._localCache[name]
    }

    const localCache = await this.cacheLocalWorkflow(name)
    if (!localCache) {
      throw new WorkflowNotFoundError(name)
    }
    const { files, ...rest } = localCache
    await this.youtrack.uploadWorkflow(name, files)

    // Update lock file with local data
    this._lockData[name] = rest
    this.updateLockFile()

    // Update server cache with the local data so it matches what was uploaded
    this._serverCache[name] = localCache
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
          fileHashes: files,
        }
      }
    } catch (error) {
      this._serverCache[name] = null
    }

    return this._serverCache[name]
  }

  /**
   * Synchronize workflows between local files and YouTrack
   * @param workflows Array of workflow names to synchronize
   * @param onConflict Callback function to handle conflict events
   * @param onSync Callback function to handle sync events
   */
  public async syncWorkflows(
    workflows: string[],
    onConflict?: (workflow: string) => Promise<SyncType>,
    onSync?: (workflow: string, syncStatus: SyncStatus, index: number) => void,
    preUploadCheck?: (workflow: string) => Promise<boolean>,
  ) {
    let index = 0

    const getSyncType = async (workflow: string, workflowStatus: WorkflowStatus) => {
      switch (workflowStatus) {
        case WORKFLOW_STATUS.CONFLICT:
          return (await onConflict?.(workflow)) || SYNC_TYPE.SKIP
        case WORKFLOW_STATUS.MODIFIED:
        case WORKFLOW_STATUS.NEW:
          return SYNC_TYPE.PUSH
        case WORKFLOW_STATUS.OUTDATED:
          return SYNC_TYPE.PULL
        default:
          return SYNC_TYPE.SKIP
      }
    }

    for (const workflow of workflows) {
      let syncStatus: SyncStatus = SYNC_STATUS.SYNCED
      let syncType: SyncType
      try {
        const status = await this.workflowStatus(workflow)
        if (status !== WORKFLOW_STATUS.SYNCED) {
          syncType = await getSyncType(workflow, status)
          if (syncType === SYNC_TYPE.PUSH) {
            if (preUploadCheck) {
              const allowed = await preUploadCheck(workflow)
              if (!allowed) { continue }
            }
            await this.uploadWorkflow(workflow)
            syncStatus = SYNC_STATUS.PUSHED
          } else if (syncType === SYNC_TYPE.PULL) {
            await this.downloadYoutrackWorkflow(workflow)
            syncStatus = SYNC_STATUS.PULLED
          } else {
            syncStatus = SYNC_STATUS.SKIPPED
          }
        }
      } catch (error) {
        syncStatus = SYNC_STATUS.FAILED
      }
      onSync?.(workflow, syncStatus, index++)
    }
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

    // Update lock file with server data
    this._lockData[name] = rest
    this.updateLockFile()

    // Update local cache with server data so it matches what was downloaded
    this._localCache[name] = data
  }

  /**
   * Get the status of a workflow
   * @param name Workflow name
   * @returns Workflow status
   */
  public async workflowStatus(name: string): Promise<WorkflowStatus> {
    const lockData = this._lockData[name]
    const serverCache = await this.cacheYoutrackWorkflow(name)
    const localCache = await this.cacheLocalWorkflow(name)

    if (!lockData || (localCache?.hash === serverCache?.hash && localCache?.hash !== lockData.hash)) {
      this._lockData[name] = {
        hash: localCache?.hash || serverCache?.hash || "",
        fileHashes: localCache?.fileHashes || serverCache?.fileHashes || {},
      }
      this.updateLockFile()
    }

    switch (true) {
      case lockData === undefined:
        return WORKFLOW_STATUS.UNKNOWN
      case localCache === undefined:
        return WORKFLOW_STATUS.MISSING
      case serverCache === undefined:
        return WORKFLOW_STATUS.NEW
      case lockData.hash !== localCache?.hash &&
        lockData.hash !== serverCache?.hash &&
        localCache?.hash !== serverCache?.hash:
        return WORKFLOW_STATUS.CONFLICT
      case lockData.hash !== localCache?.hash:
        return WORKFLOW_STATUS.MODIFIED
      case lockData.hash !== serverCache?.hash:
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
    const workflowLockData = this._lockData[name]
    // Get server and local caches
    const serverCache = await this.cacheYoutrackWorkflow(name)
    const localCache = await this.cacheLocalWorkflow(name)

    if (!localCache && !serverCache) {
      return {}
    }

    if (!workflowLockData || (localCache?.hash === serverCache?.hash && localCache?.hash !== workflowLockData.hash)) {
      this._lockData[name] = {
        hash: localCache?.hash || serverCache?.hash || "",
        fileHashes: localCache?.fileHashes || serverCache?.fileHashes || {},
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
   * @param workflows Array of workflow names to check
   * @param onStatus Callback function to handle status events
   * @returns Record of workflow name to status mapping
   */
  public async checkWorkflowStatuses(
    workflows?: WorkflowEntity[],
    onStatus?: (workflow: string, status: WorkflowStatus, index: number) => void,
  ): Promise<Record<string, WorkflowStatus>> {
    const statuses: Record<string, WorkflowStatus> = {}
    const _workflows = workflows || (await this.projectWorkflows())
    let index = 0

    for (const { name } of _workflows) {
      try {
        statuses[name] = await this.workflowStatus(name)
      } catch (error) {
        statuses[name] = WORKFLOW_STATUS.UNKNOWN
      }
      onStatus?.(name, statuses[name], index++)
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
      return skippedStatus("Workflow is already added")
    }

    try {
      const data = await this.cacheYoutrackWorkflow(workflow)
      if (!data) {
        return skippedStatus("Workflow is not found")
      }

      const { files, ...rest } = data
      await writeLocalWorkflowFiles(files, workflow)
      this._lockData[workflow] = rest

      // Update lock file with the changed workflows list
      this.updateLockFile()

      return successStatus("Added")
    } catch (error) {
      return errorStatus(error instanceof Error ? error.message : String(error))
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
        return skippedStatus("Workflow is not in project")
      }

      await deleteLocalWorkflowFiles(name)

      // Remove from lock file
      delete this._lockData[name]
      writeLockFile({ workflows: this._lockData })

      return successStatus("Removed")
    } catch (error) {
      return errorStatus(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Get workflow file hashes
   * @param workflowName Workflow name
   * @returns Record of file hashes or empty object if not found
   */
  public async getWorkflowFileHashes(workflowName: string): Promise<Record<string, string>> {
    const workflowData = this._lockData[workflowName]
    return workflowData?.fileHashes || {}
  }

  /**
   * Get a list of available workflows in YouTrack
   * @returns Array of workflow names
   */
  public async notAddedWorkflows(): Promise<WorkflowEntity[]> {
    const serverWorkflows = await this.youtrack.fetchWorkflows()
    return serverWorkflows.filter(({ name }) => !isManifestExists(name))
  }

  /**
   * Clear local workflow cache
   * @param workflowName Workflow name
   */
  public clearLocalWorkflowCache(workflowName: string) {
    delete this._localCache[workflowName]
  }
}
