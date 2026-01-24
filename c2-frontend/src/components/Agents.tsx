import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { Computer, PlayArrow, Delete, Visibility } from '@mui/icons-material';
import { agentAPI, Agent } from '../services/api';

const Agents: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await agentAPI.getAgents();
      setAgents(data);
      setError('');
    } catch (err) {
      setError('Failed to load agents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (agentId: number) => {
    try {
      await agentAPI.checkInAgent(agentId);
      setSnackbar({ open: true, message: 'Agent checked in successfully', severity: 'success' });
      loadAgents();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to check in agent', severity: 'error' });
    }
  };

  const handleDelete = async (agentId: number) => {
    console.log('Attempting to delete agent:', agentId);

    try {
      const response = await agentAPI.deleteAgent(agentId);
      console.log('Delete agent response:', response);
      setSnackbar({ open: true, message: 'Agent deleted successfully', severity: 'success' });
      loadAgents();
    } catch (err) {
      console.error('Failed to delete agent:', err);
      setSnackbar({ open: true, message: 'Failed to delete agent', severity: 'error' });
    }
  };

  const getStatusColor = (lastSeen?: string) => {
    if (!lastSeen) return 'default';
    const lastSeenDate = new Date(lastSeen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeenDate > fiveMinutesAgo ? 'success' : 'warning';
  };

  const getStatusText = (lastSeen?: string) => {
    if (!lastSeen) return 'Offline';
    const lastSeenDate = new Date(lastSeen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeenDate > fiveMinutesAgo ? 'Online' : 'Away';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        <Computer sx={{ mr: 1, verticalAlign: 'middle' }} />
        Agent Management
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Process</TableCell>
              <TableCell>PID</TableCell>
              <TableCell>Integrity</TableCell>
              <TableCell>Architecture</TableCell>
              <TableCell>Last Seen</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  Loading agents...
                </TableCell>
              </TableRow>
            ) : agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  No agents connected yet
                </TableCell>
              </TableRow>
            ) : (
              agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>{agent.id}</TableCell>
                  <TableCell>{agent.hostname}</TableCell>
                  <TableCell>{agent.username}</TableCell>
                  <TableCell>{agent.processname}</TableCell>
                  <TableCell>{agent.pid}</TableCell>
                  <TableCell>
                    <Chip
                      label={agent.integrity}
                      color={agent.integrity === 'High' ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{agent.arch}</TableCell>
                  <TableCell>
                    {agent.lastseen ? new Date(agent.lastseen).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusText(agent.lastseen)}
                      color={getStatusColor(agent.lastseen)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        component={Link}
                        to={`/agent/${agent.id}`}
                        size="small"
                        variant="outlined"
                        startIcon={<Visibility />}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<PlayArrow />}
                        onClick={() => handleCheckIn(agent.id)}
                      >
                        Check In
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => handleDelete(agent.id)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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

export default Agents;