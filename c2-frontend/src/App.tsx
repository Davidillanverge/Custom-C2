import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import { csTheme } from './theme';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import Dashboard from './components/Dashboard';
import Agents from './components/Agents';
import AgentDetail from './components/AgentDetail';
import Listeners from './components/Listeners';
import Builder from './components/Builder';

function App() {
  return (
    <ThemeProvider theme={csTheme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <Sidebar />
            <Box
              component="main"
              sx={{ flex: 1, overflow: 'auto', backgroundColor: 'background.default', display: 'flex', flexDirection: 'column' }}
            >
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/agent/:id" element={<AgentDetail />} />
                <Route path="/listeners" element={<Listeners />} />
                <Route path="/builder"   element={<Builder />} />
              </Routes>
            </Box>
          </Box>
          <StatusBar />
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
