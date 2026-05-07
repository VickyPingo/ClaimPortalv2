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
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          console.warn('⚠️ Brokerage lookup failed, treating as platform domain');
          setIsPlatformDomain(true);
          return;
        }

        const result = await response.json();

        if (result.isPlatform) {
          console.log('✓ Platform domain detected - skipping brokerage lookup');
          setIsPlatformDomain(true);
          return;
        }

        if (result.success && result.brokerage) {
          const brokerageData = result.brokerage;

          // ─── FIX: The Netlify function may not include logo_url in its
          // response (it predates the logo feature). Fetch logo_url directly
          // from Supabase using the brokerage id so it's always up to date.
          let logoUrl: string | null = brokerageData.logo_url ?? null;

          if (brokerageData.id && !logoUrl) {
            try {
              const { data: logoData } = await supabase
                .from('brokerages')
                .select('logo_url')
                .eq('id', brokerageData.id)
                .maybeSingle();
              if (logoData?.logo_url) {
                logoUrl = logoData.logo_url;
                console.log('✓ logo_url fetched from Supabase:', logoUrl);
              }
            } catch (logoErr) {
              console.warn('⚠️ Could not fetch logo_url from Supabase:', logoErr);
            }
          }

          const fullBrokerageData: BrokerageConfig = {
            ...brokerageData,
            logo_url: logoUrl,
          };

          setBrokerage(fullBrokerageData);

          if (brokerageData.brand_color) {
            document.documentElement.style.setProperty('--brand-color', brokerageData.brand_color);
          }

          console.log('✓ Brokerage configuration loaded:', brokerageData.name);
          console.log('  Subdomain:', brokerageData.subdomain);
          console.log('  Logo URL:', logoUrl);
          setIsPlatformDomain(false);
        } else {
          console.log('⚠️ No brokerage found for domain:', hostname);
          setIsPlatformDomain(true);
        }
      } catch (lookupError) {
        console.error('Brokerage lookup error:', lookupError);
        setIsPlatformDomain(true);
      }
    } catch (err) {
      console.error('Fatal error loading brokerage config:', err);
      setIsPlatformDomain(true);
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
