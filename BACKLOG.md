# YouTrack Workflow CLI Backlog

This document outlines planned features and improvements for the YouTrack Workflow CLI tool.

## Current Project Structure and Patterns

### Project Structure

```
youtrack-workflow-cli/
├── src/
│   ├── commands/           # Command implementations
│   │   ├── add.command.ts  # Add workflow to project
│   │   ├── list.command.ts # List workflows in project
│   │   ├── pull.command.ts # Pull workflows from YouTrack
│   │   ├── push.command.ts # Push workflows to YouTrack
│   │   ├── remove.command.ts # Remove workflows from project
│   │   └── status.command.ts # Check workflow status
│   ├── services/           # Service layer
│   │   ├── project.service.ts # Project management
│   │   └── youtrack.service.ts # YouTrack API interactions
│   ├── tools/              # Utility tools
│   │   ├── fs.tools.ts     # File system operations
│   │   ├── hash.tools.ts   # Hash calculation
│   │   └── zip.tools.ts    # ZIP file operations
│   ├── consts.ts           # Constants
│   ├── errors.ts           # Custom error classes
│   ├── index.ts            # Main entry point
│   ├── types.ts            # Type definitions
│   └── utils.ts            # Common utilities
├── test/                   # Project dependencies and scripts
│   ├── integration/        # Integration tests
│   ├── unit/               # Unit tests
├── package.json            # Project dependencies and scripts
└── ...                     # Other configuration files
```

### Design Patterns and Rules

1. **Command Pattern**
   - Each CLI command is implemented as a standalone function
   - Commands receive workflow names and option parameters
   - Commands follow a consistent structure and error handling approach
   - Commands are responsible for all input and output, including progress tracking and error reporting

2. **Service Layer**
   - Services are responsible for all business logic and caching, should provide to commands all required data
   - `ProjectService`: Manages local workflow files and project configuration (e.g., lock file)
   - `YoutrackService`: Handles API communication with YouTrack

3. **Error Handling**
   - Custom error classes for specific error scenarios
   - Consistent error reporting with colored output

4. **Progress Tracking**
   - Each command directly uses the `ora` package for progress indicators
   - Status updates are displayed using consistent formatting through `printItemStatus`

5. **Code Organization Rules**
   - Keep command files focused on orchestration logic
   - Extract reusable logic into services or utility functions
   - Use named exports for better code discoverability
   - Follow TypeScript best practices with proper type annotations

6. **Development Guidelines**
   - No external NPM libraries should be added (if it is not mentioned in the backlog)
   - All code changes must pass linting (`npm run lint`)
   - Maintain consistent code style across the codebase
   - Keep commands non-blocking when possible for better user experience
   - Add unit tests for all tools and utilities
   - Add integration tests for services

## Feature Backlog

### Feature 1. Improved Output with Progress Indicators

**Objective**: Enhance the CLI output with animated loading indicators and progress tracking similar to Jest's output format.

#### Requirements
- Show animated spinner next to workflows being processed
- Display overall progress (X of Y complete)
- Clear visual distinction between pending, in-progress, and completed items
- Support for different terminal environments

#### Implementation Plan

1. **Add Dependencies**
   - Add `ora` for spinners or `cli-spinners` for customizable spinner options
   - Add `chalk` or `colors` for better terminal coloring (if not already present)
   - Consider `progress` for progress bars

2. **Integrate with Command Files**
   - Modify `add.command.ts`, `remove.command.ts`, `pull.command.ts`, and `push.command.ts` to use the ProgressManager
   - Replace current console.log output with progress updates

3. **Add Configuration Options**
   - Allow disabling animations (for CI environments)
   - Add verbose mode for more detailed output

4. **Testing**
   - Add tests for ProgressManager
   - Test in different terminal environments

#### Estimated Effort: Medium (2-3 days)

- [x] Completed

---

### Feature 2. Enhanced Workflow Tracking with Lock File

**Objective**: Improve workflow tracking by using a dedicated lock file instead of package.json and enable granular tracking of individual workflow files.

#### Requirements
- Create and maintain a `ytw.lock` file for workflow hashes
- Track hashes of individual files within workflows
- Improve conflict detection and resolution

#### Implementation Plan

1. **Create Lock File Structure**
   ```json
   {
     "workflows": {
       "@jetbrains/youtrack-workflow-example": {
         "hash": "sha256-hash-of-entire-workflow",
         "files": {
           "workflow.js": "sha256-hash-of-file",
           "workflow.xml": "sha256-hash-of-file",
           "i18n/en.properties": "sha256-hash-of-file"
         }
       }
     }
   }
   ```

