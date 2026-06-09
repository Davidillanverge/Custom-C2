# TeamServer C2 — Operator Frontend

React 19 + TypeScript operator UI for the TeamServer C2 framework. MUI v7 dark theme styled after VS Code.

## Features

- **Login gate** — optional token prompt when `REACT_APP_AUTH_REQUIRED=true`; token stored in `sessionStorage`; auto-logout on 401
- **Dashboard** — live overview of connected agents and active listeners, data from `AppContext` (no duplicate calls)
- **Agents** — full agent table with status indicators, last-seen timestamps, per-agent actions, paginated at 15 rows; page auto-clamped after removals
- **Agent Console** — terminal-style console with command history (ArrowUp / ArrowDown), quick-command chips with argument hints, automatic result polling, waiting indicator (⌛) per in-flight task, session reload separator, file download support
- **Listeners** — create and remove HTTP listeners; dialog locked against backdrop/escape while request is in flight
- **Builder** — patch pre-compiled agent DLLs with listener host / port / sleep / jitter; polls for build status automatically; dialog locked while submitting
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

Create a `.env` file in this directory:

```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_AUTH_REQUIRED=false
```

Set `REACT_APP_AUTH_REQUIRED=true` and enter the same token as `TEAMSERVER_TOKEN` on the server to enable the login screen.

## Authentication

When `REACT_APP_AUTH_REQUIRED=true`, the app renders a login screen before any route. Entering the correct token:
1. Stores it in `sessionStorage`
2. Sets `Authorization: Bearer <token>` as the default Axios header
3. Marks the `AuthContext` as authenticated

A global 401 response interceptor clears the token and returns to the login screen automatically.

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
- `POST /agents/{id}/task` — send task `{command, arguments, file?, file2?, filename?}` → `{message, task_id}`
- `GET /agents/{id}/tasks` — get agent tasks
- `GET /agents/{id}/results` — get task results
- `GET /agents/{id}/results/{task_id}/file` — download file result

**Listeners:**
- `GET /listeners/` — list all listeners
- `POST /listeners/create` — create new listener `{name, type, port}` → `409` on duplicate name or port in use
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
├── App.tsx                    # AuthProvider → Login gate → AppContextProvider + Router
├── theme.ts                   # MUI dark theme
├── context/
│   ├── AppContext.tsx          # agents[], listeners[], counts; adaptive polling (5s/30s)
│   └── AuthContext.tsx         # isAuthenticated, login, logout; c2:unauthorized listener
├── services/
│   └── api.ts                 # agentAPI, listenerAPI, builderAPI; setAuthToken; 401 interceptor
└── components/
    ├── Login.tsx               # token prompt (shown when REACT_APP_AUTH_REQUIRED=true)
    ├── Dashboard.tsx           # split-panel overview — reads agents/listeners from AppContext
    ├── Agents.tsx              # paginated agent table; page clamped on removal
    ├── AgentDetail.tsx         # terminal console; waiting indicator; session separator; arg hints
    ├── Listeners.tsx           # listener management; dialog locked while submitting
    ├── Builder.tsx             # builder with async status polling; dialog locked while submitting
    ├── Sidebar.tsx             # navigation
    ├── Navbar.tsx              # top navigation bar
    └── StatusBar.tsx           # reads from AppContext
```
