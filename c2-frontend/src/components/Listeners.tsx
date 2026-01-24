import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  Grid,
  Chip,
  Alert,
  Snackbar,
} from '@mui/material';
import { Router, Add, Delete } from '@mui/icons-material';
import { listenerAPI, Listener } from '../services/api';

const Listeners: React.FC = () => {
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Create listener form state
  const [newListener, setNewListener] = useState({
    name: '',
    type: 'http',
    port: 8080,
  });

  useEffect(() => {
    loadListeners();
  }, []);

  const loadListeners = async () => {
    try {
      setLoading(true);
      const data = await listenerAPI.getListeners();
      setListeners(data);
      setError('');
    } catch (err) {
      setError('Failed to load listeners');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListener = async () => {
    try {
      await listenerAPI.createListener(newListener);
      setSnackbar({ open: true, message: 'Listener created successfully', severity: 'success' });
      setCreateDialogOpen(false);
      setNewListener({ name: '', type: 'http', port: 8080 });
      loadListeners();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to create listener', severity: 'error' });
    }
  };

  const handleRemoveListener = async (name: string) => {
    console.log('Attempting to remove listener:', name);

    try {
      const response = await listenerAPI.removeListener(name);
      console.log('Remove listener response:', response);
      setSnackbar({ open: true, message: 'Listener removed successfully', severity: 'success' });
      loadListeners();
    } catch (err) {
      console.error('Failed to remove listener:', err);
      setSnackbar({ open: true, message: 'Failed to remove listener', severity: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        <Router sx={{ mr: 1, verticalAlign: 'middle' }} />
        Listener Management
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Listener
        </Button>
      </Box>

      {loading ? (
        <Typography>Loading listeners...</Typography>
      ) : listeners.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" align="center" color="textSecondary">
              No active listeners
            </Typography>
            <Typography align="center" color="textSecondary">
              Create a listener above to start accepting agent connections.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {listeners.map((listener) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={listener.name}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">{listener.name}</Typography>
                    <Chip label="Running" color="success" size="small" />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Type:</strong> {listener.type.toUpperCase()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Host:</strong> {listener.host}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Port:</strong> {listener.port}
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleRemoveListener(listener.name)}
                  >
                    Stop & Remove
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Listener Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Listener</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Listener Name"
              value={newListener.name}
              onChange={(e) => setNewListener({ ...newListener, name: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="e.g., HTTP-8080"
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={newListener.type}
                onChange={(e) => setNewListener({ ...newListener, type: e.target.value })}
                label="Type"
              >
                <MenuItem value="http">HTTP</MenuItem>
                {/* Future: Add more listener types */}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Port"
              type="number"
              value={newListener.port}
              onChange={(e) => setNewListener({ ...newListener, port: parseInt(e.target.value) || 8080 })}
              inputProps={{ min: 1, max: 65535 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateListener}
            variant="contained"
            disabled={!newListener.name.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

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

export default Listeners;