2. **Update ProjectService**
   ```typescript
   // Add methods for lock file management
   class ProjectService {
     // Existing methods...
     
     private readLockFile(): LockFileData {
       // Read ytw.lock or create if not exists
     }
     
     private writeLockFile(data: LockFileData): void {
       // Write updated lock file
     }
     
     public getWorkflowFileHashes(workflowName: string): Record<string, string> {
       // Return hashes for individual files in a workflow
     }
     
     public updateWorkflowFileHashes(workflowName: string, files: WorkflowFile[]): void {
       // Update hashes for individual files in the lock file
     }
   }
   ```

3. **Update File Hash Calculation**
   ```typescript
   export function calculateWorkflowHashes(files: WorkflowFile[]): {
     workflowHash: string;
     fileHashes: Record<string, string>;
   } {
     // Calculate overall workflow hash and individual file hashes
   }
   ```

- [x] Completed

#### Estimated Effort: Medium (2-3 days)

---

### Feature 3. Per-File Status Tracking and Enhanced Conflict Resolution

**Objective**: Enhance the status command to provide file-level granularity and improve conflict detection and reporting.

#### Requirements
- Show status for individual files within workflows
- Highlight specific files with conflicts
- Provide detailed information about modifications
- Improve UI for status display

#### Implementation Plan

1. **Enhance Status Command**
   ```typescript
   export const statusCommand = async (
     { detailed = false, ...options } = {}
   ): Promise<void> => {
     // Existing implementation...
     
     if (detailed) {
       // Show file-level status for each workflow
       for (const workflow of workflows) {
         const fileStatus = await projectService.getWorkflowFileStatus(workflow);
         // Display file-level status information
       }
     }
   }
   ```

2. **Add File-Level Status Methods**
   ```typescript
   class ProjectService {
     // Existing methods...
     
     public async getWorkflowFileStatus(workflowName: string): Promise<Record<string, WorkflowStatus>> {
       // Check status of each file in the workflow
       // Compare local and server file hashes to determine status
     }
   }
   ```

3. **Improve Status Display**
   - Color-code files by status
   - Group files by status type
   - Show summary count of modified files

#### Estimated Effort: Medium (2 days)

- [x] Completed

---

### Feature 4. Sync Command with Watch Mode

**Objective**: Create a new sync command that can automatically handle workflow synchronization between local files and YouTrack with optional watch mode for real-time file monitoring.

#### Requirements
- Automatically determine optimal sync strategy
- Conflict resolution per file
- Watch mode for real-time synchronization (`sync --watch`)
- Force option for automated resolution (`sync --watch --force`)
- Monitor filesystem for changes to workflow files
- Auto-detect which workflow was modified
- Implement debounce mechanism to avoid excessive updates
- Push updated workflows to YouTrack automatically
- Handle error scenarios gracefully
- Support watch mode for all or selected workflows (`sync --watch @` for interactive selection)
- Clean shutdown on user interruption (CTRL+C)
- Provide visual feedback during watch mode
- Allow configuration of watch behavior

#### Implementation Plan

1. **Add Dependencies**
   - Add `chokidar` for file watching capabilities
   - Add `debounce` or similar for rate limiting

2. **Create Sync Command**
   ```typescript
   export const syncCommand = async (
     workflows: string[] = [],
     { 
       host = "", 
       token = "", 
       watch = false,
       force = false,
       strategy = "auto", // "auto", "pull", "push"
       debounce = 1000
     } = {}
   ): Promise<void> => {
     // Implementation that combines pull and push with conflict resolution
     const projectService = new ProjectService(new YoutrackService(host, token));
     
     // Handle sync based on workflow status
     for (const workflow of workflows) {
       const status = await projectService.workflowStatus(workflow);
       
       switch(status) {
         case WORKFLOW_STATUS.MODIFIED:
           // Push changes to YouTrack
           break;
         case WORKFLOW_STATUS.OUTDATED:
           // Pull changes from YouTrack
           break;
         case WORKFLOW_STATUS.CONFLICT:
           if (force) {
             // Use the specified strategy
           } else {
             // Prompt for resolution
           }
           break;
       }
     }
     
     // Set up watch mode if requested
     if (watch) {
       console.log('Starting watch mode. Press Ctrl+C to exit.');
       
       // Set up file watching
       const fileWatcher = new FileWatcher(projectService, {
         forceStrategy: force ? strategy : undefined,
         debounceMs: debounce
       });
       
       fileWatcher.watch(projectService.projectDir);
       
       // Handle process termination
       process.on('SIGINT', () => {
         console.log('\nStopping watch mode...');
         fileWatcher.stop();
         process.exit(0);
       });
     }
   }
   ```

