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
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Visibility, PlayArrow, Delete, Refresh } from '@mui/icons-material';
import { agentAPI, Agent } from '../services/api';

const StatusDot: React.FC<{ lastseen?: string }> = ({ lastseen }) => {
  const color = !lastseen
    ? '#555'
    : new Date(lastseen) > new Date(Date.now() - 5 * 60 * 1000)
    ? '#4caf50'
    : '#ddb100';
  return (
    <Box
      component="span"
      sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color }}
    />
  );
};

const Agents: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setAgents(await agentAPI.getAgents());
      setError('');
    } catch {
      setError('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.MouseEvent, agentId: number) => {
    e.stopPropagation();
    try {
      await agentAPI.checkInAgent(agentId);
      setSnackbar({ open: true, message: 'Check-in sent', severity: 'success' });
      loadAgents();
    } catch {
      setSnackbar({ open: true, message: 'Failed to check in', severity: 'error' });
    }
  };

  const handleDelete = async (e: React.MouseEvent, agentId: number) => {
    e.stopPropagation();
    try {
      await agentAPI.deleteAgent(agentId);
      setSnackbar({ open: true, message: 'Agent removed', severity: 'success' });
      loadAgents();
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove agent', severity: 'error' });
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #3c3c3c',
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#9cdcfe',
            flex: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Agents ({agents.length})
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadAgents} sx={{ p: 0.25 }}>
            <Refresh sx={{ fontSize: 14, color: '#858585' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 20 }} />
              <TableCell>ID</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Process</TableCell>
              <TableCell>PID</TableCell>
              <TableCell>Arch</TableCell>
              <TableCell>Integrity</TableCell>
              <TableCell>Last Seen</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', color: '#555', cursor: 'default' }}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', color: '#555', py: 4, cursor: 'default' }}>
                  No agents connected
                </TableCell>
              </TableRow>
            ) : (
              agents.map((agent) => (
                <TableRow
                  key={agent.id}
                  onClick={() => navigate(`/agent/${agent.id}`)}
                  sx={{ '&:nth-of-type(odd)': { backgroundColor: '#1e1e1e' } }}
                >
                  <TableCell>
                    <StatusDot lastseen={agent.lastseen} />
                  </TableCell>
                  <TableCell>{agent.id}</TableCell>
                  <TableCell sx={{ color: '#4e9af1' }}>{agent.hostname}</TableCell>
                  <TableCell>{agent.username}</TableCell>
                  <TableCell sx={{ color: '#9cdcfe' }}>{agent.processname}</TableCell>
                  <TableCell>{agent.pid}</TableCell>
                  <TableCell>{agent.arch}</TableCell>
                  <TableCell
                    sx={{ color: agent.integrity === 'High' ? '#4caf50' : '#ddb100' }}
                  >
                    {agent.integrity}
                  </TableCell>
                  <TableCell sx={{ color: '#858585' }}>
                    {agent.lastseen ? new Date(agent.lastseen).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <Tooltip title="Interact">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/agent/${agent.id}`)}
                          sx={{ p: 0.25 }}
                        >
                          <Visibility sx={{ fontSize: 14, color: '#9cdcfe' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Force Check-In">
                        <IconButton
                          size="small"
                          onClick={(e) => handleCheckIn(e, agent.id)}
                          sx={{ p: 0.25 }}
                        >
                          <PlayArrow sx={{ fontSize: 14, color: '#4caf50' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          onClick={(e) => handleDelete(e, agent.id)}
                          sx={{ p: 0.25 }}
                        >
                          <Delete sx={{ fontSize: 14, color: '#f44747' }} />
                        </IconButton>
                      </Tooltip>
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
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Agents;
