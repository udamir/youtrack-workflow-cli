import { Command } from "commander"
import * as dotenv from "dotenv"

import { removeCommand } from "./commands/remove.command"
import { statusCommand } from "./commands/status.command"
import { typesCommand } from "./commands/types.command"
import { listCommand } from "./commands/list.command"
import { pullCommand } from "./commands/pull.command"
import { pushCommand } from "./commands/push.command"
import { syncCommand } from "./commands/sync.command"
import { lintCommand } from "./commands/lint.command"
import { addCommand } from "./commands/add.command"
import { readPackageJson } from "./tools/fs.tools"
import { SYNC_TYPE } from "./consts"

dotenv.config()

const program = new Command()

const { YOUTRACK_BASE_URL = "", YOUTRACK_TOKEN = "" } = process.env

// Set program information
program
  .name("ytw")
  .description("YouTrack Workflow CLI - Manage YouTrack workflows")
  .version(readPackageJson()?.version || "Unknown")

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
  .option("--lint", "Linting validation before pushing changes to YouTrack")
  .option("--type-check", "Run TypeScript type checking")
  .option("--max-warnings [number]", "Maximum allowed warnings", Number.parseInt, 10)
  .action((workflows, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN, watch, force, lint, typeCheck, maxWarnings }) => 
    syncCommand(workflows, { host, token, watch, force, lint, typeCheck, maxWarnings })
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

program
  .command("types")
  .description("Add type definition for Youtrack project")
  .argument("[projects...]", "Youtrack project short name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((projects, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => 
    typesCommand(projects, { host, token })
  )

program
  .command("lint")
  .description("Run linting checks on workflow files")
  .argument("[workflow...]", "Workflow name")
  .option("--type-check", "Run TypeScript type checking")
  .action((workflow, { typeCheck }) => lintCommand(workflow, { typeCheck }))

program.parse(process.argv)
