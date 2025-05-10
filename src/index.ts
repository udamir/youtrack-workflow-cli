import { Command } from "commander"
import * as dotenv from "dotenv"

import { removeCommand } from "./commands/remove.command"
import { statusCommand } from "./commands/status.command"
import { listCommand } from "./commands/list.command"
import { pullCommand } from "./commands/pull.command"
import { pushCommand } from "./commands/push.command"
import { addCommand } from "./commands/add.command"
import { syncCommand } from "./commands/sync.command"
import { SYNC_TYPE } from "./consts"

dotenv.config()

const program = new Command()

const { YOUTRACK_BASE_URL = "", YOUTRACK_TOKEN = "" } = process.env

// Set program information
program
  .name("ytw")
  .description("YouTrack Workflow CLI - Manage YouTrack workflows")
  .version(process.env.npm_package_version || "0.0.1")

program
  .command("list")
  .description("List available workflows")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action(({ host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => 
    listCommand({ host, token })
  )

program
  .command("pull")
  .description("Download workflow(s)")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .option("--force", "Force pull without checking status and confirmation")
  .action((workflow: string[], { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN, force = false }) =>
    pullCommand(workflow, { host, token, force }),
  )

program
  .command("push")
  .description("Push local workflow changes to YouTrack")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .option("--force", "Force push without checking status and confirmation")
  .action((workflows, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN, force = false }) => 
    pushCommand(workflows, { host, token, force })
  )

program
  .command("sync")
  .description("Synchronize workflows between local and YouTrack")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .option("--watch", "Watch for file changes and push changes to YouTrack")
  .option("--force [strategy]", "Force conflict resolution without prompting with specified strategy (skip, pull, push)", SYNC_TYPE.SKIP)
  .action((workflows, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN, watch, force }) => 
    syncCommand(workflows, { host, token, watch, force })
  )

program
  .command("add")
  .description("Add workflow to project")
  .argument("[workflow...]", "Workflow name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) =>
    addCommand(workflow, { host, token }),
  )

program
  .command("remove")
  .description("Remove workflow from project")
  .argument("[workflow...]", "Workflow name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) =>
    removeCommand(workflow, { host, token }),
  )

program
  .command("status")
  .description("Check workflow status")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action(({ host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => 
    statusCommand({ host, token })
  )

program.parse(process.argv)
