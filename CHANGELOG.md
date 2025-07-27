# YouTrack Workflow CLI

A command-line tool for managing YouTrack workflows with seamless local development experience.

## [1.1.1] - 2025-01-27

### Bug Fixes
- Fixed linting issues with non-null assertions in init command
- Minor documentation improvements

## [1.1.0] - 2025-01-27

### New Features

#### Init Command
- **`init`**: Initialize new YouTrack workflow projects
  - Interactive project setup with prompts for project name, YouTrack URL, and token
  - Command-line options for non-interactive usage:
    - `-n, --name <name>`: Project name
    - `--host <host>`: YouTrack base URL
    - `--token <token>`: YouTrack token
    - `--typescript`: Enable TypeScript support
    - `--no-typescript`: Disable TypeScript support
    - `-y, --yes`: Skip interactive prompts and use defaults
  - Credential validation with retry mechanism (up to 3 attempts)
  - Optional TypeScript configuration and scaffolding
  - Complete project structure creation with all necessary files:
    - `.env` with credentials
    - `package.json` with dependencies and ytw configuration
    - `eslint.config.cjs` for linting
    - `tsconfig.json` (if TypeScript enabled)
    - `.gitignore` with appropriate patterns
    - `README.md` with project documentation
    - `types/` directory for TypeScript definitions
  - Support for both interactive and non-interactive workflows
  - CI/CD and scripting support through command-line options

#### Configurable Types Folder
- **Enhanced `types` command**: Support for custom TypeScript types output folder
  - Configurable via `ytw.typesFolder` in `package.json`
  - Supports both relative and absolute paths
  - Defaults to `/types` folder for backward compatibility
  - Example configuration:
    ```json
    {
      "ytw": {
        "typesFolder": "./custom-types"
      }
    }
    ```

### Enhancements
- **Project Templates**: Updated with specific dependency versions for reproducibility
- **Documentation**: Comprehensive updates with new command examples and usage patterns
- **Architecture**: Enhanced services layer with `ProjectInitService` for initialization logic
- **Error Handling**: Improved validation and error messages for better user experience
- **Backward Compatibility**: All existing functionality preserved

### Technical Improvements
- Added `InitCommandOptions` interface for type safety
- Enhanced file system tools with project creation utilities
- Improved input validation for project names, URLs, and tokens
- Better separation of concerns between commands, services, and tools layers

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
