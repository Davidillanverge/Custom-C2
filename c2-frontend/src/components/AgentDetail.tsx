import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, Typography, TextField, IconButton, Tooltip, Alert, Chip, Button } from '@mui/material';
import { ArrowBack, Send, Refresh, Download as DownloadIcon, AttachFile, Clear } from '@mui/icons-material';
import { agentAPI, Agent, Task, TaskResult, isFileResult, parseFileResult } from '../services/api';

interface ConsoleEntry {
  key: number;
  type: 'command' | 'output' | 'info' | 'error' | 'download' | 'waiting' | 'separator';
  content: string;
  timestamp: Date;
  taskId?: number;
  filename?: string;
}

interface CmdHint { cmd: string; argHint?: string }

const PREDEFINED_CMDS: CmdHint[] = [
  { cmd: 'whoami' },
  { cmd: 'id' },
  { cmd: 'pwd' },
  { cmd: 'ls',          argHint: '<path>' },
  { cmd: 'hostname' },
  { cmd: 'ps' },
  { cmd: 'uname -a' },
  { cmd: 'ifconfig' },
  { cmd: 'netstat' },
  { cmd: 'cat /etc/passwd' },
  { cmd: 'download',    argHint: '<remote path>' },
  { cmd: 'upload',      argHint: '<dest path>' },
  { cmd: 'make_token' },
  { cmd: 'steal_token', argHint: '<pid>' },
  { cmd: 'rev2self' },
  { cmd: 'set_sleep' },
  { cmd: 'inline-assembly' },
  { cmd: 'bof',         argHint: '<arg1> <arg2>…' },
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

  const [selectedFile, setSelectedFile] = useState<{ name: string; base64: string } | null>(null);
  const [selectedFile2, setSelectedFile2] = useState<{ name: string; base64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const [makeTokenFields, setMakeTokenFields] = useState({ username: '', domain: '', password: '' });
  const [sleepFields, setSleepFields] = useState({ interval: '5000', jitter: '1000' });

  const consoleEndRef   = useRef<HTMLDivElement>(null);
  const seenResultIds   = useRef<Set<number>>(new Set());
  const entryKey        = useRef(0);
  const historyRef      = useRef<Array<{ cmd: string; args: string }>>([]);
  const historyIdxRef   = useRef(-1);
  const isInitialLoad   = useRef(true);

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

      const initial: ConsoleEntry[] = [];

      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        initial.push({
          key: nextKey(),
          type: 'info',
          content: `Session opened — ${agentData.hostname} / ${agentData.username} / ${agentData.arch} / ${agentData.integrity}`,
          timestamp: new Date(),
        });
      } else {
        initial.push({
          key: nextKey(),
          type: 'separator',
          content: '— session reloaded —',
          timestamp: new Date(),
        });
      }

      for (const task of tasksData) {
        const fileTag = task.filename ? ` [${task.filename}]` : '';
        initial.push({
          key: nextKey(),
          type: 'command',
          content: [task.command, ...task.arguments].join(' ') + fileTag,
          timestamp: new Date(),
        });
        const result = resultMap.get(task.id);
        if (result !== undefined) {
          if (isFileResult(result)) {
            const parsed = parseFileResult(result);
            initial.push({
              key: nextKey(),
              type: 'download',
              content: result,
              timestamp: new Date(),
              taskId: task.id,
              filename: parsed?.filename,
            });
          } else {
            initial.push({
              key: nextKey(),
              type: 'output',
              content: result,
              timestamp: new Date(),
            });
          }
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
            if (isFileResult(r.result)) {
              const parsed = parseFileResult(r.result);
              newEntries.push({
                key: nextKey(),
                type: 'download',
                content: r.result,
                timestamp: new Date(),
                taskId: r.task_id,
                filename: parsed?.filename,
              });
            } else {
              newEntries.push({
                key: nextKey(),
                type: 'output',
                content: r.result,
                timestamp: new Date(),
              });
            }
          }
        }
        if (newEntries.length > 0) {
          const arrivedIds = new Set(newEntries.map(e => e.taskId).filter(Boolean));
          setEntries((prev) => {
            // Remove 'waiting' entries for tasks that now have results
            const filtered = prev.filter(e => !(e.type === 'waiting' && e.taskId != null && arrivedIds.has(e.taskId)));
            return [...filtered, ...newEntries];
          });
        }
      } catch (e) {
        console.warn('Results poll failed:', e);
      }
    };

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  const handleSend = async () => {
    const cmd = command.trim();
    if (!cmd) return;

    if ((cmd === 'upload' || cmd === 'inline-assembly' || cmd === 'bof') && !selectedFile) {
      appendEntry('error', `Select a file before sending the ${cmd} command`);
      return;
    }
    if (cmd === 'make_token' && (!makeTokenFields.username || !makeTokenFields.password)) {
      appendEntry('error', 'Username and password are required for make_token');
      return;
    }

    let displayCmd: string;
    let taskArguments: string[];

    if (cmd === 'make_token') {
      displayCmd = `make_token ${makeTokenFields.username} ${makeTokenFields.domain || '.'} ***`;
      taskArguments = [makeTokenFields.username, makeTokenFields.domain || '.', makeTokenFields.password];
    } else if (cmd === 'set_sleep') {
      displayCmd = `set_sleep ${sleepFields.interval} ${sleepFields.jitter}`;
      taskArguments = [sleepFields.interval, sleepFields.jitter];
    } else {
      const filePart = selectedFile ? ` [${selectedFile.name}]` : '';
      const file2Part = selectedFile2 ? ` [${selectedFile2.name}]` : '';
      displayCmd = `${cmd}${args.trim() ? ' ' + args.trim() : ''}${filePart}${file2Part}`;
      taskArguments = args.trim() ? args.trim().split(/\s+/) : [];
      historyRef.current.unshift({ cmd, args: args.trim() });
      if (historyRef.current.length > 100) historyRef.current.pop();
    }
    historyIdxRef.current = -1;

    appendEntry('command', displayCmd);
    setCommand('');
    setArgs('');
    setSelectedFile(null);
    setSelectedFile2(null);
    setMakeTokenFields({ username: '', domain: '', password: '' });
    setSleepFields({ interval: '5000', jitter: '1000' });

    try {
      const { task_id } = await agentAPI.sendTask(agentId, {
        command: cmd,
        arguments: taskArguments,
        file: selectedFile?.base64 ?? '',
        file2: selectedFile2?.base64 ?? '',
        filename: selectedFile?.name ?? '',
      });
      setEntries(prev => [
        ...prev,
        { key: nextKey(), type: 'waiting', content: 'Waiting for result…', timestamp: new Date(), taskId: task_id },
      ]);
    } catch {
      appendEntry('error', 'Failed to send task to agent');
    }
  };

  const handleCommandChange = (value: string) => {
    setCommand(value);
    if (value !== 'upload' && value !== 'inline-assembly' && value !== 'bof') setSelectedFile(null);
    if (value !== 'bof') setSelectedFile2(null);
    if (value !== 'make_token') setMakeTokenFields({ username: '', domain: '', password: '' });
    if (value !== 'set_sleep') setSleepFields({ interval: '5000', jitter: '1000' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      appendEntry('error', `File too large: ${file.name} (max 10 MB)`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setSelectedFile({ name: file.name, base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFileSelect2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      appendEntry('error', `File too large: ${file.name} (max 10 MB)`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setSelectedFile2({ name: file.name, base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
      return;
    }
    const history = historyRef.current;
    if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const newIdx = Math.min(historyIdxRef.current + 1, history.length - 1);
      historyIdxRef.current = newIdx;
      const entry = history[newIdx];
      handleCommandChange(entry.cmd);
      setArgs(entry.args);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = historyIdxRef.current - 1;
      if (newIdx < 0) {
        historyIdxRef.current = -1;
        handleCommandChange('');
        setArgs('');
      } else {
        historyIdxRef.current = newIdx;
        const entry = history[newIdx];
        handleCommandChange(entry.cmd);
        setArgs(entry.args);
      }
    }
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

          if (entry.type === 'download') {
            return (
              <Box
                key={entry.key}
                sx={{
                  pl: 2,
                  mb: 1,
                  borderLeft: '2px solid #2d2d2d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <DownloadIcon sx={{ fontSize: 14, color: '#4e9af1' }} />
                <Typography sx={{ fontSize: '12px', color: '#cccccc' }}>
                  {entry.filename}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  href={agentAPI.downloadFileUrl(agentId, entry.taskId!)}
                  download={entry.filename}
                  sx={{
                    fontSize: '10px',
                    py: 0,
                    px: 1,
                    minWidth: 0,
                    borderColor: '#4e9af1',
                    color: '#4e9af1',
                    textTransform: 'none',
                    '&:hover': { borderColor: '#5ba8ff', color: '#5ba8ff' },
                  }}
                >
                  Save
                </Button>
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

          if (entry.type === 'waiting') {
            return (
              <Typography key={entry.key} sx={{ color: '#555', fontSize: '11px', mb: 0.5, fontStyle: 'italic' }}>
                ⌛ {entry.content}
              </Typography>
            );
          }

          if (entry.type === 'separator') {
            return (
              <Box key={entry.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1, opacity: 0.4 }}>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: '#3c3c3c' }} />
                <Typography sx={{ color: '#555', fontSize: '10px', whiteSpace: 'nowrap' }}>{entry.content}</Typography>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: '#3c3c3c' }} />
              </Box>
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
        {PREDEFINED_CMDS.map(({ cmd, argHint }) => (
          <Tooltip key={cmd} title={argHint ? `args: ${argHint}` : ''} placement="top">
            <Chip
              label={cmd}
              size="small"
              onClick={() => handleCommandChange(cmd)}
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
          </Tooltip>
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
          onChange={(e) => handleCommandChange(e.target.value)}
          onKeyDown={handleCommandKeyDown}
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
        {command.trim() === 'set_sleep' ? (
          <>
            {([
              { key: 'interval', label: 'interval (ms)' },
              { key: 'jitter',   label: 'jitter (ms)'   },
            ] as const).map(({ key, label }) => (
              <TextField
                key={key}
                value={sleepFields[key]}
                onChange={(e) => setSleepFields((prev) => ({ ...prev, [key]: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder={label}
                type="number"
                variant="outlined"
                size="small"
                inputProps={{ min: 0 }}
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
            ))}
          </>
        ) : command.trim() === 'make_token' ? (
          <>
            {(['username', 'domain', 'password'] as const).map((field) => (
              <TextField
                key={field}
                value={makeTokenFields[field]}
                onChange={(e) => setMakeTokenFields((prev) => ({ ...prev, [field]: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder={field === 'domain' ? 'domain (opt.)' : field}
                type={field === 'password' ? 'password' : 'text'}
                variant="outlined"
                size="small"
                sx={{
                  flex: field === 'password' ? 1.5 : 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#0c0c0c',
                    '& fieldset': { borderColor: field === 'password' ? '#5a3a3a' : '#3c3c3c' },
                    '&:hover fieldset': { borderColor: '#555' },
                    '&.Mui-focused fieldset': { borderColor: '#4e9af1' },
                  },
                  '& input': { color: '#ffffff', padding: '3px 8px', fontSize: '12px' },
                }}
              />
            ))}
          </>
        ) : (
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
        )}
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <input
          type="file"
          ref={fileInputRef2}
          style={{ display: 'none' }}
          onChange={handleFileSelect2}
        />

        {/* File picker — shown for upload, inline-assembly and bof commands */}
        {(command.trim() === 'upload' || command.trim() === 'inline-assembly' || command.trim() === 'bof') && (
          <>
            <Tooltip title={selectedFile ? selectedFile.name : 'Select file'}>
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  backgroundColor: selectedFile ? '#2d4a2d' : '#2d2d2d',
                  color: selectedFile ? '#4caf50' : '#858585',
                  borderRadius: '2px',
                  p: 0.5,
                  '&:hover': { backgroundColor: '#3c3c3c' },
                }}
              >
                <AttachFile sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            {selectedFile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140 }}>
                <Typography
                  sx={{
                    fontSize: '11px',
                    color: '#4caf50',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedFile.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setSelectedFile(null)}
                  sx={{ p: 0, color: '#555', '&:hover': { color: '#f44747' } }}
                >
                  <Clear sx={{ fontSize: 11 }} />
                </IconButton>
              </Box>
            )}
          </>
        )}

        {/* Second file picker — only for bof (optional binary blob argument) */}
        {command.trim() === 'bof' && (
          <>
            <Tooltip title={selectedFile2 ? selectedFile2.name : 'Select 2nd file (optional)'}>
              <IconButton
                size="small"
                onClick={() => fileInputRef2.current?.click()}
                sx={{
                  backgroundColor: selectedFile2 ? '#2d3a4a' : '#2d2d2d',
                  color: selectedFile2 ? '#4e9af1' : '#555',
                  borderRadius: '2px',
                  p: 0.5,
                  '&:hover': { backgroundColor: '#3c3c3c' },
                }}
              >
                <AttachFile sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            {selectedFile2 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140 }}>
                <Typography
                  sx={{
                    fontSize: '11px',
                    color: '#4e9af1',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedFile2.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setSelectedFile2(null)}
                  sx={{ p: 0, color: '#555', '&:hover': { color: '#f44747' } }}
                >
                  <Clear sx={{ fontSize: 11 }} />
                </IconButton>
              </Box>
            )}
          </>
        )}

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
