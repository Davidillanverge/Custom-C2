import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { agentAPI, listenerAPI, Agent, Listener } from '../services/api';

interface AppContextValue {
  agentCount:    number;
  listenerCount: number;
  connected:     boolean;
  agents:        Agent[];
  listeners:     Listener[];
  refresh:       () => void;
}

const AppContext = createContext<AppContextValue>({
  agentCount:    0,
  listenerCount: 0,
  connected:     false,
  agents:        [],
  listeners:     [],
  refresh:       () => {},
});

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agentCount,    setAgentCount]    = useState(0);
  const [listenerCount, setListenerCount] = useState(0);
  const [connected,     setConnected]     = useState(false);
  const [agents,        setAgents]        = useState<Agent[]>([]);
  const [listeners,     setListeners]     = useState<Listener[]>([]);

  // Track whether we are currently disconnected so we can use a faster retry interval.
  const disconnectedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [agentsData, listenersData] = await Promise.all([
        agentAPI.getAgents(),
        listenerAPI.getListeners(),
      ]);
      setAgents(agentsData);
      setListeners(listenersData);
      setAgentCount(agentsData.length);
      setListenerCount(listenersData.length);
      setConnected(true);
      disconnectedRef.current = false;
    } catch {
      setConnected(false);
      disconnectedRef.current = true;
    }
  }, []);

  useEffect(() => {
    refresh();

    // Normal poll every 30 s; when disconnected, retry every 5 s.
    let interval: ReturnType<typeof setInterval>;

    const schedule = () => {
      const delay = disconnectedRef.current ? 5_000 : 30_000;
      interval = setInterval(() => {
        refresh().then(() => {
          clearInterval(interval);
          schedule();
        });
      }, delay);
    };

    schedule();
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <AppContext.Provider value={{ agentCount, listenerCount, connected, agents, listeners, refresh }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
