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

      const platformDomains = ['claimsportal.co.za', 'localhost', '127.0.0.1'];
      const isDevelopment = hostname.includes('localhost') ||
                           hostname.includes('127.0.0.1') ||
                           hostname.includes('webcontainer') ||
                           hostname.includes('.local');

      const isPlatform = platformDomains.includes(hostname) || isDevelopment;
      setIsPlatformDomain(isPlatform);

      console.log('🌐 Domain Detection:');
      console.log('  Hostname:', hostname);
      console.log('  Is Development:', isDevelopment);
      console.log('  Is Platform Domain:', isPlatform);

      if (isPlatform) {
        console.log('✓ Platform/Development domain detected - skipping brokerage lookup');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .rpc('get_brokerage_by_subdomain', { subdomain_param: hostname });

        if (fetchError) {
          console.error('Error fetching brokerage:', fetchError);
          console.log('⚠️ Brokerage lookup failed, treating as platform domain');
          setIsPlatformDomain(true);
          setError(null);
          return;
        }

        if (data && data.length > 0) {
          const brokerageData = data[0];
          setBrokerage(brokerageData);

          if (brokerageData.brand_color) {
            document.documentElement.style.setProperty('--brand-color', brokerageData.brand_color);
          }
          console.log('✓ Brokerage configuration loaded:', brokerageData.name);
        } else {
          console.log('⚠️ No brokerage found for domain, treating as platform domain');
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
