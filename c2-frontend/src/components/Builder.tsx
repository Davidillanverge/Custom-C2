import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import { Add, Download, Delete, Refresh, ErrorOutline, CheckCircleOutline, CancelOutlined } from '@mui/icons-material';
import {
  builderAPI,
  Build,
  BuildArch,
  BuildRequest,
  BuildStatus,
  BuilderCheck,
} from '../services/api';

const ARCHS: BuildArch[] = ['x64', 'x86', 'ARM64'];

const STATUS_COLOR: Record<BuildStatus, string> = {
  pending: '#ddb100',
  running: '#4e9af1',
  success: '#4caf50',
  failed:  '#f44747',
};

const Builder: React.FC = () => {
  const [builds, setBuilds]         = useState<Build[]>([]);
  const [check, setCheck]           = useState<BuilderCheck | null>(null);
  const [loading, setLoading]       = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logOpen, setLogOpen]       = useState(false);
  const [activeLog, setActiveLog]   = useState('');
  const [form, setForm]             = useState<BuildRequest>({ host: '', port: 8080, arch: 'x64' });
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar]     = useState<{
    open: boolean; message: string; severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const loadBuilds = useCallback(async () => {
    try {
      const [buildsData, checkData] = await Promise.all([
        builderAPI.getBuilds(),
        builderAPI.check(),
      ]);
      setBuilds(
        buildsData.slice().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
      setCheck(checkData);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBuilds(); }, [loadBuilds]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await builderAPI.createBuild(form);
      setDialogOpen(false);
      setForm({ host: '', port: 8080, arch: 'x64' });
      setSnackbar({ open: true, message: 'Build completed', severity: 'success' });
      await loadBuilds();
    } catch {
      setSnackbar({ open: true, message: 'Failed to create build', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await builderAPI.deleteBuild(id);
      setBuilds(prev => prev.filter(b => b.id !== id));
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete build', severity: 'error' });
    }
  };

  const handleDownload = (id: string) => {
    window.location.href = builderAPI.downloadUrl(id);
  };

  const showLog = (log: string) => {
    setActiveLog(log.trim() || 'No output captured.');
    setLogOpen(true);
  };

  // The selected arch's base DLL must be available
  const selectedArchAvailable = check?.archs[form.arch] ?? false;
  const formValid = form.host.trim() !== '' && form.port >= 1 && form.port <= 65535 && selectedArchAvailable;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 1, py: 0.5,
        backgroundColor: '#2d2d2d', borderBottom: '1px solid #3c3c3c',
        gap: 1, flexShrink: 0,
      }}>
        <Typography sx={{
          fontSize: '11px', fontWeight: 700, color: '#9cdcfe', flex: 1,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Builder ({builds.length})
        </Typography>

        {/* Per-arch DLL availability pills */}
        {check && (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mr: 0.5 }}>
            {ARCHS.map(arch => (
              <Tooltip
                key={arch}
                title={
                  check.archs[arch]
                    ? `${arch} base DLL ready`
                    : `${arch} base DLL missing — compile Release/${arch} and place in AgentWindows/dist/`
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'default' }}>
                  {check.archs[arch]
                    ? <CheckCircleOutline sx={{ fontSize: 12, color: '#4caf50' }} />
                    : <CancelOutlined    sx={{ fontSize: 12, color: '#555' }} />
                  }
                  <Typography sx={{ fontSize: '10px', color: check.archs[arch] ? '#4caf50' : '#555' }}>
                    {arch}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        )}

        <Button
          size="small"
          startIcon={<Add sx={{ fontSize: 13 }} />}
          onClick={() => setDialogOpen(true)}
          variant="contained"
          sx={{
            fontSize: '11px', py: 0.25, px: 1, minHeight: '22px',
            backgroundColor: '#4e9af1', '&:hover': { backgroundColor: '#5ba8ff' },
          }}
        >
          New Build
        </Button>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadBuilds} sx={{ p: 0.25 }}>
            <Refresh sx={{ fontSize: 14, color: '#858585' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Warning when no base DLLs are present */}
      {check && !check.available && (
        <Alert severity="warning" sx={{ borderRadius: 0, py: 0.5, fontSize: '12px' }}>
          No base DLLs found in <code>AgentWindows/dist/</code>. Compile the agent in
          Visual Studio (Release/x64) and copy the DLL there as <code>agent_x64.dll</code>.
        </Alert>
      )}

      {/* Build history table */}
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Port</TableCell>
              <TableCell>Arch</TableCell>
              <TableCell>Built at</TableCell>
              <TableCell sx={{ width: 72 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', color: '#555', cursor: 'default' }}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : builds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', color: '#555', py: 4, cursor: 'default' }}>
                  No builds yet. Click "New Build" to patch and download an agent.
                </TableCell>
              </TableRow>
            ) : (
              builds.map(build => (
                <TableRow key={build.id} sx={{
                  '&:nth-of-type(odd)': { backgroundColor: '#1e1e1e' },
                  cursor: 'default',
                  '&:hover': { backgroundColor: '#2a2d2e !important' },
                }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{
                        width: 7, height: 7, borderRadius: '50%',
                        backgroundColor: STATUS_COLOR[build.status],
                      }} />
                      <Typography sx={{ fontSize: '11px', color: STATUS_COLOR[build.status] }}>
                        {build.status}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#4e9af1', fontFamily: 'monospace', fontSize: '12px' }}>
                    {build.host}
                  </TableCell>
                  <TableCell>{build.port}</TableCell>
                  <TableCell sx={{ color: '#9cdcfe' }}>{build.arch}</TableCell>
                  <TableCell sx={{ color: '#858585', fontSize: '11px' }}>
                    {build.finished_at
                      ? new Date(build.finished_at).toLocaleString()
                      : new Date(build.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      {build.status === 'success' && (
                        <Tooltip title="Download patched DLL">
                          <IconButton size="small" onClick={() => handleDownload(build.id)} sx={{ p: 0.25 }}>
                            <Download sx={{ fontSize: 14, color: '#4caf50' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {build.status === 'failed' && (
                        <Tooltip title="View error">
                          <IconButton size="small" onClick={() => showLog(build.error_log)} sx={{ p: 0.25 }}>
                            <ErrorOutline sx={{ fontSize: 14, color: '#f44747' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(build.id)}
                            sx={{ p: 0.25 }}
                          >
                            <Delete sx={{ fontSize: 14, color: '#f44747' }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New Build Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Build</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField
            fullWidth
            label="Listener Host"
            value={form.host}
            onChange={e => setForm({ ...form, host: e.target.value })}
            placeholder="192.168.1.10"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Listener Port"
            type="number"
            value={form.port}
            onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
            inputProps={{ min: 1, max: 65535 }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Architecture</InputLabel>
            <Select
              value={form.arch}
              label="Architecture"
              size="small"
              onChange={e => setForm({ ...form, arch: e.target.value as BuildArch })}
            >
              {ARCHS.map(arch => {
                const avail = check?.archs[arch] ?? false;
                return (
                  <MenuItem key={arch} value={arch} disabled={!avail}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {avail
                        ? <CheckCircleOutline sx={{ fontSize: 13, color: '#4caf50' }} />
                        : <CancelOutlined    sx={{ fontSize: 13, color: '#555' }} />
                      }
                      <span>{arch}</span>
                      {!avail && (
                        <Typography component="span" sx={{ fontSize: '10px', color: '#555', ml: 0.5 }}>
                          (no base DLL)
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          {!selectedArchAvailable && (
            <Typography sx={{ fontSize: '11px', color: '#ddb100', mt: 1 }}>
              Place <code>agent_{form.arch.toLowerCase()}.dll</code> in{' '}
              <code>AgentWindows/dist/</code> to enable this architecture.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#858585' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={!formValid || submitting}
            sx={{ backgroundColor: '#4e9af1', '&:hover': { backgroundColor: '#5ba8ff' } }}
          >
            {submitting ? 'Patching…' : 'Build'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error log dialog */}
      <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Build Error</DialogTitle>
        <DialogContent>
          <Box component="pre" sx={{
            mt: 1, p: 1.5,
            backgroundColor: '#0c0c0c', borderRadius: 1,
            fontFamily: '"Consolas", "Courier New", monospace',
            fontSize: '11px', color: '#f44747',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 400, overflow: 'auto',
          }}>
            {activeLog}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setLogOpen(false)} sx={{ color: '#858585' }}>Close</Button>
        </DialogActions>
      </Dialog>

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

export default Builder;
