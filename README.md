# youtrack-workflow-cli
<img alt="npm" src="https://img.shields.io/npm/v/youtrack-workflow-cli"> <img alt="npm" src="https://img.shields.io/npm/dm/youtrack-workflow-cli?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/youtrack-workflow-cli"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/youtrack-workflow-cli">

The **youtrack-workflow-cli** package contains utilities that help you manage YouTrack workflows when you work in an external code editor. This lets you write and update workflows for YouTrack in JavaScript in your preferred development environment.

## Features

- **Project Initialization**: Initialize new workflow projects with interactive setup and scaffolding
- **Sync Workflows**: Synchronize workflows (pull and push) between local and YouTrack
- **Status Tracking**: Track the status of workflows with visual indicators
- **Create new Workflow Rule**: Create a new workflow rule from a template
- **Validate Workflows**: Run linting and type checking on workflow files
- **Generate Types**: Create TypeScript definitions for YouTrack project custom fields and work item types
- **Logs with Watch mode**: View logs for a workflow rules
- **Sync with Watch mode**: Watch for file changes and push changes to YouTrack
- **Script Hooks**: Run custom scripts before and after pushing workflows to YouTrack
- **Conflict Resolution**: Resolve conflicts between local and server versions
- **TypeScript Support**: Full TypeScript type definitions for YouTrack scripting API
- **Secure Authentication**: Use permanent tokens for secure access to YouTrack API
- **Environment Variables Support**: Configure via command line or environment variables

## Quick Start

