import { Command } from "commander"
import * as dotenv from "dotenv"

import { removeCommand } from "./commands/remove.command"
import { statusCommand } from "./commands/status.command"
import { listCommand } from "./commands/list.command"
import { pullCommand } from "./commands/pull.command"
import { pushCommand } from "./commands/push.command"
import { addCommand } from "./commands/add.command"

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
  .action(({ host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => listCommand({ host, token }))

program
  .command("pull")
  .description("Download workflow(s)")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow: string[], { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) =>
    pullCommand(workflow, { host, token }),
  )

program
  .command("push")
  .description("Upload workflow to youtrack")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow: string[], { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) =>
    pushCommand(workflow, { host, token }),
  )

program
  .command("add")
  .description("Add workflow to project")
  .argument("[workflow...]", "Workflow name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow: string[], { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) =>
    addCommand(workflow, { host, token }),
  )

program
  .command("remove")
  .description("Remove workflow from project")
  .argument("[workflow...]", "Workflow name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow: string[], { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) =>
    removeCommand(workflow, { host, token }),
  )

program
  .command("status")
  .description("Check workflow status")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action(({ host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => statusCommand({ host, token }))

program.parse(process.argv)