3. **Implement Conflict Resolution**
   ```typescript
   async function resolveConflict(
     workflow: string,
     projectService: ProjectService,
     strategy?: "pull" | "push"
   ): Promise<void> {
     if (!strategy) {
       // Prompt user for strategy
       const { strategy } = await inquirer.prompt([
         {
           type: "list",
           name: "strategy",
           message: `Conflict detected for workflow ${workflow}. How would you like to resolve it?`,
           choices: [
             { name: "Pull from YouTrack (overwrite local changes)", value: "pull" },
             { name: "Push to YouTrack (overwrite server changes)", value: "push" },
             { name: "Skip this workflow", value: "skip" }
           ]
         }
       ]);
       
       if (strategy === "skip") return;
     }
     
     if (strategy === "pull") {
       await projectService.downloadYoutrackWorkflow(workflow);
     } else {
       await projectService.uploadWorkflow(workflow);
     }
   }
   ```

4. **Implement File Watcher**
   ```typescript
   class FileWatcher {
     private watcher: chokidar.FSWatcher;
     private debounceTimers: Record<string, NodeJS.Timeout> = {};
     
     constructor(
       private projectService: ProjectService,
       private options: { 
         forceStrategy?: string,
         debounceMs: number 
       }
     ) {}
     
     watch(projectDir: string): void {
       this.watcher = chokidar.watch(projectDir, {
         ignored: /(node_modules|\.git)/,
         persistent: true
       });
       
       this.watcher.on('change', (path) => this.onFileChange(path));
     }
     
     private onFileChange(path: string): void {
       const workflow = this.getWorkflowFromPath(path);
       if (workflow) {
         this.debouncedSync(workflow);
       }
     }
     
     private debouncedSync(workflow: string): void {
       if (this.debounceTimers[workflow]) {
         clearTimeout(this.debounceTimers[workflow]);
       }
       
       this.debounceTimers[workflow] = setTimeout(async () => {
         try {
           await syncWorkflow(workflow, this.projectService, this.options.forceStrategy);
         } catch (error) {
           console.error(`Error syncing ${workflow}:`, error);
         }
       }, this.options.debounceMs);
     }
     
     private getWorkflowFromPath(path: string): string | null {
       // Determine which workflow a file belongs to
       // Return workflow name or null if not part of a workflow
     }
     
     stop(): void {
       if (this.watcher) {
         this.watcher.close();
       }
       
       // Clear any pending timers
       Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
     }
   }
   ```

5. **CLI Integration**
   - Add sync command with watch and force options
   - Add strategy option for conflict resolution
   - Add options for debounce time, patterns to ignore, etc.
   - Update help text to explain new functionality

6. **User Feedback**
   - Implement clear console output showing watch status
   - Show notifications on successful syncs
   - Use the improved output system from Feature #1

7. **Testing**
   - Test with different file change scenarios
   - Verify rate limiting works correctly
   - Test conflict resolution strategies
   - Ensure clean process termination

#### Estimated Effort: High (3-5 days)

---

### Feature 5. Build Command for JavaScript Validation

**Objective**: Add a command to validate JavaScript files in workflows for syntax errors and potential issues before pushing to YouTrack.

#### Requirements
- Parse and validate JavaScript syntax
- Detect common errors and potential issues
- Provide helpful error messages with line numbers
- Option to automatically fix certain issues
- Integration with existing workflow commands

#### Implementation Plan

1. **Add Dependencies**
   - Add `esprima` or `acorn` for JavaScript parsing
   - Add `eslint` for static code analysis
   - Consider `typescript` for type checking capabilities

2. **Create ValidationService**
   ```typescript
   // 1. Create a new service
   class ValidationService {
     private eslint: any; // ESLint instance
     private config: ValidationConfig;
     
     constructor(config: ValidationConfig) {
       // Initialize with config
     }
     
     async validateWorkflow(workflowPath: string): Promise<ValidationResult> {
       // Find all JS files in the workflow
       // Validate each file and collect results
     }
     
     async validateFile(filePath: string): Promise<FileValidationResult> {
       // Parse and validate a single JS file
     }
     
     async fixIssues(workflowPath: string): Promise<FixResult> {
       // Attempt to automatically fix issues
     }
   }
   ```

3. **Create Build Command**
   ```typescript
   // 2. Create build.command.ts
   export const buildCommand = async (
     workflows: string[] = [],
     { host = "", token = "", fix = false } = {}
   ): Promise<void> => {
     // Implementation to validate workflows
     // Option to automatically fix issues
   }
   ```

