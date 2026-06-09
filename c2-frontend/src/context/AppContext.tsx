import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { agentAPI, listenerAPI } from '../services/api';

interface AppContextValue {
  agentCount: number;
  listenerCount: number;
  connected: boolean;
  refresh: () => void;
}

const AppContext = createContext<AppContextValue>({
  agentCount: 0,
  listenerCount: 0,
  connected: false,
  refresh: () => {},
});

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agentCount, setAgentCount] = useState(0);
  const [listenerCount, setListenerCount] = useState(0);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [agents, listeners] = await Promise.all([
        agentAPI.getAgents(),
        listenerAPI.getListeners(),
      ]);
      setAgentCount(agents.length);
      setListenerCount(listeners.length);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <AppContext.Provider value={{ agentCount, listenerCount, connected, refresh }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
