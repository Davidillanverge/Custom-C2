import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, Typography, TextField, IconButton, Tooltip, Alert, Chip } from '@mui/material';
import { ArrowBack, Send, Refresh } from '@mui/icons-material';
import { agentAPI, Agent, Task, TaskResult } from '../services/api';

interface ConsoleEntry {
  key: number;
  type: 'command' | 'output' | 'info' | 'error';
  content: string;
  timestamp: Date;
}

const PREDEFINED_CMDS = [
  'whoami', 'id', 'pwd', 'ls', 'hostname', 'ps', 'uname -a',
  'ifconfig', 'netstat', 'cat /etc/passwd',
];

const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const agentId = parseInt(id!);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const seenResultIds = useRef<Set<number>>(new Set());
  const entryKey = useRef(0);

  const nextKey = () => ++entryKey.current;

  const appendEntry = useCallback((type: ConsoleEntry['type'], content: string) => {
    setEntries((prev) => [
      ...prev,
      { key: nextKey(), type, content, timestamp: new Date() },
    ]);
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [agentData, tasksData, resultsData]: [Agent, Task[], TaskResult[]] = await Promise.all([
        agentAPI.getAgent(agentId),
        agentAPI.getTasks(agentId),
        agentAPI.getResults(agentId),
      ]);

      setAgent(agentData);

      const resultMap = new Map<number, string>(
        resultsData.map((r) => [r.task_id, r.result])
      );
      seenResultIds.current = new Set(resultsData.map((r) => r.task_id));

      const initial: ConsoleEntry[] = [
        {
          key: nextKey(),
          type: 'info',
          content: `Session opened — ${agentData.hostname} / ${agentData.username} / ${agentData.arch} / ${agentData.integrity}`,
          timestamp: new Date(),
        },
      ];

      for (const task of tasksData) {
        initial.push({
          key: nextKey(),
          type: 'command',
          content: [task.command, ...task.arguments].join(' '),
          timestamp: new Date(),
        });
        const result = resultMap.get(task.id);
        if (result !== undefined) {
          initial.push({
            key: nextKey(),
            type: 'output',
            content: result,
            timestamp: new Date(),
          });
        }
      }

      setEntries(initial);
      setLoadError('');
    } catch {
      setLoadError('Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const poll = async () => {
      try {
        const resultsData: TaskResult[] = await agentAPI.getResults(agentId);
        const newEntries: ConsoleEntry[] = [];
        for (const r of resultsData) {
          if (!seenResultIds.current.has(r.task_id)) {
            seenResultIds.current.add(r.task_id);
            newEntries.push({
              key: nextKey(),
              type: 'output',
              content: r.result,
              timestamp: new Date(),
            });
          }
        }
        if (newEntries.length > 0) {
          setEntries((prev) => [...prev, ...newEntries]);
        }
      } catch {}
    };

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  const handleSend = async () => {
    const cmd = command.trim();
    if (!cmd) return;

    const fullCmd = args.trim() ? `${cmd} ${args.trim()}` : cmd;
    appendEntry('command', fullCmd);
    setCommand('');
    setArgs('');

    try {
      await agentAPI.sendTask(agentId, {
        command: cmd,
        arguments: args.trim() ? args.trim().split(/\s+/) : [],
        file: '',
      });
    } catch {
      appendEntry('error', 'Failed to send task to agent');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, color: '#858585', fontFamily: 'monospace', fontSize: 12 }}>
        Connecting to agent {agentId}...
      </Box>
    );
  }

  if (loadError || !agent) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{loadError || 'Agent not found'}</Alert>
      </Box>
    );
  }

  const isOnline =
    !!agent.lastseen &&
    new Date(agent.lastseen) > new Date(Date.now() - 5 * 60 * 1000);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Agent info bar */}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #3c3c3c',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Tooltip title="Back to Agents">
          <IconButton component={Link} to="/agents" size="small" sx={{ p: 0.25, color: '#858585' }}>
            <ArrowBack sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isOnline ? '#4caf50' : '#555',
            }}
          />
          <Typography sx={{ fontSize: '12px', color: '#4e9af1', fontWeight: 700 }}>
            {agent.hostname}/{agent.username}
          </Typography>
        </Box>

        {[
          { label: 'PID', value: String(agent.pid) },
          { label: 'Process', value: agent.processname },
          { label: 'Arch', value: agent.arch },
          { label: 'Integrity', value: agent.integrity },
          {
            label: 'Last Seen',
            value: agent.lastseen ? new Date(agent.lastseen).toLocaleString() : 'Never',
          },
        ].map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Typography sx={{ fontSize: '11px', color: '#555' }}>{label}:</Typography>
            <Typography sx={{ fontSize: '11px', color: '#cccccc' }}>{value}</Typography>
          </Box>
        ))}

        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadData} sx={{ p: 0.25 }}>
            <Refresh sx={{ fontSize: 14, color: '#858585' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Console output */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#0c0c0c',
          p: 1.5,
          fontFamily: '"Consolas", "Courier New", monospace',
          fontSize: '12px',
        }}
      >
        {entries.map((entry) => {
          if (entry.type === 'command') {
            return (
              <Box key={entry.key} sx={{ mb: 0.75 }}>
                <Box component="span" sx={{ color: '#555', fontSize: '11px' }}>
                  [{entry.timestamp.toLocaleTimeString()}]{' '}
                </Box>
                <Box component="span" sx={{ color: '#4e9af1' }}>
                  {agent.username}@{agent.hostname}
                </Box>
                <Box component="span" sx={{ color: '#858585' }}> $ </Box>
                <Box component="span" sx={{ color: '#ffffff' }}>{entry.content}</Box>
              </Box>
            );
          }

          if (entry.type === 'output') {
            return (
              <Box
                key={entry.key}
                sx={{
                  pl: 2,
                  mb: 1,
                  borderLeft: '2px solid #2d2d2d',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    color: '#4caf50',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '12px',
                    fontFamily: '"Consolas", "Courier New", monospace',
                  }}
                >
                  {entry.content}
                </pre>
              </Box>
            );
          }

          if (entry.type === 'error') {
            return (
              <Typography key={entry.key} sx={{ color: '#f44747', fontSize: '11px', mb: 0.5 }}>
                [!] {entry.content}
              </Typography>
            );
          }

          // info
          return (
            <Typography key={entry.key} sx={{ color: '#ddb100', fontSize: '11px', mb: 0.5 }}>
              [*] {entry.content}
            </Typography>
          );
        })}
        <div ref={consoleEndRef} />
      </Box>

      {/* Quick commands */}
      <Box
        sx={{
          px: 1,
          py: 0.5,
          backgroundColor: '#1a1a1a',
          borderTop: '1px solid #3c3c3c',
          display: 'flex',
          gap: 0.5,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {PREDEFINED_CMDS.map((cmd) => (
          <Chip
            key={cmd}
            label={cmd}
            size="small"
            onClick={() => setCommand(cmd)}
            sx={{
              height: '16px',
              fontSize: '10px',
              backgroundColor: '#2d2d2d',
              color: '#9cdcfe',
              borderRadius: '2px',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#3c3c3c' },
            }}
          />
        ))}
      </Box>

      {/* Command input */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.75,
          backgroundColor: '#1a1a1a',
          borderTop: '1px solid #3c3c3c',
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ color: '#4e9af1', fontSize: '12px', whiteSpace: 'nowrap', userSelect: 'none' }}>
          {agent.hostname} $
        </Typography>
        <TextField
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="command"
          variant="outlined"
          size="small"
          sx={{
            width: 180,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#0c0c0c',
              '& fieldset': { borderColor: '#3c3c3c' },
              '&:hover fieldset': { borderColor: '#555' },
              '&.Mui-focused fieldset': { borderColor: '#4e9af1' },
            },
            '& input': { color: '#ffffff', padding: '3px 8px', fontSize: '12px' },
          }}
        />
        <TextField
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="arguments"
          variant="outlined"
          size="small"
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#0c0c0c',
              '& fieldset': { borderColor: '#3c3c3c' },
              '&:hover fieldset': { borderColor: '#555' },
              '&.Mui-focused fieldset': { borderColor: '#4e9af1' },
            },
            '& input': { color: '#ffffff', padding: '3px 8px', fontSize: '12px' },
          }}
        />
        <Tooltip title="Send (Enter)">
          <span>
            <IconButton
              onClick={handleSend}
              disabled={!command.trim()}
              size="small"
              sx={{
                backgroundColor: command.trim() ? '#4e9af1' : '#2d2d2d',
                color: command.trim() ? '#ffffff' : '#555',
                borderRadius: '2px',
                p: 0.5,
                '&:hover': { backgroundColor: '#5ba8ff' },
              }}
            >
              <Send sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default AgentDetail;
