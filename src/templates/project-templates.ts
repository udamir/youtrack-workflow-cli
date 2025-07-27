/**
 * Templates for project initialization files
 */

export interface ProjectConfig {
  projectName: string;
  baseUrl: string;
  token: string;
  useTypeScript: boolean;
}

export const PROJECT_TEMPLATES = {
  /**
   * Generate .env file content
   */
  env: (baseUrl: string, token: string): string => `YOUTRACK_BASE_URL=${baseUrl}\nYOUTRACK_TOKEN=${token}\n`,

  /**
   * Generate package.json content
   */
  packageJson: (projectName: string, useTypeScript: boolean): object => ({
    name: projectName,
    version: "1.0.0",
    description: `YouTrack workflows for ${projectName}`,
    main: "index.js",
    scripts: {
      sync: "ytw sync",
      ...(useTypeScript ? { check: "ytw lint --type-check" } : { check: "ytw lint" }),
    },
    repository: {
      type: "git",
      url: "",
    },
    author: "",
    license: "ISC",
    ytw: {
      linting: {
        enableEslint: true,
        enableTypeCheck: useTypeScript,
        maxWarnings: 5
      },
      typesFolder: "./types"
    },
    dependencies: {
      "@jetbrains/youtrack-scripting": "^0.2.1",
      "@jetbrains/youtrack-scripting-api": "^2022.1.46592",
    },
    devDependencies: {
      dotenv: '^17.0.1',
      eslint: '^9.28.0',
      'youtrack-workflow-cli': '^1.0.4',
      ...(useTypeScript && {
        typescript: "^5.8.3",
        "youtrack-workflow-api-types": "^0.1.3",
      }),
    },
  }),

  /**
   * Generate tsconfig.json content
   */
  tsconfig: (): object => ({
    compilerOptions: {
      checkJs: true,
      allowJs: true,
      resolveJsonModule: true,
      moduleResolution: "node",
      target: "es2021",
      module: "commonjs",
      lib: ["es2021", "dom"],
      declaration: true,
      outDir: "./dist",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      allowSyntheticDefaultImports: true,
      typeRoots: ["./node_modules/@types", "./types"],
      baseUrl: ".",
      paths: {
        "@jetbrains/youtrack-scripting-api": ["node_modules/youtrack-workflow-api-types"],
        "@jetbrains/youtrack-scripting-api/*": ["node_modules/youtrack-workflow-api-types/*"],
      },
    },
    include: ["**/*.js"],
    exclude: ["node_modules"],
  }),

  /**
   * Generate eslint.config.cjs content
   */
  eslintConfig: (): string => `const js = require("@eslint/js")

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "no-console": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]`,



  /**
   * Generate .gitignore content
   */
  gitignore: (): string => `# Node.js dependencies
node_modules/

# Environment variables
.env
.env.*

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Compiled output
build/
dist/

# Coverage directory
coverage/
.nyc_output/

# Optional caches
.npm/
.eslintcache

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db`,

  /**
   * Generate README.md content
   */
  readme: (projectName: string): string => `# ${projectName}

YouTrack workflows for ${projectName}

## Setup

1. Install dependencies: \`npm install\`
2. Get permanent token from your YouTrack instance (Profile → Authentication → New Token)
3. Create \`.env\` file with your credentials:
   \`\`\`env
   YOUTRACK_BASE_URL=https://your-youtrack-instance.com
   YOUTRACK_TOKEN=perm:your-permanent-token-here
   \`\`\`
4. Verify setup: \`npx ytw list\`

## Usage

- **Add new workflow**: \`npx ytw add\`
- **Sync workflows**: \`npx ytw sync\`
- **Push changes**: \`npx ytw push\`
- **Pull from YouTrack**: \`npx ytw pull\`
- **Watch for changes**: \`npx ytw sync --watch\`

## TypeScript Support

Generate YouTrack type definitions for your project:

\`\`\`bash
npx ytw types
\`\`\`

This creates TypeScript definitions in the \`types\` directory that can be used via JSDoc annotations:

\`\`\`js
/** @import { Issue, Project } from '../types/youtrack' */
\`\`\`

## Scripts

- \`npm run sync\` - Sync workflows with YouTrack
- \`npm run check\` - Lint and type check
`
};
