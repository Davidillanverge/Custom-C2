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
import { Add, Delete, Refresh } from '@mui/icons-material';
import { listenerAPI, Listener } from '../services/api';

const Listeners: React.FC = () => {
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newListener, setNewListener] = useState({ name: '', type: 'http', port: 8080 });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadListeners();
  }, []);

  const loadListeners = async () => {
    try {
      setLoading(true);
      setListeners(await listenerAPI.getListeners());
      setError('');
    } catch {
      setError('Failed to load listeners');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await listenerAPI.createListener(newListener);
      setSnackbar({ open: true, message: 'Listener created', severity: 'success' });
      setDialogOpen(false);
      setNewListener({ name: '', type: 'http', port: 8080 });
      loadListeners();
    } catch {
      setSnackbar({ open: true, message: 'Failed to create listener', severity: 'error' });
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await listenerAPI.removeListener(name);
      setSnackbar({ open: true, message: 'Listener removed', severity: 'success' });
      loadListeners();
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove listener', severity: 'error' });
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
          gap: 1,
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
          Listeners ({listeners.length})
        </Typography>
        <Button
          size="small"
          startIcon={<Add sx={{ fontSize: 13 }} />}
          onClick={() => setDialogOpen(true)}
          variant="contained"
          sx={{
            fontSize: '11px',
            py: 0.25,
            px: 1,
            minHeight: '22px',
            backgroundColor: '#4e9af1',
            '&:hover': { backgroundColor: '#5ba8ff' },
          }}
        >
          Add Listener
        </Button>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadListeners} sx={{ p: 0.25 }}>
            <Refresh sx={{ fontSize: 14, color: '#858585' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Port</TableCell>
              <TableCell sx={{ width: 60 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', color: '#555', cursor: 'default' }}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : listeners.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  sx={{ textAlign: 'center', color: '#555', py: 4, cursor: 'default' }}
                >
                  No listeners configured. Click "Add Listener" to create one.
                </TableCell>
              </TableRow>
            ) : (
              listeners.map((listener) => (
                <TableRow
                  key={listener.name}
                  sx={{
                    '&:nth-of-type(odd)': { backgroundColor: '#1e1e1e' },
                    cursor: 'default',
                    '&:hover': { backgroundColor: '#2a2d2e !important' },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box
                        sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4caf50' }}
                      />
                      <Typography sx={{ fontSize: '11px', color: '#4caf50' }}>Running</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#4e9af1' }}>{listener.name}</TableCell>
                  <TableCell sx={{ color: '#9cdcfe' }}>{listener.type.toUpperCase()}</TableCell>
                  <TableCell>{listener.host}</TableCell>
                  <TableCell>{listener.port}</TableCell>
                  <TableCell>
                    <Tooltip title="Stop & Remove">
                      <IconButton
                        size="small"
                        onClick={() => handleRemove(listener.name)}
                        sx={{ p: 0.25 }}
                      >
                        <Delete sx={{ fontSize: 14, color: '#f44747' }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Listener Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Listener</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField
            fullWidth
            label="Name"
            value={newListener.name}
            onChange={(e) => setNewListener({ ...newListener, name: e.target.value })}
            placeholder="HTTP-8080"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={newListener.type}
              onChange={(e) => setNewListener({ ...newListener, type: e.target.value })}
              label="Type"
              size="small"
            >
              <MenuItem value="http">HTTP</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Port"
            type="number"
            value={newListener.port}
            onChange={(e) =>
              setNewListener({ ...newListener, port: parseInt(e.target.value) || 8080 })
            }
            inputProps={{ min: 1, max: 65535 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#858585' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={!newListener.name.trim()}
            sx={{ backgroundColor: '#4e9af1', '&:hover': { backgroundColor: '#5ba8ff' } }}
          >
            Create
          </Button>
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

export default Listeners;
