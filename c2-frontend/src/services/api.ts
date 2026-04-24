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
}

export interface TaskResult {
  task_id: number;
  result: string;
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
  host: string;
  port: number;
  arch: BuildArch;
}

export interface Build {
  id:          string;
  host:        string;
  port:        number;
  arch:        BuildArch;
  status:      BuildStatus;
  created_at:  string;
  finished_at: string | null;
  error_log:   string;
}

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
});

export const agentAPI = {
  getAgents: () => api.get('/agents/').then(res => res.data.agents),

  getAgent: (id: number) => api.get(`/agents/${id}`).then(res => res.data),

  deleteAgent: (id: number) => api.delete(`/agents/${id}`),

  checkInAgent: (id: number) => api.post(`/agents/${id}/checkin`),

  checkOutAgent: (id: number) => api.post(`/agents/${id}/checkout`),

  sendTask: (agentId: number, task: { command: string; arguments: string[]; file?: string }) =>
    api.post(`/agents/${agentId}/task`, task),

  getTasks: (agentId: number) => api.get(`/agents/${agentId}/tasks`).then(res => res.data.tasks),

  getResults: (agentId: number) => api.get(`/agents/${agentId}/results`).then(res => res.data.results),

  getResult: (agentId: number, taskId: number) =>
    api.get(`/agents/${agentId}/results/${taskId}`).then(res => res.data),
};

export const listenerAPI = {
  getListeners: () => api.get('/listeners/').then(res => res.data || res),

  getListener: (name: string) => api.get(`/listeners/${name}`).then(res => res.data),

  createListener: (listener: { name: string; type: string; port: number }) =>
    api.post('/listeners/create', listener),

  removeListener: (name: string) => api.delete('/listeners/remove', { data: { name } }),
};

export const builderAPI = {
  getBuilds: () =>
    api.get('/builder/').then(r => r.data as Build[]),

  createBuild: (req: BuildRequest) =>
    api.post('/builder/', req).then(r => r.data as Build),

  getBuild: (id: string) =>
    api.get(`/builder/${id}`).then(r => r.data as Build),

  deleteBuild: (id: string) =>
    api.delete(`/builder/${id}`),

  downloadUrl: (id: string): string =>
    `http://localhost:8000/builder/${id}/download`,
};

export default api;