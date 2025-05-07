import * as path from "node:path"
import { type FSWatcher, watch } from "chokidar"
import debounce from "debounce"
import type { ProjectService } from "./project.service"
import { WORKFLOW_STATUS } from "../consts"
import { printItemStatus } from "../utils"
import { PROGRESS_STATUS } from "../consts"
import type { SyncStrategy } from "../types"

/**
 * Options for file watcher
 */
export interface FileWatcherOptions {
  /** Force strategy for conflict resolution */
  forceStrategy?: SyncStrategy
  /** Debounce time in milliseconds */
  debounceMs?: number
}

/**
 * File watcher service for monitoring file changes
 */
export class FileWatcher {
  private watcher?: FSWatcher
  private pendingWorkflows: Set<string> = new Set()
  private options: Required<FileWatcherOptions>
  private projectService: ProjectService

  /**
   * Create a new file watcher
   * @param projectService Project service instance
   * @param options File watcher options
   */
  constructor(
    projectService: ProjectService,
    options: FileWatcherOptions = {},
  ) {
    this.projectService = projectService
    this.options = {
      forceStrategy: options.forceStrategy || "auto",
      debounceMs: options.debounceMs || 1000,
    }
  }

  /**
   * Start watching for file changes
   * @param baseDir Base directory to watch
   * @param workflows List of workflows to watch (all if empty)
   */
  public watch(baseDir: string, workflows: string[] = []): void {
    // Create a pattern to match workflow files
    const workflowPaths = workflows.length 
      ? workflows.map(w => path.join(baseDir, w, "**"))
      : [path.join(baseDir, "**")]

    // Create and configure the watcher
    this.watcher = watch(workflowPaths, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true,
    })

    // Setup event handlers
    this.setupEventHandlers()
  }

  /**
   * Stop watching for file changes
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
    }
  }

  /**
   * Setup event handlers for file changes
   */
  private setupEventHandlers(): void {
    if (!this.watcher) return

    // Get workflow name from file path
    const getWorkflowName = (filePath: string): string => {
      const relativePath = path.relative(process.cwd(), filePath)
      // Extract the workflow name (first directory in the path)
      return relativePath.split(path.sep)[0]
    }

    // Handle all file events (add, change, unlink)
    const handleFileEvent = debounce(async (filePath: string) => {
      const workflow = getWorkflowName(filePath)
      
      if (!workflow || this.pendingWorkflows.has(workflow)) return
      
      try {
        this.pendingWorkflows.add(workflow)
        
        console.log(`\nDetected changes in workflow: ${workflow}`)
        
        // Get workflow status
        const status = await this.projectService.workflowStatus(workflow)
        
        // Handle based on status
        switch (status) {
          case WORKFLOW_STATUS.MODIFIED:
            console.log("Pushing changes to YouTrack...")
            await this.projectService.uploadWorkflow(workflow)
            printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully pushed to YouTrack")
            break
            
          case WORKFLOW_STATUS.OUTDATED:
            console.log("Pulling changes from YouTrack...")
            await this.projectService.downloadYoutrackWorkflow(workflow)
            printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully pulled from YouTrack")
            break
            
          case WORKFLOW_STATUS.CONFLICT:
            await this.resolveConflict(workflow)
            break
            
          default:
            printItemStatus(workflow, PROGRESS_STATUS.WARNING, `Unexpected status: ${status}`)
        }
      } catch (error) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, (error as Error).message)
      } finally {
        this.pendingWorkflows.delete(workflow)
      }
    }, this.options.debounceMs)

    // Set up watchers for different file events
    this.watcher
      .on("add", handleFileEvent)
      .on("change", handleFileEvent)
      .on("unlink", handleFileEvent)
  }

  /**
   * Resolve conflict for a workflow
   * @param workflow Workflow name
   */
  private async resolveConflict(workflow: string): Promise<void> {
    const strategy = this.options.forceStrategy
    
    console.log(`Conflict detected in workflow: ${workflow}`)
    
    if (strategy === "auto") {
      // Auto strategy tries to merge changes
      console.log("Attempting to merge changes...")
      
      try {
        // First pull to get latest changes
        await this.projectService.downloadYoutrackWorkflow(workflow)
        // Then push our changes
        await this.projectService.uploadWorkflow(workflow)
        printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully merged and pushed changes")
      } catch (error) {
        printItemStatus(workflow, PROGRESS_STATUS.FAILED, `Failed to merge: ${(error as Error).message}`)
      }
    } else if (strategy === "pull") {
      // Pull strategy overwrites local changes
      console.log("Using pull strategy (overwriting local changes)")
      await this.projectService.downloadYoutrackWorkflow(workflow)
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully pulled from YouTrack (local changes overwritten)")
    } else if (strategy === "push") {
      // Push strategy overwrites server changes
      console.log("Using push strategy (overwriting server changes)")
      await this.projectService.uploadWorkflow(workflow)
      printItemStatus(workflow, PROGRESS_STATUS.SUCCESS, "Successfully pushed to YouTrack (server changes overwritten)")
    } else {
      printItemStatus(workflow, PROGRESS_STATUS.WARNING, "No conflict resolution strategy specified")
    }
  }
}
