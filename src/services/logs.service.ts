import type { YoutrackService } from "./youtrack"
import type { RuleLog } from "../types"

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
  
  constructor(
    private youtrackService: YoutrackService
  ) {}

  /**
   * Fetch workflow logs
   * @param workflowRule Workflow rule
   * @param top Number of logs to fetch (if -1, fetch all)
   * @returns Logs for the workflow grouped by rule
   */
  public async fetchWorkflowRuleLogs(workflowRule: WorkflowRule[], top = -1): Promise<Array<WorkflowRule & { logs: RuleLog[] }>> {
    const result: (WorkflowRule & { logs: RuleLog[] })[] = []
    
    // Fetch logs for each rule
    for (const rule of workflowRule) {
      // Initialize cache for this workflow if it doesn't exist
      if (!this._logsCache[rule.workflowId]) {
        this._logsCache[rule.workflowId] = { rules: {} }
      }
      if (!rule?.ruleId) continue
      
      // Get last timestamp from cache or use 0 to fetch all logs
      const lastTimestamp = this._logsCache[rule.workflowId]?.rules[rule.ruleId]?.lastTimestamp || 0
      
      // Fetch logs
      const logs = await this.youtrackService.getWorkflowLogs(rule.workflowId, rule.ruleId, lastTimestamp)
      
      // If there are new logs, update cache
      if (logs.length > 0) {
        // Sort logs by timestamp (newest first)
        logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        
        // Get the last timestamp
        const newestTimestamp = logs[0]?.timestamp || 0
        
        // Initialize rule cache if it doesn't exist
        if (!this._logsCache[rule.workflowId].rules[rule.ruleId]) {
          this._logsCache[rule.workflowId].rules[rule.ruleId] = {
            logs: [],
            lastTimestamp: 0
          }
        }
        
        // Update cache
        this._logsCache[rule.workflowId].rules[rule.ruleId].logs = logs
        this._logsCache[rule.workflowId].rules[rule.ruleId].lastTimestamp = newestTimestamp
      }
      
      // Add logs to result
      result.push({...rule, logs: logs.length > top ? logs.slice(0, top) : logs})
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
    interval = 5000
  ): Promise<void> {
    // Stop existing watches
    this.stopWatchingLogs()
    
    for (const { workflowId, ruleId, workflowName } of workflowRule) {
      
      // Set up interval for this workflow
      const intervalId = setInterval(async () => {
        try {
          if (!workflowId || !ruleId) return
          
          // Get workflow details to get rules
          const workflows = await this.youtrackService.fetchWorkflows()
          const workflowDetails = workflows.find(w => w.id === workflowId)
          
          if (!workflowDetails || !workflowDetails.rules || workflowDetails.rules.length === 0) return
          
          for (const rule of workflowDetails.rules) {
            if (!rule.id) continue
            
            // Get last timestamp from cache
            const lastTimestamp = this._logsCache[workflowId]?.rules[rule.id]?.lastTimestamp || 0
            
            // Fetch new logs
            const logs = await this.youtrackService.getWorkflowLogs(workflowId, rule.id, lastTimestamp)
            
            // If there are new logs, update cache and notify
            if (logs.length > 0) {
              // Sort logs by timestamp (newest first)
              logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              
              // Get the last timestamp
              const newestTimestamp = logs[0]?.timestamp || 0
              
              // Update cache
              if (this._logsCache[workflowId]?.rules[rule.id]) {
                this._logsCache[workflowId].rules[rule.id].logs = [
                  ...logs,
                  ...this._logsCache[workflowId].rules[rule.id].logs
                ]
                this._logsCache[workflowId].rules[rule.id].lastTimestamp = newestTimestamp
              }
              
              // Notify
              onNewLogs(workflowName, rule.name, logs)
            }
          }
        } catch (error) {
          console.error(`Error watching logs for workflow "${workflowName}":`, error)
        }
      }, interval)
      
      this._watchIntervals.set(workflowName, intervalId)
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
