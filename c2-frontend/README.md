# TeamServer C2 — Operator Frontend

React 19 + TypeScript operator UI for the TeamServer C2 framework. MUI v7 dark theme styled after VS Code.

## Features

- **Dashboard** — live overview of connected agents and active listeners, auto-refreshes every 30 s
- **Agents** — full agent table with status indicators, last-seen timestamps, per-agent actions, paginated at 15 rows
- **Agent Console** — terminal-style console with command history (ArrowUp / ArrowDown), quick-command chips, automatic result polling, file download support
- **Listeners** — create and remove HTTP listeners
- **Builder** — patch pre-compiled agent DLLs with listener host / port / sleep / jitter; polls for build status automatically
- **Status bar** — connection state, agent and listener counts (shared via `AppContext`, no duplicate API calls)

## Tech Stack

- React 19 + TypeScript
- Material-UI (MUI) v7
- React Router v6
- Axios

## Setup

```bash
npm install
npm start        # dev server at http://localhost:3000
npm run build    # production build
npm test         # Jest / React Testing Library
```

### Environment

Create a `.env` file in this directory (already committed with default value):

```
REACT_APP_API_URL=http://localhost:8000
```

Change this if the TeamServer runs on a different host or port.

## Routing

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Dashboard` | Split-panel overview — agents (top 60%) + listeners (bottom 40%) |
| `/agents` | `Agents` | Agent table with pagination (15 per page) |
| `/agent/:id` | `AgentDetail` | Terminal console — send tasks, view results |
| `/listeners` | `Listeners` | Manage HTTP listeners |
| `/builder` | `Builder` | Generate patched agent DLLs |

## API Integration

Base URL from `REACT_APP_API_URL` (default `http://localhost:8000`).

**Agents:**
- `GET /agents/` — list all agents (response includes `lastseen`)
- `GET /agents/{id}` — get agent details
- `DELETE /agents/{id}` — remove agent
- `POST /agents/{id}/checkin` — force agent check-in
- `POST /agents/{id}/task` — send task `{command, arguments, file?, file2?, filename?}`
- `GET /agents/{id}/tasks` — get agent tasks
- `GET /agents/{id}/results` — get task results
- `GET /agents/{id}/results/{task_id}/file` — download file result

**Listeners:**
- `GET /listeners/` — list all listeners
- `POST /listeners/create` — create new listener `{name, type, port}`
- `DELETE /listeners/remove` — remove listener `{name}`

**Builder:**
- `GET /builder/check` — DLL availability per architecture
- `GET /builder/` — list all builds
- `POST /builder/` — queue build `{host, port, arch, sleep_ms, jitter_ms}` → `202 Accepted`
- `GET /builder/{id}` — get build status (`pending` → `success` / `failed`)
- `GET /builder/{id}/download` — download patched DLL
- `DELETE /builder/{id}` — delete build

## Project Structure

```
src/
├── App.tsx                    # router wrapped in AppContextProvider
├── theme.ts                   # MUI dark theme
├── context/
│   └── AppContext.tsx          # shared agentCount, listenerCount, connected; polls every 30 s
├── services/
│   └── api.ts                 # agentAPI, listenerAPI, builderAPI + TypeScript interfaces
└── components/
    ├── Dashboard.tsx           # split-panel overview
    ├── Agents.tsx              # paginated agent table
    ├── AgentDetail.tsx         # terminal console; command history; 10 MB file limit
    ├── Listeners.tsx           # listener management
    ├── Builder.tsx             # builder with async status polling
    ├── Sidebar.tsx             # navigation
    ├── Navbar.tsx              # top navigation bar
    └── StatusBar.tsx           # reads from AppContext
```
