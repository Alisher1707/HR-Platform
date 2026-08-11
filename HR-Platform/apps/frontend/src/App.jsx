import React, { useEffect } from 'react';
import AppRouter from './router/AppRouter';
import ToastContainer from './components/ui/Toast';
import DemoBadge from './components/ui/DemoBadge';
import { useThemeStore } from './store/themeStore';

/**
 * Main Application Component
 * Initializes the theme and mounts the routing system and notification container.
 */
function App() {
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme(); // Set active theme (light/dark) on startup
  }, [initTheme]);

  return (
    <>
      <AppRouter />
      <ToastContainer />
      <DemoBadge />
    </>
  );
}

export default App;
