import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';
import { Lock } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) login(token.trim());
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0c0c0c',
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 4,
          minWidth: 320,
          backgroundColor: '#1e1e1e',
          border: '1px solid #3c3c3c',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Lock sx={{ color: '#4e9af1', fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, color: '#9cdcfe', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            TeamServer
          </Typography>
        </Box>

        <Typography sx={{ color: '#858585', fontSize: '12px' }}>
          Enter your operator token to connect.
        </Typography>

        <TextField
          fullWidth
          type="password"
          label="Token"
          value={token}
          onChange={e => setToken(e.target.value)}
          autoFocus
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#3c3c3c' },
              '&:hover fieldset': { borderColor: '#555' },
              '&.Mui-focused fieldset': { borderColor: '#4e9af1' },
            },
            '& input': { color: '#fff', fontSize: '13px' },
            '& label': { color: '#858585', fontSize: '13px' },
            '& label.Mui-focused': { color: '#4e9af1' },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={!token.trim()}
          sx={{
            mt: 1,
            backgroundColor: '#4e9af1',
            '&:hover': { backgroundColor: '#5ba8ff' },
            '&.Mui-disabled': { backgroundColor: '#2d2d2d', color: '#555' },
            fontSize: '12px',
            textTransform: 'none',
          }}
        >
          Connect
        </Button>
      </Paper>
    </Box>
  );
};

export default Login;
