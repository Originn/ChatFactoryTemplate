import { useState, useEffect } from 'react';
import { getDomainConfig, getDomainBranding, DomainConfig } from '../utils/customDomain';

interface UseDomainReturn {
  domainConfig: DomainConfig;
  branding: ReturnType<typeof getDomainBranding>;
  isCustomDomain: boolean;
  isLoading: boolean;
}

/**
 * Custom hook to get domain configuration and branding information
 * This hook is client-side safe and handles SSR
 */
export function useDomain(): UseDomainReturn {
  const [domainConfig, setDomainConfig] = useState<DomainConfig>({
    customDomain: null,
    isCustomDomain: false,
    currentDomain: '',
    isVercel: false,
    isLocal: false
  });
  
  const [branding, setBranding] = useState(getDomainBranding());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const config = getDomainConfig();
      const brandingInfo = getDomainBranding();
      
      setDomainConfig(config);
      setBranding(brandingInfo);
      setIsLoading(false);

      // Log domain info for debugging
      console.log('🌐 Domain Hook - Configuration:', {
        domain: config.currentDomain,
        isCustomDomain: config.isCustomDomain,
        customDomain: config.customDomain,
        isLocal: config.isLocal,
        isVercel: config.isVercel
      });
    }
  }, []);

  return {
    domainConfig,
    branding,
    isCustomDomain: domainConfig.isCustomDomain,
    isLoading
  };
}

export default useDomain;
