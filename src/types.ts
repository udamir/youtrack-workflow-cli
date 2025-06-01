import type { PROGRESS_STATUS, WORKFLOW_STATUS, SYNC_TYPE, SYNC_STATUS, WATCH_EVENT } from "./consts"

/**
 * Linting configuration options
 */
export interface LintingConfig {
  /** Whether to enable ESLint validation */
  enableEslint: boolean
  /** Whether to enable TypeScript type checking */
  enableTypeCheck: boolean
  /** Maximum number of warnings allowed before failing */
  maxWarnings: number
}

/**
 * Package.json configuration for ytw
 */
export interface YtwConfig {
  /** Linting configuration */
  linting?: Partial<LintingConfig>
}

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

export type SyncType = (typeof SYNC_TYPE)[keyof typeof SYNC_TYPE]
export type WatchEvent = (typeof WATCH_EVENT)[keyof typeof WATCH_EVENT]
export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS]

export type ActionResult = {
  status: "success" | "error" | "skipped"
  message: string
}

/**
 * Linting result for a file
 */
export interface LintingResult {
  /** Array of error messages */
  errors: string[]
  /** Array of warning messages */
  warnings: string[]
}
