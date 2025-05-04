import * as path from "node:path"
import { promises as fs } from "node:fs"

import { readPackageJson, readWorkflowFiles, writePackageJson, writeWorkflowFiles } from "../tools/fs.tools"
import type { WorkflowFile, WorkflowStatus } from "../types"
import type { YoutrackService } from "./youtrack.service"
import { filesHash } from "../tools/hash.tools"
import { WORKFLOW_STATUS, COLORS } from "../consts"
import { 
  FileOperationError, 
  WorkflowNotFoundError, 
  WorkflowNotInProjectError 
} from "../errors"

type WorkflowCache = {
  name: string
  originalHash: string
}

type WorkflowDataCache = {
  files: WorkflowFile[]
  hash: string
}

export type ActionResult = {
  success: boolean
  skipped: boolean
  error?: Error
  message: string
}

export class ProjectService {
  private _workflows: WorkflowCache[] = []
  private _serverCache: Record<string, WorkflowDataCache | null> = {}
  private _localCache: Record<string, WorkflowDataCache | null> = {}
  private _pkgPath: string

  constructor(private readonly youtrack: YoutrackService) {
    this._pkgPath = path.resolve(process.cwd(), "package.json")
    const data = readPackageJson(this.pkgPath)
    this._workflows = Object.keys(data.workflows || {}).map((name) => ({ name, originalHash: data.workflows[name] }))
  }

  get pkgPath() {
    return this._pkgPath
  }

  get workflows() {
    return this._workflows
  }

  public isProjectWorkflow(name: string): boolean {
    return this.workflows.some((w) => w.name === name)
  }

  /**
   * Set the original hash of a workflow
   * @param name Workflow name
   * @param hash Original hash of the workflow
   */
  public setWorkflowHash(name: string, hash: string) {
    const workflow = this._workflows.find((w) => w.name === name)
    if (!workflow) {
      this._workflows.push({ name, originalHash: hash })
      return
    }
    workflow.originalHash = hash
  }

