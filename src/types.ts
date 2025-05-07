import type { PROGRESS_STATUS, WORKFLOW_STATUS, SYNC_STRATEGY_AUTO, SYNC_STRATEGY_PULL, SYNC_STRATEGY_PUSH, SYNC_STRATEGY_SKIP } from "./consts"

/**
 * Workflow status
 */
export type WorkflowStatus = (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS]

/**
 * Status of a progress item
 */
export type ProgressStatus = (typeof PROGRESS_STATUS)[keyof typeof PROGRESS_STATUS]

/**
 * Workflow file
 */
export type WorkflowFile = {
  name: string
  file: Buffer
}

/**
 * Lock file data
 */
export type LockFileData = {
  workflows: Record<string, WorkflowHash>
}

/**
 * Workflow lock data
 */
export type WorkflowHash = {
  hash: string
  fileHashes: Record<string, string>
}

export type SyncStrategy = typeof SYNC_STRATEGY_AUTO | typeof SYNC_STRATEGY_PULL | typeof SYNC_STRATEGY_PUSH | typeof SYNC_STRATEGY_SKIP
