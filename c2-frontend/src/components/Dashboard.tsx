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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Refresh } from '@mui/icons-material';
import { agentAPI, listenerAPI, Agent, Listener } from '../services/api';

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

const PanelHeader: React.FC<{ title: string; count: number; onRefresh: () => void }> = ({
  title,
  count,
  onRefresh,
}) => (
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
      {title} ({count})
    </Typography>
    <Tooltip title="Refresh">
      <IconButton size="small" onClick={onRefresh} sx={{ p: 0.25 }}>
        <Refresh sx={{ fontSize: 14, color: '#858585' }} />
      </IconButton>
    </Tooltip>
  </Box>
);

const Dashboard: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
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
    } catch {
      setError('Failed to connect to TeamServer');
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Agents panel — top 60% */}
      <Box
        sx={{
          flex: '0 0 60%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderBottom: '2px solid #3c3c3c',
        }}
      >
        <PanelHeader title="Agents" count={agents.length} onRefresh={loadData} />
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
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', color: '#555', py: 4, cursor: 'default' }}>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Listeners panel — bottom 40% */}
      <Box sx={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PanelHeader title="Listeners" count={listeners.length} onRefresh={loadData} />
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Host</TableCell>
                <TableCell>Port</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listeners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', color: '#555', py: 2, cursor: 'default' }}>
                    No active listeners
                  </TableCell>
                </TableRow>
              ) : (
                listeners.map((listener) => (
                  <TableRow
                    key={listener.name}
                    sx={{ '&:nth-of-type(odd)': { backgroundColor: '#1e1e1e' }, cursor: 'default' }}
                  >
                    <TableCell sx={{ color: '#4e9af1' }}>{listener.name}</TableCell>
                    <TableCell>{listener.type.toUpperCase()}</TableCell>
                    <TableCell>{listener.host}</TableCell>
                    <TableCell>{listener.port}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                          sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4caf50' }}
                        />
                        <Typography sx={{ fontSize: '11px', color: '#4caf50' }}>Running</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default Dashboard;
