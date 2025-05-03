# youtrack-workflow-cli
<img alt="npm" src="https://img.shields.io/npm/v/youtrack-workflow-cli"> <img alt="npm" src="https://img.shields.io/npm/dm/youtrack-workflow-cli?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/youtrack-workflow-cli"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/youtrack-workflow-cli">

The **youtrack-workflow-cli** package contains utilities that help you manage YouTrack workflows when you work in an external code editor. This lets you write and update workflows for YouTrack in JavaScript in your preferred development environment.

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

If you don't want to install the package globally or as a dependency, you can use `npx` to run the commands directly:

```
npx youtrack-workflow-cli <command>
# or the shorter alias
npx ytw <command>
```

This approach allows you to:
- Use the latest version without installing it permanently
- Avoid global installation conflicts
- Run the tool in CI/CD pipelines without installation steps

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

Adds one or more workflows to your project. If no workflow names are specified, you'll be prompted to select from available workflows in YouTrack. The workflow information is stored in your project's package.json file.

Options:
- If no workflow name is provided, it will prompt you to select from available workflows in YouTrack.
- Use `@` to select workflows interactively from the YouTrack server.

### Pull

```
npx ytw pull [workflow-name...]
```

Downloads the specified workflows from your YouTrack installation to your local project.

Options:
- If no workflow name is provided, it will pull all workflows defined in your project.
- Use `@` to select workflows interactively from the YouTrack server.

### Push

```
npx ytw push [workflow-name...]
```

Uploads the workflows from your local project to your YouTrack installation.

Options:
- If no workflow name is provided, it will push all workflows defined in your project.
- Use `@` to select workflows interactively from those in your project.

### Remove

```
npx ytw remove [workflow-name...]
```

Removes workflows from your project and optionally deletes the associated files.

Options:
- If `--delete-files` is specified, the workflow files will be deleted from disk.
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

It also provides an interactive prompt to pull outdated workflows or push modified workflows as needed.

### Status Symbols

The status command uses the following symbols to indicate workflow status:

| Symbol | Status   | Description                                    |
| ------ | -------- | ---------------------------------------------- |
| ✓      | Synced   | Local files match YouTrack version             |
| ↑      | Modified | Local files have changes not in YouTrack       |
| ↓      | Outdated | YouTrack version is ahead of local files       |
| !      | Conflict | Both local and YouTrack versions have changes  |
| ?      | Missing  | Workflow exists in project but no local files  |
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

## Special Instructions for SSL Certificates

If your YouTrack domain uses an SSL certificate that is issued by a known certificate authority, you can establish a connection using just your personal permanent token. Your certificate is already included in CA certificate store that is built into Node.js. For certificates that are issued by a CA that is not recognized automatically or is self-signed, you need to modify the environment variables in Node.js to recognize or ignore your certificate.

For more information, [refer to the YouTrack documentation](https://www.jetbrains.com/help/youtrack/incloud/js-workflow-external-editor.html#special-instructions-ssl-certificates).
