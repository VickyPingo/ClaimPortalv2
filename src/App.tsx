import { AuthProvider } from './contexts/AuthContext';
import { BrokerageProvider } from './contexts/BrokerageContext';
import HomePageRouter from './components/HomePageRouter';

function App() {
  // Clean slate on every app load - clear all cached data
  localStorage.clear();

  return (
    <BrokerageProvider>
      <AuthProvider>
        <HomePageRouter />
      </AuthProvider>
    </BrokerageProvider>
  );
}

export default App;
