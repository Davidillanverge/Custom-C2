import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { agentAPI, listenerAPI } from '../services/api';

const StatusBar: React.FC = () => {
  const [agentCount, setAgentCount] = useState(0);
  const [listenerCount, setListenerCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [agents, listeners] = await Promise.all([
          agentAPI.getAgents(),
          listenerAPI.getListeners(),
        ]);
        setAgentCount(agents.length);
        setListenerCount(listeners.length);
        setConnected(true);
      } catch {
        setConnected(false);
      }
    };

    fetchCounts();
    const dataInterval = setInterval(fetchCounts, 30000);
    const timeInterval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const cell = {
    fontSize: '11px',
    color: '#ffffff',
    px: 1.5,
    borderRight: '1px solid #005a9e',
    lineHeight: '22px',
    whiteSpace: 'nowrap' as const,
  };

  return (
    <Box
      sx={{
        height: '22px',
        backgroundColor: '#007acc',
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid #005a9e',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ ...cell, fontWeight: 700 }}>TeamServer C2</Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          borderRight: '1px solid #005a9e',
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: connected ? '#4caf50' : '#f44747',
          }}
        />
        <Typography sx={{ fontSize: '11px', color: '#ffffff' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </Typography>
      </Box>
      <Typography sx={cell}>Agents: {agentCount}</Typography>
      <Typography sx={cell}>Listeners: {listenerCount}</Typography>
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: '11px', color: '#ffffff', px: 1.5 }}>
        {time.toLocaleTimeString()}
      </Typography>
    </Box>
  );
};

export default StatusBar;
