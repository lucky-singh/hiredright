# HiredRight Frontend (`apps/web`)

> React SPA built with Vite, TypeScript, and Tailwind CSS.

## Architecture

- **Routing:** React Router v6
- **State Management:** Zustand (`stores/builder-store.ts`) for complex builder state. TanStack Query for general API fetching (soon).
- **Styling:** Tailwind CSS with a consistent `zinc` base for light/dark mode.
- **UI Components:** Minimal, accessible components (Base UI primitives / Radix inspired).

## Key Routes & URL Parameters

| Route | Purpose | Parameters |
| :--- | :--- | :--- |
| `/login` | Authentication | N/A |
| `/profile` | Candidate dashboard | Hides horizontal role tabs if the user only has 1 active role. Includes "+ Add Role" in the header if a role is active. |
| `/functions` | Role discovery & Resume upload | `?role={code}` skips role selection and jumps directly to the upload prompt for that role. |
| `/builder/:roleCode` | The interactive claim builder | `?reset=true` forces the builder to start at Step 1 instead of resuming from `BuilderProgress.last_area_code`. |
| `/search` | Recruiter matching dashboard | N/A |

## Local Development

```bash
npm install
npm run dev
```

To run tests:
```bash
npm run test
```
