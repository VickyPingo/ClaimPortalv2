import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface BrokerageConfig {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  brand_color: string;
  notification_email: string | null;
}

interface BrokerageContextType {
  brokerage: BrokerageConfig | null;
  loading: boolean;
  error: string | null;
  isPlatformDomain: boolean;
  currentDomain: string;
}

const BrokerageContext = createContext<BrokerageContextType | undefined>(undefined);

export function BrokerageProvider({ children }: { children: ReactNode }) {
  const [brokerage, setBrokerage] = useState<BrokerageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlatformDomain, setIsPlatformDomain] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('');

  useEffect(() => {
    loadBrokerageConfig();
  }, []);

  const loadBrokerageConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const hostname = window.location.hostname;
      setCurrentDomain(hostname);

      console.log('🌐 Domain Detection:');
      console.log('  Hostname:', hostname);

      try {
        console.log('🔍 Looking up brokerage from host via Netlify function');

        const response = await fetch('/.netlify/functions/get-brokerage-from-host', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Brokerage lookup failed:', response.status);
          console.log('⚠️ Brokerage lookup failed, treating as platform domain');
          setIsPlatformDomain(true);
          setError(null);
          setLoading(false);
          return;
        }

        const result = await response.json();

        if (result.isPlatform) {
          console.log('✓ Platform domain detected - skipping brokerage lookup');
          setIsPlatformDomain(true);
          setLoading(false);
          return;
        }

        if (result.success && result.brokerage) {
          const brokerageData = result.brokerage;
          setBrokerage(brokerageData);

          if (brokerageData.brand_color) {
            document.documentElement.style.setProperty('--brand-color', brokerageData.brand_color);
          }
          console.log('✓ Brokerage configuration loaded:', brokerageData.name);
          console.log('  Subdomain:', brokerageData.subdomain);
          setIsPlatformDomain(false);
        } else {
          console.log('⚠️ No brokerage found for domain:', hostname);
          console.log('  Treating as platform domain');
          setIsPlatformDomain(true);
          setError(null);
        }
      } catch (lookupError) {
        console.error('Brokerage lookup error:', lookupError);
        console.log('⚠️ Error during lookup, treating as platform domain');
        setIsPlatformDomain(true);
        setError(null);
      }
    } catch (err) {
      console.error('Fatal error loading brokerage config:', err);
      console.log('⚠️ Fatal error, treating as platform domain');
      setIsPlatformDomain(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrokerageContext.Provider value={{ brokerage, loading, error, isPlatformDomain, currentDomain }}>
      {children}
    </BrokerageContext.Provider>
  );
}

export function useBrokerage() {
  const context = useContext(BrokerageContext);
  if (context === undefined) {
    throw new Error('useBrokerage must be used within a BrokerageProvider');
  }
  return context;
}
