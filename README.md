# youtrack-workflow-cli
<img alt="npm" src="https://img.shields.io/npm/v/youtrack-workflow-cli"> <img alt="npm" src="https://img.shields.io/npm/dm/youtrack-workflow-cli?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/youtrack-workflow-cli"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/youtrack-workflow-cli">

The **youtrack-workflow-cli** package contains utilities that help you manage YouTrack workflows when you work in an external code editor. This lets you write and update workflows for YouTrack in JavaScript in your preferred development environment.

## Features

- **List Workflows**: View all available YouTrack workflows in your instance
- **Pull Workflows**: Download and extract YouTrack workflow scripts to your local environment
- **Push Workflows**: Upload local workflow scripts to your YouTrack instance
- **Lint Workflows**: Run linting checks on workflow files
- **Logs with Watch mode**: View logs for a workflow rules
- **Generate Types**: Create TypeScript definitions for YouTrack project custom fields and work item types
- **Type Check**: Run TypeScript type checking on workflow files
- **Sync Workflows**: Synchronize workflows between local and YouTrack
- **Sync with Watch mode**: Watch for file changes and push changes to YouTrack
- **Secure Authentication**: Use permanent tokens for secure access to YouTrack API
- **Environment Variables Support**: Configure via command line or environment variables
- **TypeScript Support**: Full TypeScript type definitions for YouTrack scripting API

## Quick Start

To work with the package, you need to install and run [Node.js](https://nodejs.org/en/). This also installs
the npm package manager that lets you work with the package in your projects.
Next, install the **youtrack-workflow-cli** package in your development environment. The easiest way to get
started is to install the package globally with the following command:

```
npm install -g youtrack-workflow-cli
```

If you prefer to install packages as dependencies in your development environment, enter:

```
npm install --save-dev youtrack-workflow-cli
```

### Using npx

After installation you can use `npx` to run the commands directly:

```
npx ytw <command>
```

## Utility Commands

The package includes commands that let you synchronize local changes with your YouTrack installation. All commands are accessible through the `ytw` CLI tool. The following
commands are available:

### List

```
npx ytw list
```

Lists all the workflows that are available in your YouTrack installation.

### Add

```
npx ytw add [workflow-name...]
```

Adds one or more workflows to your project. If no workflow names are specified, you'll be prompted to select from available workflows in YouTrack. The workflow information is stored in `ytw.lock` file.

Options:
- If no workflow name is provided, it will prompt you to select from available workflows in YouTrack.
- Use `@` to select workflows interactively from the YouTrack server.

### Pull

```
npx ytw pull [workflow-name...] [--force]
```

Downloads the specified workflows from your YouTrack installation to your local project.

Options:
- `--force` - pull existing workflows without checking status and confirmation
- If no workflow names are provided, it will check status and prompt you to select workflows interactively from those which are not synced.

### Push

```
npx ytw push [workflow-name...] [--force]
```

Uploads the workflows from your local project to your YouTrack installation.

Options:
- `--force` - push existing workflows without checking status and confirmation
- If no workflow names are provided, it will check status and prompt you to select workflows interactively from those which are not synced.

### Remove

```
npx ytw remove [workflow-name...]
```

Removes workflows from your project and optionally deletes the associated files.

Options:
- If no workflow name is provided, it will prompt you to select which workflows to remove from those in your project.

### Status

```
ytw status
```

Checks the status of all workflows in your project and compares them with the versions in YouTrack. This command shows:
- Which workflows are in sync
- Which have local modifications
- Which are outdated (the YouTrack version is newer)
- Any conflicts between local and YouTrack versions

### Sync

```
ytw sync [workflow-name...] [--force [strategy]] [--watch] [--lint] [--type-check] [--max-warnings [number]]
```

Synchronizes workflows between your local project and YouTrack. This command:
- Checks the status of all workflows in your project
- Prompts you to select workflows that need to be synchronized
- Allows you to resolve conflicts between local and YouTrack versions

Options:
- `--force [strategy]` - synchronize workflows without checking status and with specified strategy (skip, pull, push)
- `--watch` - watch for file changes and push changes to YouTrack
- `--lint` - run linting checks on workflows
- `--type-check` - run TypeScript type checking
- `--max-warnings [number]` - maximum allowed warnings
- If no workflow names are provided, it will check status and prompt you to select workflows interactively from those which are not synced.

### Lint

```
ytw lint [workflow-name...] [--type-check]
```

Runs linting checks on workflow files. This helps maintain code quality and catch potential errors early.

Options:
- `--type-check` - run TypeScript type checking
- If no workflow names are provided, it will lint all workflows in your project.

### Logs

```
ytw logs [workflow-name...] [--watch]
```

View logs for a selected workflow rules. This helps you monitor the behavior of your workflows in real-time.

Options:
- `--watch` - watch for file changes and push changes to YouTrack
- If no workflow names are provided, it will prompt you to select from available workflows in project.

### Types

```
ytw types [project-id]
```

Generates TypeScript type definitions for a YouTrack project's custom fields and work item types. This helps maintain type safety when developing workflows for specific projects.

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

```
YOUTRACK_BASE_URL=https://youtrack.example.com
YOUTRACK_TOKEN=your-permanent-token
```

## TypeScript Type Definitions

You can use [youtrack-workflow-api-types](https://github.com/udamir/youtrack-workflow-api-types) package and generated types for your project to write type-safe workflows.

```
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
/** @import { Issue } from '../types/demo' */

exports.rule = entities.Issue.onChange({
  title: 'example',
  action: (ctx) => {
    /** @type {Issue} */
    const issue = ctx.issue;    
   
    // Use typescript validation for issue fields and work items
  }
});
```

## Special Instructions for SSL Certificates

If your YouTrack domain uses an SSL certificate that is issued by a known certificate authority, you can establish a connection using just your personal permanent token. Your certificate is already included in CA certificate store that is built into Node.js. For certificates that are issued by a CA that is not recognized automatically or is self-signed, you need to modify the environment variables in Node.js to recognize or ignore your certificate.

For more information, [refer to the YouTrack documentation](https://www.jetbrains.com/help/youtrack/incloud/js-workflow-external-editor.html#special-instructions-ssl-certificates).

# License

MIT