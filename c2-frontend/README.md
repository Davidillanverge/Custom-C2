# TeamServer Frontend

A modern React-based web interface for the TeamServer C2 (Command & Control) system.

## Features

- **Dashboard**: Real-time overview of agents and listeners
- **Agent Management**: View, monitor, and control connected agents
- **Task Management**: Send commands and view execution results
- **Listener Management**: Create and manage communication listeners
- **Dark Theme**: Professional C2 interface with dark theme
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **React 19** with TypeScript
- **Material-UI (MUI)** for components
- **React Router** for navigation
- **Axios** for API communication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables (optional):
```bash
# Create .env file in the root directory
REACT_APP_API_URL=http://localhost:5000
```

3. Start the development server:
```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## Usage

### Dashboard
- View real-time statistics of connected agents and listeners
- Monitor agent status and activity
- Quick overview of system health

### Agents Section
- Browse all connected agents with detailed information
- View agent metadata (hostname, username, process, integrity, etc.)
- Check agent online/offline status
- Force agent check-ins
- Delete disconnected agents

### Agent Details
- Detailed view of individual agents
- Send custom commands to agents
- View pending tasks and execution results
- Monitor task completion in real-time

### Listeners Section
- View all active listeners
- Create new HTTP listeners on specific ports
- Stop and remove listeners
- Monitor listener status

## API Integration

The frontend communicates with the TeamServer REST API:

**Agents:**
- `GET /agents/` - List all agents
- `GET /agents/{id}` - Get agent details
- `DELETE /agents/{id}` - Remove agent
- `POST /agents/{id}/checkin` - Force agent check-in
- `POST /agents/{id}/task` - Send task to agent
- `GET /agents/{id}/tasks` - Get agent tasks
- `GET /agents/{id}/results` - Get task results

**Listeners:**
- `GET /listeners/` - List all listeners
- `POST /listeners/create` - Create new listener
- `DELETE /listeners/remove` - Remove listener

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

### Project Structure

```
src/
├── components/          # React components
│   ├── Navbar.tsx      # Navigation bar
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Agents.tsx      # Agent management
│   ├── AgentDetail.tsx # Individual agent view
│   ├── Listeners.tsx   # Listener management
│   └── index.ts        # Component exports
├── services/           # API services
│   └── api.ts          # API client and types
├── App.tsx             # Main app component
└── index.tsx           # App entry point
```

## Security Notes

This is a demonstration implementation. For production use:

- Implement proper authentication
- Add HTTPS communication
- Validate all user inputs
- Add rate limiting
- Use environment variables for sensitive data
- Implement proper error handling and logging

## Prerequisites

- Node.js 16+
- npm or yarn
- Running TeamServer backend (default: http://localhost:5000)