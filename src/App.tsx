import { AuthProvider } from './contexts/AuthContext';
import { BrokerageProvider } from './contexts/BrokerageContext';
import AuthGate from './components/AuthGate';

function AppContent() {
  return <AuthGate />;
}

function App() {
  return (
    <BrokerageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrokerageProvider>
  );
}

export default App;
