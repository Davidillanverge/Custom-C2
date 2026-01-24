import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { Computer, Router, Dashboard } from '@mui/icons-material';

const Navbar: React.FC = () => {
  const location = useLocation();

  return (
    <AppBar position="static" sx={{ mb: 2 }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <Computer sx={{ mr: 1 }} />
          TeamServer C2
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            color="inherit"
            component={Link}
            to="/"
            startIcon={<Dashboard />}
            sx={{
              backgroundColor: location.pathname === '/' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }}
          >
            Dashboard
          </Button>

          <Button
            color="inherit"
            component={Link}
            to="/agents"
            startIcon={<Computer />}
            sx={{
              backgroundColor: location.pathname === '/agents' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }}
          >
            Agents
          </Button>

          <Button
            color="inherit"
            component={Link}
            to="/listeners"
            startIcon={<Router />}
            sx={{
              backgroundColor: location.pathname === '/listeners' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }}
          >
            Listeners
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;