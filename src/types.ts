import type { WORKFLOW_STATUS } from "./consts"

export type WorkflowStatus = (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS]

export type WorkflowFile = {
  name: string
  file: Buffer
}

export type PackageJson = {
  [key: string]: unknown
  workflows: Record<string, string>
}