4. **Integration with Existing Commands**
   - Add validation step to `push.command.ts` (optional)
   - Add `--validate` flag to other commands

5. **Error Reporting**
   - Create useful error output format
   - Add visual separation between different types of issues
   - Include line numbers and code snippets in error messages

6. **Testing**
   - Create test workflows with various issues
   - Verify detection of common errors

#### Estimated Effort: Medium-High (3-5 days)

---

### Feature 6. Create Command for New Workflows

**Objective**: Add a command to create new workflows with proper manifest structure and add them to the project, ready to be pushed to YouTrack.

#### Requirements
- Create a new workflow with the provided name
- Generate a valid manifest.json file
- Set up the basic directory structure
- Add the workflow to the project
- Make it ready for pushing to YouTrack

#### Implementation Plan

1. **Create WorkflowTemplateService**
   ```typescript
   // 1. Create a new service
   class WorkflowTemplateService {
     private projectService: ProjectService;
     
     constructor(projectService: ProjectService) {
       this.projectService = projectService;
     }
     
     async createWorkflow(name: string, options: WorkflowOptions): Promise<string> {
       // Generate workflow structure
       // Create manifest.json
       // Set up basic files
     }
     
     private generateManifest(name: string, options: WorkflowOptions): ManifestTemplate {
       // Generate a valid manifest.json structure
     }
     
     private setupWorkflowDirectory(name: string): void {
       // Create workflow directory structure
     }
   }
   ```

2. **Create Command**
   ```typescript
   // 2. Create create.command.ts
   export const createCommand = async (
     workflowName: string,
     { host = "", token = "", description = "", author = "" } = {}
   ): Promise<void> => {
     // Validate workflow name
     // Create workflow structure
     // Add to project
     // Provide success message and next steps
   }
   ```

3. **CLI Integration**
   - Add create command to CLI options
   - Add configuration options for workflow metadata

4. **User Prompts**
   - If description is not provided, prompt for it
   - Prompt for confirmation before creating

5. **Testing**
   - Verify workflow structure meets YouTrack requirements
   - Test pushing newly created workflows to YouTrack

#### Estimated Effort: Medium (2-3 days)

---

### Feature 7. Template Command for Adding Files

**Objective**: Create a command that helps users add new files to workflows based on templates.

#### Requirements
- Interactive workflow selection if not specified
- Template selection from available templates
- File name customization
- Intelligent placement within workflow structure
- Basic variable substitution in templates

#### Implementation Plan

1. **Set Up Template Directory**
   - Create a templates directory with common workflow file templates:
     - Rules
     - Actions
     - Schedules
     - Webhooks

2. **Enhance WorkflowTemplateService**
   ```typescript
   // 1. Enhance the WorkflowTemplateService
   class WorkflowTemplateService {
     // ... existing methods
     
     async getAvailableTemplates(): Promise<TemplateInfo[]> {
       // List available templates with descriptions
     }
     
     async applyTemplate(
       workflowName: string, 
       templateName: string, 
       fileName: string, 
       variables: Record<string, string>
     ): Promise<string> {
       // Apply template with variable substitution
       // Create file in proper location
     }
   }
   ```

3. **Create Template Command**
   ```typescript
   // 2. Create template.command.ts
   export const templateCommand = async (
     workflowName: string = "",
     { host = "", token = "", template = "", filename = "" } = {}
   ): Promise<void> => {
     // Select workflow if not provided
     // Present template options if not specified
     // Prompt for filename if not provided
     // Gather template variables
     // Apply template
   }
   ```

4. **Template Variables**
   - Implement variable substitution system
   - Common variables: workflowName, fileName, date, author

5. **User Feedback**
   - Preview template before applying
   - Show success message with file location

6. **Testing**
   - Verify templates are correctly applied
   - Test with various variable combinations

#### Estimated Effort: Medium (2-3 days)

---

## Implementation Priority

1. Improved Output (Highest priority, enables better UX for other features)
2. Create Command (High priority, fundamental workflow creation capability)
3. Build Command (Medium priority, adds immediate value for error prevention)
4. Template Command (Medium priority, extends workflow creation capabilities)
5. Sync Command (Lower priority, but significant quality-of-life improvement)

## Dependencies and Considerations

- All features should work within the existing architecture
- No external libraries should be added without careful consideration of bundle size
- All new code should follow the established patterns for error handling and separation of concerns
- Tests should be added for all new functionality
- Documentation should be updated to reflect new commands and options
