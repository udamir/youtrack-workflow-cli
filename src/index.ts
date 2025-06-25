import { Command } from "commander"
import * as dotenv from "dotenv"

import {
  listCommand,
  lintCommand,
  logsCommand,
  removeCommand,
  statusCommand,
  syncCommand,
  typesCommand,
  pullCommand,
  pushCommand,
  addCommand,
  createCommand,
} from "./commands"
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
  .action(({ host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => listCommand({ host, token }))

program
  .command("pull")
  .description("Download workflow(s)")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .option("-f,--force", "Force pull without checking status and confirmation")
  .action((workflow: string[], { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN, force = false }) =>
    pullCommand(workflow, { host, token, force }),
  )

program
  .command("push")
  .description("Push local workflow changes to YouTrack")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .option("-f, --force", "Force push without checking status and confirmation")
  .action((workflows, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN, force = false }) =>
    pushCommand(workflows, { host, token, force }),
  )

program
  .command("sync")
  .description("Synchronize workflows between local and YouTrack")
  .argument("[workflow...]", "Workflow name(s) or @ to select interactively")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .option("-w, --watch", "Watch for file changes and push changes to YouTrack")
  .option(
    "--force [strategy]",
    "Force conflict resolution without prompting with specified strategy (skip, pull, push)",
    SYNC_TYPE.SKIP,
  )
  .option("-l, --lint", "Linting validation before pushing changes to YouTrack")
  .option("-t, --type-check", "Run TypeScript type checking")
  .option("-m, --max-warnings [number]", "Maximum allowed warnings", Number.parseInt, 10)
  .action(
    (workflows, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN, watch, force, lint, typeCheck, maxWarnings }) =>
      syncCommand(workflows, { host, token, watch, force, lint, typeCheck, maxWarnings }),
  )

program
  .command("add")
  .description("Add workflow to project")
  .argument("[workflow...]", "Workflow name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => addCommand(workflow, { host, token }))

program
  .command("remove")
  .description("Remove workflow from project")
  .argument("[workflow...]", "Workflow name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => removeCommand(workflow, { host, token }))

program
  .command("status")
  .description("Check workflow status")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action(({ host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => statusCommand({ host, token }))

program
  .command("types")
  .description("Add type definition for Youtrack project")
  .argument("[projects...]", "Youtrack project short name")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((projects, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) => typesCommand(projects, { host, token }))

program
  .command("lint")
  .description("Run linting checks on workflow files")
  .argument("[workflow...]", "Workflow name")
  .option("--type-check", "Run TypeScript type checking")
  .action((workflow, { typeCheck }) => lintCommand(workflow, { typeCheck }))

program
  .command("logs")
  .description("Fetch and display workflow logs")
  .argument("[workflows...]", "Workflow names to fetch logs for")
  .option("-t, --top <number>", "Number of logs to fetch per rule", Number.parseInt, 10)
  .option("-w, --watch [ms]", "Watch for new logs", Number.parseInt)
  .option("-a, --all", "Fetch all logs for rules of all workflows in project")
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action(
    (
      workflows: string[],
      { host = process.env.YOUTRACK_BASE_URL || "", token = process.env.YOUTRACK_TOKEN || "", top, watch, all = false },
    ) => logsCommand(workflows, { host, token, top, watch: watch === true ? 5000 : watch, all }),
  )

program
  .command("create")
  .description("Create a new workflow rule from a template")
  .argument("[workflow]", "Workflow name to create rule in")
  .argument("[ruleName]", "Name for the new rule")
  .argument(
    "[template]",
    "Template to use for the new rule (action, custom, on-change, on-schedule, state-machine, state-machine-per-type)",
  )
  .option("--host [host]", "YouTrack host")
  .option("--token [token]", "YouTrack token")
  .action((workflow, ruleName, template, { host = YOUTRACK_BASE_URL, token = YOUTRACK_TOKEN }) =>
    createCommand(workflow, ruleName, template, { host, token }),
  )

program.parse(process.argv)
