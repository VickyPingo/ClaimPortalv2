import { AuthProvider } from './contexts/AuthContext';
import AuthGate from './components/AuthGate';

function AppContent() {
  return <AuthGate />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
