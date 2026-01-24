import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Breadcrumbs,
} from '@mui/material';
import { ArrowBack, Send, Computer } from '@mui/icons-material';
import { agentAPI, Agent, Task, TaskResult } from '../services/api';

const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const agentId = parseInt(id!);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Task form state
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');

  useEffect(() => {
    loadAgentData();
  }, [agentId]);

  const loadAgentData = async () => {
    try {
      setLoading(true);
      const [agentData, tasksData, resultsData] = await Promise.all([
        agentAPI.getAgent(agentId),
        agentAPI.getTasks(agentId),
        agentAPI.getResults(agentId),
      ]);
      setAgent(agentData);
      setTasks(tasksData);
      setResults(resultsData);
      setError('');
    } catch (err) {
      setError('Failed to load agent data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTask = async () => {
    if (!command.trim()) return;

    try {
      const taskData = {
        command: command.trim(),
        arguments: args.trim() ? args.split(' ') : [],
        file: '',
      };

      await agentAPI.sendTask(agentId, taskData);
      setSnackbar({ open: true, message: 'Task sent successfully', severity: 'success' });
      setCommand('');
      setArgs('');

      // Reload data to show new task
      setTimeout(() => loadAgentData(), 1000);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to send task', severity: 'error' });
    }
  };

  const predefinedCommands = [
    'whoami',
    'pwd',
    'ls',
    'ps',
    'hostname',
    'id',
    'uname -a',
    'ifconfig',
    'netstat',
    'cat /etc/passwd',
    'cat /etc/shadow',
  ];

  if (loading) {
    return <Typography>Loading agent details...</Typography>;
  }

  if (error || !agent) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Agent not found'}
        </Alert>
        <Button component={Link} to="/agents" startIcon={<ArrowBack />}>
          Back to Agents
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          Dashboard
        </Link>
        <Link to="/agents" style={{ textDecoration: 'none', color: 'inherit' }}>
          Agents
        </Link>
        <Typography color="textPrimary">Agent {agent.id}</Typography>
      </Breadcrumbs>

      <Typography variant="h4" gutterBottom>
        <Computer sx={{ mr: 1, verticalAlign: 'middle' }} />
        Agent {agent.id} Details
      </Typography>

      {/* Agent Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">Hostname</Typography>
              <Typography variant="h6">{agent.hostname}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">Username</Typography>
              <Typography variant="h6">{agent.username}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">Process</Typography>
              <Typography variant="h6">{agent.processname}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">PID</Typography>
              <Typography variant="h6">{agent.pid}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">Integrity</Typography>
              <Chip
                label={agent.integrity}
                color={agent.integrity === 'High' ? 'success' : 'warning'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">Architecture</Typography>
              <Typography variant="h6">{agent.arch}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">Last Seen</Typography>
              <Typography variant="h6">
                {agent.lastseen ? new Date(agent.lastseen).toLocaleString() : 'Never'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="textSecondary">Status</Typography>
              <Chip
                label={agent.lastseen ? 'Online' : 'Offline'}
                color={agent.lastseen ? 'success' : 'default'}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Send Task */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Send Task
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command (e.g., whoami, ls, pwd)"
                helperText="Type any command or select from suggestions"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Arguments (optional)"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="Command arguments separated by spaces"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<Send />}
                onClick={handleSendTask}
                disabled={!command.trim()}
              >
                Send Task
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tasks and Results */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pending Tasks
              </Typography>
              <TableContainer component={Paper} sx={{ backgroundColor: 'background.paper' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Command</TableCell>
                      <TableCell>Arguments</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>{task.id}</TableCell>
                        <TableCell>{task.command}</TableCell>
                        <TableCell>{task.arguments.join(' ')}</TableCell>
                      </TableRow>
                    ))}
                    {tasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          No pending tasks
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Task Results
              </Typography>
              <TableContainer component={Paper} sx={{ backgroundColor: 'background.paper' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Task ID</TableCell>
                      <TableCell>Result</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.task_id}>
                        <TableCell>{result.task_id}</TableCell>
                        <TableCell>
                          <Box sx={{ maxHeight: 100, overflow: 'auto' }}>
                            <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                              {result.result}
                            </pre>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {results.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} align="center">
                          No task results yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AgentDetail;