import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container } from '@mui/material';

import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Agents from './components/Agents';
import AgentDetail from './components/AgentDetail';
import Listeners from './components/Listeners';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Navbar />
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agent/:id" element={<AgentDetail />} />
            <Route path="/listeners" element={<Listeners />} />
          </Routes>
        </Container>
      </Router>
    </ThemeProvider>
  );
}

export default App;