  /**
   * Save workflows to package.json
   * @param workflows Workflows to save
   */
  public updatePackageJson(workflows?: Record<string, string>) {
    const pkg = readPackageJson(this.pkgPath)

    if (!workflows) {
      pkg.workflows = this._workflows.reduce(
        (acc, w) => {
          acc[w.name] = w.originalHash
          return acc
        },
        {} as Record<string, string>,
      )
    } else {
      pkg.workflows = workflows
    }

    writePackageJson(this.pkgPath, pkg)
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
      const files = await readWorkflowFiles(path.join(process.cwd(), name))
      this._localCache[name] = {
        files,
        hash: filesHash(files),
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
    if (!this.isProjectWorkflow(name)) {
      throw new WorkflowNotInProjectError(name)
    }

    const localCache = await this.cacheLocalWorkflow(name)
    if (!localCache) {
      throw new WorkflowNotFoundError(name)
    }

    await this.youtrack.uploadWorkflow(localCache.files)
    const serverCache = await this.cacheYoutrackWorkflow(name)
    if (serverCache) {
      this.setWorkflowHash(name, serverCache.hash)
      this.updatePackageJson()
    }
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
      const files = await this.youtrack.fetchWorkflow(name)
      if (!files) {
        this._serverCache[name] = null
      } else {
        this._serverCache[name] = {
          files,
          hash: filesHash(files),
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
    await writeWorkflowFiles(data.files, path.join(process.cwd(), name))
    this.setWorkflowHash(name, data.hash)
  }

  /**
   * Get the status of a workflow
   * @param name Workflow name
   * @returns Workflow status
   */
  public async workflowStatus(name: string): Promise<WorkflowStatus> {
    const workflow = this._workflows.find((w) => w.name === name)
    const serverCache = await this.cacheYoutrackWorkflow(name)
    const localCache = await this.cacheLocalWorkflow(name)

    switch (true) {
      case !workflow:
        return WORKFLOW_STATUS.UNKNOWN
      case !localCache:
        return WORKFLOW_STATUS.MISSING
      case !serverCache:
        return WORKFLOW_STATUS.NEW
      case workflow?.originalHash !== localCache?.hash &&
        workflow?.originalHash !== serverCache?.hash &&
        localCache?.hash !== serverCache?.hash:
        return WORKFLOW_STATUS.CONFLICT
      case workflow?.originalHash !== localCache?.hash:
        return WORKFLOW_STATUS.MODIFIED
      case workflow?.originalHash !== serverCache?.hash:
        return WORKFLOW_STATUS.OUTDATED
      default:
        return WORKFLOW_STATUS.SYNCED
    }
  }

  /**
   * Check the status of all workflows in the project
   * @returns Object containing workflow names and their statuses
   */
  public async checkStatus(): Promise<Record<string, WorkflowStatus>> {
    const results: Record<string, WorkflowStatus> = {}
    for (const workflow of this.workflows) {
      const status = await this.workflowStatus(workflow.name)
      results[workflow.name] = status
    }
    return results
  }

  /**
   * Get a list of available workflows in YouTrack
   * @returns Array of workflow names
   */
  public async availableWorkflows(): Promise<string[]> {
    const workflows = await this.youtrack.fetchWorkflows()
    return workflows.filter((w) => !this.isProjectWorkflow(w))
  }

  /**
   * Add new workflows to the project
   * @param workflows Array of workflow names to add
   * @returns Results for each workflow processed
   */
  public async addWorkflows(workflows: string[]): Promise<Record<string, ActionResult>> {
    const results: Record<string, ActionResult> = {}

    for (const workflow of workflows) {
      results[workflow] = await this.addWorkflow(workflow)
    }

    return results
  }

  /**
   * Add a single workflow to the project
   * @param workflow Workflow name to add
   * @returns Result of the workflow processing
   */
  public async addWorkflow(workflow: string): Promise<ActionResult> {
    if (this.isProjectWorkflow(workflow)) {
      return {
        success: false,
        skipped: true,
        message: "Workflow already exists in the project"
      }
    }

    try {
      const data = await this.cacheYoutrackWorkflow(workflow)
      if (!data) {
        return {
          success: false,
          skipped: true,
          message: "Cannot fetch workflow"
        }
      }
      
      await writeWorkflowFiles(data.files, path.join(process.cwd(), workflow))
      this.setWorkflowHash(workflow, data.hash)
      
      // Update package.json with the changed workflows list
      this.updatePackageJson()
      
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
   * @param deleteFiles Whether to delete workflow files from disk
   * @returns Results for each workflow processed
   */
  public async removeWorkflows(workflows: string[], deleteFiles = false): Promise<Record<string, ActionResult>> {
    const results: Record<string, ActionResult> = {}

    for (const workflow of workflows) {
      results[workflow] = await this.removeWorkflow(workflow, deleteFiles)
    }

    return results
  }

  /**
   * Remove a workflow from the project
   * @param workflow Workflow name
   * @param deleteFiles Whether to also delete the workflow files
   * @returns Operation result
   */
  public async removeWorkflow(workflow: string, deleteFiles = false): Promise<ActionResult> {
    // Verify workflow exists
    const workflowInfo = this._workflows.find((w) => w.name === workflow)
    if (!workflowInfo) {
      return {
        success: false,
        skipped: true,
        message: "Workflow not found in project"
      }
    }

    // Remove workflow from the internal list
    this._workflows = this._workflows.filter((w) => w.name !== workflow)

    // Clear cached data if present
    if (this._localCache[workflow]) {
      this._localCache[workflow] = null
    }

    if (this._serverCache[workflow]) {
      this._serverCache[workflow] = null
    }

    // Update package.json with the changed workflows list
    this.updatePackageJson()

    // Base result if we're not deleting files
    if (!deleteFiles) {
      return {
        success: true,
        skipped: false,
        message: `${COLORS.FG.RED}Removed${COLORS.RESET}`
      }
    }

    // Optionally delete the workflow files
    const workflowPath = path.join(process.cwd(), workflow)
    try {
      await fs.rm(workflowPath, { recursive: true, force: true })
      return {
        success: true,
        skipped: false,
        message: `${COLORS.FG.RED}Removed${COLORS.RESET}`
      }
    } catch (error) {
      const fileError = new FileOperationError(
        "Failed to delete workflow directory",
        workflowPath,
        error instanceof Error ? error : undefined
      )
      
      return {
        success: false,
        skipped: false,
        error: fileError,
        message: fileError.message
      }
    }
  }
}