To work with the package, you need to install and run [Node.js](https://nodejs.org/en/). This also installs
the npm package manager that lets you work with the package in your projects.
Next, install the **youtrack-workflow-cli** package in your development environment. The easiest way to get
started is to install the package globally with the following command:

```bash
npm install -g youtrack-workflow-cli
```

If you prefer to install packages as dependencies in your development environment, enter:

```bash
npm install --save-dev youtrack-workflow-cli
```

### Using npx

After installation you can use `npx` to run the commands directly:

```bash
npx ytw <command>
```

### Quick Project Setup

For new projects, the fastest way to get started is with the `init` command:

```bash
npx ytw init
```

This will guide you through setting up a complete workflow project with all necessary files and configuration.

## Commands

The package includes commands that let you synchronize local changes with your YouTrack installation. All commands are accessible through the `ytw` CLI tool. The following
commands are available:

### Init

```bash
npx ytw init
```

Initializes a new YouTrack workflow project with interactive setup. This command creates a complete project structure with all necessary configuration files.

Features:
- Interactive prompts for project name, YouTrack URL, and token
- Credential validation with retry mechanism
- Optional TypeScript configuration
- Creates all necessary project files (package.json, .env, eslint config, etc.)
- Sets up proper folder structure for workflows and types

This is typically the first command you'll run when starting a new workflow project.

### List

```bash
npx ytw list
```

Lists all the workflows that are available in your YouTrack installation.

### Add

```bash
npx ytw add [workflow-name...]
```

Adds one or more workflows to your project. If no workflow names are specified, you'll be prompted to select from available workflows in YouTrack. The workflow information is stored in `ytw.lock` file.

Options:
- If no workflow name is provided, it will prompt you to select from available workflows in YouTrack.

### Pull

```bash
npx ytw pull [workflow-name...] [--force]
```

Downloads the specified workflows from your YouTrack installation to your local project.

Options:
- `-f, --force` - pull existing workflows without checking status and confirmation
- If no workflow names are provided, it will check status and prompt you to select workflows interactively from those which are not synced.

### Push

```bash
npx ytw push [workflow-name...] [--force]
```

Uploads the workflows from your local project to your YouTrack installation.

Options:
- `-f, --force` - push existing workflows without checking status and confirmation
- If no workflow names are provided, it will check status and prompt you to select workflows interactively from those which are not synced.

### Create

```bash
npx ytw create [workflow-name] [rule-name] [template-name]
```

Creates a new workflow rule from a template in the specified workflow folder.

Options:
- If no arguments are provided, it will prompt you to select a workflow, enter a rule name, and choose a template.
- Available templates include: 'action', 'custom', 'on-change', 'on-schedule', 'state-machine', and 'state-machine-per-type'.

### Remove

```bash
npx ytw remove [workflow-name...]
```

Removes workflows from your project and optionally deletes the associated files.

Options:
- If no workflow name is provided, it will prompt you to select which workflows to remove from those in your project.

### Status

```bash
ytw status
```

Checks the status of all workflows in your project and compares them with the versions in YouTrack. This command shows:
- Which workflows are in sync
- Which have local modifications
- Which are outdated (the YouTrack version is newer)
- Any conflicts between local and YouTrack versions

### Sync

```bash
ytw sync [workflow-name...] [--force [strategy]] [--watch] [--lint] [--type-check] [--max-warnings [number]]
```

Synchronizes workflows between your local project and YouTrack. This command:
- Checks the status of all workflows in your project
- Prompts you to select workflows that need to be synchronized
- Allows you to resolve conflicts between local and YouTrack versions

Options:
- `-f, --force [strategy]` - synchronize workflows without checking status and with specified strategy (skip, pull, push)
- `-w, --watch` - watch for file changes and push changes to YouTrack
- `-l, --lint` - run linting checks on workflows
- `-t, --type-check` - run TypeScript type checking
- `-m, --max-warnings [number]` - maximum allowed warnings
- If no workflow names are provided, it will check status and prompt you to select workflows interactively from those which are not synced.

### Lint

```bash
ytw lint [workflow-name...] [--type-check]
```

Runs linting checks on workflow files. This helps maintain code quality and catch potential errors early.

Options:
- `-t, --type-check` - run TypeScript type checking
- If no workflow names are provided, it will lint all workflows in your project.


Eslint config (`eslint.config.js`) example:
```js
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
```

### Logs

```bash
ytw logs [workflow-name...] [--watch [ms]] [--all] [--top <number>]
```

View logs for a selected workflow rules. This helps you monitor the behavior of your workflows in real-time. 

Options:
- `-w, --watch [ms]` - watch for new logs in YouTrack in real-time with interval in milliseconds, default: 5000ms.
- `-a, --all` - fetch all logs for rules of all workflows in project
- `-t, --top [number]` - number of logs to fetch per rule, default: 10
- If workflow names are provided and `--all` is not specified, it will prompt you to select rules from provided workflows.

### Types

```bash
ytw types [project-id]
```

Generates TypeScript type definitions for a YouTrack project's custom fields and work item types. This helps maintain type safety when developing workflows for specific projects.

The generated type definitions are saved to the `/types` folder by default, but you can customize this location using the `typesFolder` configuration in your `package.json`.

Options:
- If no project ID is provided, it will prompt you to select from available projects in YouTrack.

### Status Symbols

The status command uses the following symbols to indicate workflow status:

| Symbol | Status   | Description                                    |
| ------ | -------- | ---------------------------------------------- |
| ✓      | Synced   | Local files match YouTrack version             |
| ↑      | Modified | Local files have changes not in YouTrack       |
| ↓      | Outdated | YouTrack version is ahead of local files       |
| !      | Conflict | Both local and YouTrack versions have changes  |
| +      | New      | Local files exist but workflow not in YouTrack |

### Common Parameters

Most commands require the following parameters:

| Parameter | Description                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| --host    | The base URL of your YouTrack installation. For an InCloud instance, include the trailing `/youtrack`. Can also be set via the `YOUTRACK_BASE_URL` environment variable.                                                                                 |
| --token   | A permanent token that grants access to the YouTrack service. You can generate your own permanent tokens to authenticate with YouTrack on the **Authentication** tab of your Hub profile. Can also be set via the `YOUTRACK_TOKEN` environment variable. |

## Environment Variables

You can set the following environment variables to avoid passing host and token parameters with each command:

```bash
YOUTRACK_BASE_URL=https://youtrack.example.com
YOUTRACK_TOKEN=your-permanent-token
```

## TypeScript Type Definitions

You can use [youtrack-workflow-api-types](https://github.com/udamir/youtrack-workflow-api-types) package and generated types for your project to write type-safe workflows.

```bash
npm install --save-dev youtrack-workflow-api-types typescript
```

Add `paths` to your project's `tsconfig.json` with following content:

```json
{
  "compilerOptions": {
    "checkJs": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "target": "es2020",
    "module": "commonjs",
    "baseUrl": ".",
    "paths": {
      "@jetbrains/youtrack-scripting-api": ["node_modules/youtrack-workflow-api-types"],
      "@jetbrains/youtrack-scripting-api/*": ["node_modules/youtrack-workflow-api-types/*"]
    }
  },
  "include": [
    "**/*.js"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

Add [JSDoc annotations](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) to your workflow files:

```js
/** @import { Issue } from '../types/demo' */ // Default location
// or from custom location: '../custom-types/demo' if typesFolder is configured

exports.rule = entities.Issue.onChange({
  title: 'example',
  action: (ctx) => {
    /** @type {Issue} */
    const issue = ctx.issue;    
   
    // Use typescript validation for issue fields and work items
  }
});
```

## Configuration in package.json

You can configure your workflow management in your project's `package.json` file using the `ytw` section:

```json
{
  "ytw": {
    "linting": {
      "enableEslint": true,
      "enableTypeCheck": false,
      "failOnWarnings": false,
      "maxWarnings": 10
    },
    "prepush": "your-script-command",
    "postpush": "your-script-command",
    "typesFolder": "./custom-types"
  }
}
```

### Available options:

#### Linting configuration:

- `enableEslint` (boolean): Enable or disable ESLint checks during linting and sync commands.
- `enableTypeCheck` (boolean): Enable or disable TypeScript type checking during linting and sync commands.
- `failOnWarnings` (boolean): Whether lint warnings should cause the command to fail.
- `maxWarnings` (number): Maximum number of warnings allowed before the linting fails.

#### Script hooks:

- `prepush` (string): Script to run before pushing workflows to YouTrack. If this script fails (returns non-zero exit code), the push operation will be aborted.
- `postpush` (string): Script to run after successfully pushing a workflow to YouTrack.

#### Type definitions:

- `typesFolder` (string): Custom folder path for TypeScript type definitions generated by the `types` command. Defaults to `/types` if not specified. Can be relative (e.g., `"./custom-types"`) or absolute path.

These scripts are executed with the `workflowName` (and `ruleName` in sync with watch mode) passed as arguments, which allows you to perform different actions based on which workflow is being processed.

Example usage:

```json
{
  "ytw": {
    "prepush": "node scripts/validate-workflow.js",
    "postpush": "node scripts/notify-team.js"
  }
}
```

## Special Instructions for SSL Certificates

If your YouTrack domain uses an SSL certificate that is issued by a known certificate authority, you can establish a connection using just your personal permanent token. Your certificate is already included in CA certificate store that is built into Node.js. For certificates that are issued by a CA that is not recognized automatically or is self-signed, you need to modify the environment variables in Node.js to recognize or ignore your certificate.

For more information, [refer to the YouTrack documentation](https://www.jetbrains.com/help/youtrack/incloud/js-workflow-external-editor.html#special-instructions-ssl-certificates).

## Support

[Buy me a coffee](https://buymeacoffee.com/udamir)

# License

MIT
