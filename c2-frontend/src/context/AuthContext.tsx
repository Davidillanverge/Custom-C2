import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken, getStoredToken } from '../services/api';

interface AuthContextValue {
  isAuthenticated: boolean;
  login:           (token: string) => void;
  logout:          () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  login:  () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // If no REACT_APP_AUTH_REQUIRED, skip auth entirely.
  const authRequired = process.env.REACT_APP_AUTH_REQUIRED === 'true';

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    !authRequired || !!getStoredToken(),
  );

  const login = useCallback((token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('c2:unauthorized', handler);
    return () => window.removeEventListener('c2:unauthorized', handler);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
