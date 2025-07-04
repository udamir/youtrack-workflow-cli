import { watch } from "chokidar"
import * as path from "node:path"

import type { ProjectService } from "./project.service"
import type { SyncStatus, WatchEvent } from "../types"
import { SYNC_STATUS, WATCH_EVENT } from "../consts"

// Define event handlers for the watch service
export interface WatchEventHandlers {
  /**
   * Handler for file changes (add, modify, delete)
   * @param workflowName Workflow name
   * @param filename File name
   * @param eventType Type of event
   * @returns Error message if there is an error, undefined otherwise
   */
  onFileChange?: (workflowName: string, filename: string, eventType: WatchEvent) => Promise<boolean>

  /**
   * Handler for sync results
   * @param workflowName Workflow name
   * @param status Sync status
   * @param message Optional message
   */
  onSyncResult?: (workflowName: string, status: SyncStatus, message?: string) => Promise<void>
}

export class WatchService {
  private syncing = false
  private debounced: NodeJS.Timeout | null = null

  constructor(
    private projectService: ProjectService,
    private eventHandlers: WatchEventHandlers = {},
  ) {}

  /**
   * Start watching for workflow file changes
   * @param workflows Array of workflow paths to watch
   * @returns
   */
  public async startWatching(workflows: string[]): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (!workflows.length) {
        reject(new Error("No workflows to watch"))
      }

      // Create and configure the watcher
      const watcher = watch(workflows, {
        persistent: true,
        ignoreInitial: true,
        usePolling: true, // Try with and without polling to see which works better
        interval: 500, // Polling interval
        awaitWriteFinish: {
          // Wait for files to be fully written
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      })

      watcher
        .on("add", (filePath: string) =>
          this.handleFileChange(path.dirname(filePath), path.basename(filePath), WATCH_EVENT.ADD),
        )
        .on("change", (filePath: string) =>
          this.handleFileChange(path.dirname(filePath), path.basename(filePath), WATCH_EVENT.CHANGE),
        )
        .on("unlink", (filePath: string) =>
          this.handleFileChange(path.dirname(filePath), path.basename(filePath), WATCH_EVENT.UNLINK),
        )
        .on("ready", () =>
          resolve(() => {
            watcher.close()
            this.debounced && clearTimeout(this.debounced)
          }),
        )
        .on("error", reject)
    })
  }

  /**
   * Handle file change events
   */
  private async handleFileChange(workflowName: string, filename: string, eventType: WatchEvent): Promise<void> {
    // Handle debouncing
    if (this.syncing && !this.debounced) {
      this.debounced = setTimeout(() => this.handleFileChange(workflowName, filename, eventType), 1000)
      return
    }
    this.syncing = true

    const success = await this.eventHandlers.onFileChange?.(workflowName, filename, eventType)
    if (!success) {
      await this.eventHandlers.onSyncResult?.(workflowName, SYNC_STATUS.FAILED, "Sync Failed")
      this.syncing = false
      return
    }

    try {
      await this.projectService.uploadWorkflow(workflowName, true)
      await this.eventHandlers.onSyncResult?.(workflowName, SYNC_STATUS.PUSHED, "Workflow uploaded successfully")
    } catch (error) {
      await this.eventHandlers.onSyncResult?.(
        workflowName,
        SYNC_STATUS.FAILED,
        error instanceof Error ? error.message : "Unknown error",
      )
    }

    this.syncing = false
    this.debounced && clearTimeout(this.debounced)
  }
}
