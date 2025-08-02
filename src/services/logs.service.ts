import type { YoutrackService } from "./youtrack"
import type { RuleLog } from "../types"
import { tryCatch } from "../utils"

export type WorkflowRule = {
  workflowId: string
  ruleId: string
  workflowName: string
  ruleName: string
}

export interface WorkflowRuleLogs {
  [workflowId: string]: {
    rules: {
      [ruleId: string]: {
        logs: RuleLog[]
        lastTimestamp: number
      }
    }
  }
}

/**
 * Service to manage YouTrack workflow logs
 */
export class LogService {
  private _logsCache: WorkflowRuleLogs = {}
  private _watchIntervals = new Map<string, NodeJS.Timeout>()

  constructor(private youtrackService: YoutrackService) {}

  private async fetchWorkflowRuleLogs(rule: WorkflowRule, top = -1): Promise<RuleLog[]> {
    // Get last timestamp from cache or use 0 to fetch all logs
    const rulesCache = this._logsCache[rule.workflowId]?.rules
    const lastTimestamp = rulesCache?.[rule.ruleId]?.lastTimestamp || 0

    // Fetch logs
    const logs = await this.youtrackService.getWorkflowLogs(rule.workflowId, rule.ruleId, lastTimestamp + 1, top)

    // If there are new logs, update cache
    if (logs.length > 0) {
      // Get the last timestamp
      const newestTimestamp = logs[logs.length - 1]?.timestamp || 0

      // Initialize rule cache if it doesn't exist
      if (!rulesCache[rule.ruleId]) {
        rulesCache[rule.ruleId] = {
          logs: [],
          lastTimestamp: 0,
        }
      }

      // Update cache
      rulesCache[rule.ruleId].logs.push(...logs)
      rulesCache[rule.ruleId].lastTimestamp = newestTimestamp
    }

    // Return logs
    return logs
  }

  /**
   * Fetch workflow logs
   * @param workflowRule Workflow rule
   * @param top Number of logs to fetch (if -1, fetch all)
   * @returns Logs for the workflow grouped by rule
   */
  public async fetchWorkflowRulesLogs(
    workflowRule: WorkflowRule[],
    top = -1,
  ): Promise<Array<WorkflowRule & { logs: RuleLog[] }>> {
    const result: (WorkflowRule & { logs: RuleLog[] })[] = []

    // Fetch logs for each rule
    for (const rule of workflowRule) {
      // Initialize cache for this workflow if it doesn't exist
      if (!this._logsCache[rule.workflowId]) {
        this._logsCache[rule.workflowId] = { rules: {} }
      }
      if (!rule?.ruleId) continue

      const logs = await this.fetchWorkflowRuleLogs(rule, top)

      // Add logs to result
      result.push({ ...rule, logs })
    }

    return result
  }

  /**
   * Start watching logs for workflows
   * @param workflowNames Workflow names to watch
   * @param interval Interval in milliseconds (default: 5000)
   * @param onNewLogs Callback function when new logs are received
   */
  public async startWatchingLogs(
    workflowRule: WorkflowRule[],
    onNewLogs: (workflowName: string, ruleName: string, logs: RuleLog[]) => void,
    onError: (workflowName: string, ruleName: string, message: string) => void,
    interval = 5000,
  ): Promise<void> {
    // Stop existing watches
    this.stopWatchingLogs()

    for (const { workflowId, ruleId, workflowName, ruleName } of workflowRule) {
      // Create unique key for this workflow rule combination
      const watchKey = `${workflowName}:${ruleName}`

      // Set up interval for this workflow rule
      const intervalId = setInterval(async () => {
        const [logs, error] = await tryCatch(this.fetchWorkflowRuleLogs({ workflowId, ruleId, workflowName, ruleName }))
        if (error) {
          onError(workflowName, ruleName, error.message)
          clearInterval(this._watchIntervals.get(watchKey) as NodeJS.Timeout)
          this._watchIntervals.delete(watchKey)
        } else {
          // Only call onNewLogs if there are actually new logs to prevent empty outputs
          if (logs.length > 0) {
            onNewLogs(workflowName, ruleName, logs)
          }
        }
      }, interval)

      this._watchIntervals.set(watchKey, intervalId)
    }
  }

  /**
   * Stop watching logs for all workflows
   */
  public stopWatchingLogs(): void {
    for (const intervalId of this._watchIntervals.values()) {
      clearInterval(intervalId)
    }
    this._watchIntervals.clear()
  }
}
