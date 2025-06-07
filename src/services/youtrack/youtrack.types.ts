/**
 * YouTrack workflow entity type
 */
export type WorkflowEntity = {
  id: string
  name: string
  rules: WorkflowRuleEntity[]
}

export type ProjectEntity = {
  id: string
  name: string
  shortName: string
}

export type CustomFieldEntity = {
  id: string
  bundle: {
    id: string
  }
  field: {
    name: string
    fieldType: {
      isMultiValue: boolean
      isBundleType: boolean
      valueType: string
    }
  }
  canBeEmpty: boolean
}

export type CustomFieldBundleEntity = {
  id: string
  name: string
}

export type WorkflowItemEntity = {
  id: string
  name: string
}

export interface RuleLog {
  id: string
  level: string
  message: string
  presentation: string
  stacktrace: string
  timestamp: number
  username: string
}

export interface WorkflowRuleEntity {
  $type: string
  id: string
  name: string
  title: string | null
}

export type CustomFieldInfo = {
  name: string
  type: string
  canBeEmpty: boolean
  isBundleType: boolean
  isMultiValue: boolean
  values?: string[]
}
