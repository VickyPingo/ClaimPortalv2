import { AuthProvider } from './contexts/AuthContext';
import { BrokerageProvider } from './contexts/BrokerageContext';
import HomePageRouter from './components/HomePageRouter';

function App() {
  return (
    <BrokerageProvider>
      <AuthProvider>
        <HomePageRouter />
      </AuthProvider>
    </BrokerageProvider>
  );
}

export default App;
