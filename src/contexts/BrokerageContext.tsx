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
}

const BrokerageContext = createContext<BrokerageContextType | undefined>(undefined);

export function BrokerageProvider({ children }: { children: ReactNode }) {
  const [brokerage, setBrokerage] = useState<BrokerageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBrokerageConfig();
  }, []);

  const loadBrokerageConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const hostname = window.location.hostname;
      let subdomain = hostname;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        subdomain = 'app.claimsplatform.com';
      }

      const { data, error: fetchError } = await supabase
        .rpc('get_brokerage_by_subdomain', { subdomain_param: subdomain });

      if (fetchError) {
        console.error('Error fetching brokerage:', fetchError);
        setError('Failed to load brokerage configuration');
        return;
      }

      if (data && data.length > 0) {
        const brokerageData = data[0];
        setBrokerage(brokerageData);

        if (brokerageData.brand_color) {
          document.documentElement.style.setProperty('--brand-color', brokerageData.brand_color);
        }
      } else {
        setError('Brokerage not found for this domain');
      }
    } catch (err) {
      console.error('Error loading brokerage config:', err);
      setError('An error occurred while loading brokerage configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrokerageContext.Provider value={{ brokerage, loading, error }}>
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
