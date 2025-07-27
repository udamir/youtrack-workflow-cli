# test123

YouTrack workflows for test123

## Setup

1. Install dependencies: `npm install`
2. Get permanent token from your YouTrack instance (Profile → Authentication → New Token)
3. Create `.env` file with your credentials:
   ```env
   YOUTRACK_BASE_URL=https://your-youtrack-instance.com
   YOUTRACK_TOKEN=perm:your-permanent-token-here
   ```
4. Verify setup: `npx ytw list`

## Usage

- **Add new workflow**: `npx ytw add`
- **Sync workflows**: `npx ytw sync`
- **Push changes**: `npx ytw push`
- **Pull from YouTrack**: `npx ytw pull`
- **Watch for changes**: `npx ytw sync --watch`

## TypeScript Support

Custom types can be defined in the `types` directory and used via JSDoc annotations:

```js
/** @import { Issue } from '../types/customTypes' */
```

## Scripts

- `npm run sync` - Sync workflows with YouTrack
- `npm run check` - Type check (TypeScript projects only)
