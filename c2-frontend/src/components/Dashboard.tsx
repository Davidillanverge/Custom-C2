import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import { Computer, Router, Assignment, Wifi } from '@mui/icons-material';
import { agentAPI, listenerAPI, Agent, Listener } from '../services/api';

const Dashboard: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [agentsData, listenersData] = await Promise.all([
        agentAPI.getAgents(),
        listenerAPI.getListeners(),
      ]);
      setAgents(agentsData);
      setListeners(listenersData);
      setError('');
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    }
  };

  const activeAgents = agents.filter(agent => agent.lastseen);
  const onlineAgents = agents.filter(agent => {
    if (!agent.lastseen) return false;
    const lastSeen = new Date(agent.lastseen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeen > fiveMinutesAgo;
  });

  const pendingTasks = agents.reduce((total, agent) => {
    // This is approximate since we don't have real-time task counts
    return total + (agent.lastseen ? 1 : 0);
  }, 0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Command & Control Dashboard
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Agents
                  </Typography>
                  <Typography variant="h4">{activeAgents.length}</Typography>
                </Box>
                <Computer color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Online Agents
                  </Typography>
                  <Typography variant="h4">{onlineAgents.length}</Typography>
                </Box>
                <Wifi color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Listeners
                  </Typography>
                  <Typography variant="h4">{listeners.length}</Typography>
                </Box>
                <Router color="secondary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending Tasks
                  </Typography>
                  <Typography variant="h4">{pendingTasks}</Typography>
                </Box>
                <Assignment color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Agents Overview */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Agents
              </Typography>
              <TableContainer component={Paper} sx={{ backgroundColor: 'background.paper' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Hostname</TableCell>
                      <TableCell>Username</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {agents.slice(0, 5).map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>{agent.hostname}</TableCell>
                        <TableCell>{agent.username}</TableCell>
                        <TableCell>
                          <Chip
                            label={agent.lastseen ? 'Online' : 'Offline'}
                            color={agent.lastseen ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {agents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          No agents connected
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
                Active Listeners
              </Typography>
              <Box>
                {listeners.map((listener) => (
                  <Box key={listener.name} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle1">{listener.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {listener.type.toUpperCase()} • {listener.host}:{listener.port}
                    </Typography>
                    <Chip label="Running" color="success" size="small" sx={{ mt: 1 }} />
                  </Box>
                ))}
                {listeners.length === 0 && (
                  <Typography color="textSecondary">
                    No active listeners. Create one in the Listeners section.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;