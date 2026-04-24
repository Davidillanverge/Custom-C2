import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { Dashboard, Computer, Router, Construction } from '@mui/icons-material';

const navItems = [
  { path: '/',         label: 'Dashboard', icon: <Dashboard    sx={{ fontSize: 15 }} /> },
  { path: '/agents',   label: 'Agents',    icon: <Computer     sx={{ fontSize: 15 }} /> },
  { path: '/listeners',label: 'Listeners', icon: <Router       sx={{ fontSize: 15 }} /> },
  { path: '/builder',  label: 'Builder',   icon: <Construction sx={{ fontSize: 15 }} /> },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <Box
      sx={{
        width: 175,
        flexShrink: 0,
        backgroundColor: '#252526',
        borderRight: '1px solid #3c3c3c',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          backgroundColor: '#333333',
          borderBottom: '1px solid #3c3c3c',
        }}
      >
        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#4e9af1', letterSpacing: '0.08em' }}>
          TEAMSERVER C2
        </Typography>
      </Box>

      <List disablePadding sx={{ flex: 1 }}>
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          return (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={isActive}
              sx={{
                py: 0.75,
                px: 1.5,
                borderLeft: isActive ? '2px solid #4e9af1' : '2px solid transparent',
                '&.Mui-selected': { backgroundColor: '#37373d' },
                '&:hover': { backgroundColor: '#2a2d2e' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 26, color: isActive ? '#4e9af1' : '#858585' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '12px',
                  color: isActive ? '#cccccc' : '#858585',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};

export default Sidebar;
