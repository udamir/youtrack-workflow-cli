import { watch } from "chokidar"
import * as path from "node:path"

import type { WatchEvent } from "../types"
import { WATCH_EVENT } from "../consts"

export const watchWorkflows = async (
  workflows: string[],
  onChange: (workflow: string, filename: string, eventType: WatchEvent) => void,
): Promise<() => void> => {
  return new Promise((resolve, reject) => {
    if (!workflows.length) {
      reject("No workflows to watch")
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
      .on("add", (filePath: string) => onChange(path.dirname(filePath), path.basename(filePath), WATCH_EVENT.ADD))
      .on("change", (filePath: string) => onChange(path.dirname(filePath), path.basename(filePath), WATCH_EVENT.CHANGE))
      .on("unlink", (filePath: string) => onChange(path.dirname(filePath), path.basename(filePath), WATCH_EVENT.UNLINK))
      .on("ready", () => resolve(() => watcher.close()))
      .on("error", reject)
  })
}
