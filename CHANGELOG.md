# YouTrack Workflow CLI

A command-line tool for managing YouTrack workflows with seamless local development experience.

## [1.6.0] - 2026-02-01

#### Log Filtering Options
- **`--last <number>`**: Show only the last N log entries (tail functionality)
  - Example: `ytw logs my-workflow/my-rule --last 10`
- **`--since <value>`**: Filter logs from a specific timestamp or relative duration
  - Supports Unix timestamps: `--since 1768577702000`
  - Supports durations: `--since 5m`, `--since 1h`, `--since 2d`, `--since 1w`
  - Supports compound durations: `--since "1h 30m"`, `--since "2d 5h 15m"`


## [1.5.2] - 2026-01-12

### New Features

#### Specific Rule Targeting for Logs
- **Direct rule targeting**: Added support for specifying specific rules directly using `workflow/rule` syntax in `ytw logs`
  - Example: `ytw logs my-workflow/my-rule` fetches logs for a specific rule without prompts
  - Supports multiple specific rules: `ytw logs workflow1/rule1 workflow2/rule2`
  - Can be mixed with workflow-only targets: `ytw logs workflow1/rule1 workflow2`
  - Works with all existing options (`--watch`, `--top`, `--all`)

### Bug Fixes

- **Fixed stale cache issue during pull/sync**: Files deleted on YouTrack server were not being removed locally during pull operations. The server cache is now cleared before downloading to ensure fresh data is fetched.
- **Fixed API pagination for projects and link types**: Added `$top=-1` parameter to `fetchProjects()` and `getIssueLinkTypes()` to retrieve all items instead of the default ~50 limit (#70)

## [1.4.0] - 2025-08-29

### Improvements
- Cleaner and more readable error output in sync and watch flows with YouTrack error description.

### Bug Fixes
- Upload now awaits the HTTP request to correctly propagate YouTrack errors to callers.
- Fix formatting for generated issue link types definitions.

## [1.3.0] - 2025-08-04

### New Features

#### Issue Link Types Support
- **Enhanced Type Generation**: Added support for issue link types in TypeScript type generation
- **Type Safety**: Issue links now properly typed with project-specific link type names


## [1.2.4] - 2025-08-03

### New Features

#### Workflow Linting Filters
- **Include/Exclude Configuration**: Added support for filtering workflows during linting operations
  - `include` array: Specify which workflows to include in linting (if provided, only these workflows will be linted)
  - `exclude` array: Specify which workflows to exclude from linting (these workflows will never be linted)
  - Configuration via `package.json` under `ytw.linting.include` and `ytw.linting.exclude`
  - Effects `lint` and `sync` commands

### Bug Fixes
- **Fixed duplicated logs in watch mode**: Resolved issue where `ytw logs --watch` showed duplicate log entries
- **Fixed TypeScript linting**: Resolved issue where `ytw lint` ignores `tsconfig.json` settings
- **Fixed Default tsconfig**: Fixed default tsconfig generated on `ytw init`

## [1.1.1] - 2025-01-27

### New Features

#### Init Command
- **`init`**: Initialize new YouTrack workflow projects
  - Interactive project setup with prompts for project name, YouTrack URL, and token
  - Credential validation with retry mechanism
  - Complete project structure creation with all necessary files

#### Configurable Types Folder
- **Enhanced `types` command**: Support for custom TypeScript types output folder
  - Configurable via `ytw.typesFolder` in `package.json`
  - Supports both relative and absolute paths
  - Defaults to `/types` folder for backward compatibility

## [1.0.0] - 2025-06-28

### Available Features

#### Core Features
- **Workflow Management**
  - Synchronize workflows between local files and YouTrack server
  - Add, remove, and update workflows in projects
  - Watch mode for automatic synchronization on file changes
  - Support for multiple projects and workflows

#### Command Suite
- **`sync`**: Synchronize workflows between local files and YouTrack
  - Two-way synchronization with conflict detection
  - Simultaneous updates across multiple workflows
  - Force mode to override remote workflows
  - Watch mode for continuous synchronization

- **`add`**: Add workflows to a YouTrack project
  - Interactive workflow selection
  - Multiple workflow addition in one command

- **`create`**: Create new workflows from templates
  - Pre-defined workflow templates
  - Custom template support
  - Interactive template selection

- **`lint`**: Check workflows for errors and warnings
  - JavaScript/TypeScript linting
  - YouTrack-specific rule validation
  - Configurable warning thresholds

- **`pull`**: Download workflows from YouTrack to local files
  - Selective workflow pulling
  - Conflict resolution

- **`push`**: Upload workflows from local files to YouTrack
  - Selective workflow pushing
  - Conflict resolution
  - Force mode for overwriting remote workflows

- **`remove`**: Delete workflows from a project
  - Interactive workflow selection for removal
  - Multiple workflow removal in one command

- **`status`**: Check status of workflows
  - Compare local and remote workflows
  - Detailed status information per workflow

- **`types`**: Generate TypeScript types for YouTrack entities
  - Automatic type extraction from YouTrack API
  - Typed entity definitions for workflow development

#### User Experience
- Colored console output for better readability
- Progress indicators for long-running operations
- Interactive prompts for complex operations
- Automatic version update notifications

#### Authentication & Security
- Secure token-based authentication
- Environment variable support for CI/CD integration
- Configuration file support
