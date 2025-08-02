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
  /** Array of workflow names to include in linting (if specified, only these workflows will be linted) */
  include?: string[]
  /** Array of workflow names to exclude from linting (these workflows will never be linted) */
  exclude?: string[]
}

/**
 * Package.json configuration for ytw
 */
export interface YtwConfig {
  /** Linting configuration */
  linting?: Partial<LintingConfig>
  /** Pre-push script to run before pushing workflows */
  prepush?: string
  /** Post-push script to run after pushing workflows */
  postpush?: string
  /** Folder path for TypeScript type definitions (default: "/types") */
  typesFolder?: string
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

/**
 * YouTrack workflow rule log entry
 */
export interface RuleLog {
  /** Log entry ID */
  id?: string
  /** Log level (INFO, ERROR, WARNING, DEBUG) */
  level?: string
  /** Log message */
  message?: string
  /** Formatted presentation of the log */
  presentation?: string
  /** Error stack trace if available */
  stacktrace?: string
  /** Timestamp in milliseconds */
  timestamp?: number
  /** Username who triggered the log */
  username?: string
}

/**
 * Configuration for project initialization
 */
export interface InitConfig {
  /** Name of the project */
  projectName: string
  /** YouTrack base URL */
  baseUrl: string
  /** YouTrack token */
  token: string
  /** Whether to configure TypeScript support */
  useTypeScript: boolean
}

/**
 * Project template structure
 */
export interface ProjectTemplate {
  /** .env file template */
  env: string
  /** ESLint configuration template */
  eslint: string
  /** TypeScript configuration template (optional) */
  tsconfig?: string
  /** package.json template */
  packageJson: string
}
