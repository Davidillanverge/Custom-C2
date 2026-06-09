import axios from 'axios';

export interface Agent {
  id: number;
  hostname: string;
  username: string;
  processname: string;
  pid: number;
  integrity: string;
  arch: string;
  lastseen?: string;
}

export interface Task {
  id: number;
  command: string;
  arguments: string[];
  file?: string;
  file2?: string;
  filename?: string;
}

export interface TaskResult {
  task_id: number;
  result: string;
  created_at?: string;
}

export function isFileResult(result: string): boolean {
  return result.startsWith('FILE:');
}

export function parseFileResult(result: string): { filename: string } | null {
  const parts = result.split(':', 3);
  if (parts.length !== 3 || parts[0] !== 'FILE') return null;
  return { filename: parts[1] };
}

export interface Listener {
  type: string;
  name: string;
  host: string;
  port: number;
}

export type BuildArch   = 'x64' | 'x86' | 'ARM64';
export type BuildStatus = 'pending' | 'running' | 'success' | 'failed';

export interface BuildRequest {
  host:      string;
  port:      number;
  arch:      BuildArch;
  sleep_ms:  number;
  jitter_ms: number;
}

export interface Build {
  id:          string;
  host:        string;
  port:        number;
  arch:        BuildArch;
  sleep_ms:    number;
  jitter_ms:   number;
  status:      BuildStatus;
  created_at:  string;
  finished_at: string | null;
  error_log:   string;
}

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// ── Auth helpers ─────────────────────────────────────────────────────────────

export function setAuthToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem('c2_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    sessionStorage.removeItem('c2_token');
    delete api.defaults.headers.common['Authorization'];
  }
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem('c2_token');
}

// Re-apply stored token on module load (page refresh)
const _storedToken = getStoredToken();
if (_storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${_storedToken}`;
}

// ── Global error interceptor ─────────────────────────────────────────────────

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      window.dispatchEvent(new Event('c2:unauthorized'));
    }
    return Promise.reject(error);
  },
);

// ── Agent API ─────────────────────────────────────────────────────────────────

export const agentAPI = {
  getAgents: () => api.get('/agents/').then(res => res.data.agents as Agent[]),

  getAgent: (id: number) => api.get(`/agents/${id}`).then(res => res.data as Agent),

  deleteAgent: (id: number) => api.delete(`/agents/${id}`),

  checkInAgent: (id: number) => api.post(`/agents/${id}/checkin`),

  checkOutAgent: (id: number) => api.post(`/agents/${id}/checkout`),

  sendTask: (
    agentId: number,
    task: { command: string; arguments: string[]; file?: string; file2?: string; filename?: string },
  ) =>
    api
      .post(`/agents/${agentId}/task`, task, { timeout: 120_000 })
      .then(r => r.data as { message: string; task_id: number }),

  getTasks: (agentId: number) =>
    api.get(`/agents/${agentId}/tasks`).then(res => res.data.tasks as Task[]),

  getResults: (agentId: number) =>
    api.get(`/agents/${agentId}/results`).then(res => res.data.results as TaskResult[]),

  getResult: (agentId: number, taskId: number) =>
    api.get(`/agents/${agentId}/results/${taskId}`).then(res => res.data as TaskResult),

  downloadFileUrl: (agentId: number, taskId: number): string =>
    `${BASE_URL}/agents/${agentId}/results/${taskId}/file`,
};

// ── Listener API ──────────────────────────────────────────────────────────────

export const listenerAPI = {
  getListeners: () =>
    api.get('/listeners/').then(res => (res.data || res) as Listener[]),

  getListener: (name: string) =>
    api.get(`/listeners/${name}`).then(res => res.data as Listener),

  createListener: (listener: { name: string; type: string; port: number }) =>
    api.post('/listeners/create', listener),

  removeListener: (name: string) =>
    api.delete('/listeners/remove', { data: { name } }),
};

// ── Builder API ───────────────────────────────────────────────────────────────

export interface BuilderCheck {
  available: boolean;
  archs: Record<BuildArch, boolean>;
}

export const builderAPI = {
  check: () =>
    api.get('/builder/check').then(r => r.data as BuilderCheck),

  getBuilds: () =>
    api.get('/builder/').then(r => r.data as Build[]),

  createBuild: (req: BuildRequest) =>
    api.post('/builder/', req).then(r => r.data as Build),

  getBuild: (id: string) =>
    api.get(`/builder/${id}`).then(r => r.data as Build),

  deleteBuild: (id: string) =>
    api.delete(`/builder/${id}`),

  downloadUrl: (id: string): string =>
    `${BASE_URL}/builder/${id}/download`,
};

export default api;
