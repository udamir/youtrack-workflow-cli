# YouTrack Workflow CLI

A command-line tool for managing YouTrack workflows with seamless local development experience.

## [1.2.4] - 2025-08-03

### New Features

#### Workflow Linting Filters
- **Include/Exclude Configuration**: Added support for filtering workflows during linting operations
  - `include` array: Specify which workflows to include in linting (if provided, only these workflows will be linted)
  - `exclude` array: Specify which workflows to exclude from linting (these workflows will never be linted)
  - Configuration via `package.json` under `ytw.linting.include` and `ytw.linting.exclude`
  - Effects `lint` and `sync` commands

### Bug Fixes

#### Logs Command Watch Mode Duplicates
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
