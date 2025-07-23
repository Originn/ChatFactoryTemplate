// Custom domain utilities for ChatFactory Template
// Handles domain routing and configuration

export interface DomainConfig {
  customDomain: string | null;
  isCustomDomain: boolean;
  currentDomain: string;
  isVercel: boolean;
  isLocal: boolean;
}

/**
 * Get the current domain configuration
 */
export function getDomainConfig(req?: any): DomainConfig {
  let currentDomain = '';
  
  // Extract domain from request (server-side) or window (client-side)
  if (typeof window !== 'undefined') {
    // Client-side
    currentDomain = window.location.hostname;
  } else if (req) {
    // Server-side with request object
    currentDomain = req.headers.host || '';
  } else {
    // Fallback to environment
    currentDomain = process.env.VERCEL_URL || 'localhost:3000';
  }

  const customDomain = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || null;
  const isLocal = currentDomain.includes('localhost') || currentDomain.includes('127.0.0.1');
  const isVercel = currentDomain.includes('vercel.app');
  const isCustomDomain = customDomain !== null && 
                         currentDomain === customDomain && 
                         !isLocal && 
                         !isVercel;

  return {
    customDomain,
    isCustomDomain,
    currentDomain,
    isVercel,
    isLocal
  };
}

/**
 * Check if the current request is coming from a custom domain
 */
export function isRequestFromCustomDomain(req?: any): boolean {
  const config = getDomainConfig(req);
  return config.isCustomDomain;
}

/**
 * Get the appropriate domain URL for redirects and links
 */
export function getDomainUrl(req?: any): string {
  const config = getDomainConfig(req);
  
  if (config.isLocal) {
    return `http://${config.currentDomain}`;
  }
  
  return `https://${config.currentDomain}`;
}

/**
 * Get canonical URL for SEO and social sharing
 */
export function getCanonicalUrl(path: string = '', req?: any): string {
  const domainUrl = getDomainUrl(req);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${domainUrl}${cleanPath}`;
}

/**
 * Get domain-specific configuration for branding and customization
 */
export function getDomainBranding(req?: any) {
  const config = getDomainConfig(req);
  
  return {
    domain: config.currentDomain,
    isCustomDomain: config.isCustomDomain,
    showPoweredBy: !config.isCustomDomain, // Hide "Powered by ChatFactory" on custom domains
    chatbotName: process.env.NEXT_PUBLIC_CHATBOT_NAME || 'AI Assistant',
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Your Company',
    customDomain: config.customDomain
  };
}

/**
 * Validate custom domain format
 */
export function isValidCustomDomain(domain: string): boolean {
  if (!domain) return false;
  
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

/**
 * Get domain verification instructions for users
 */
export function getDomainVerificationInstructions(domain: string) {
  return {
    domain,
    instructions: [
      {
        type: 'CNAME',
        description: `Create a CNAME record pointing ${domain} to your Vercel deployment URL`,
        example: `${domain} CNAME your-chatbot.vercel.app`
      },
      {
        type: 'A',
        description: `Alternatively, create an A record pointing to Vercel's IP addresses`,
        example: `${domain} A 76.76.21.21`
      }
    ],
    verificationUrl: `/api/domains/verify?domain=${domain}`,
    helpUrl: 'https://vercel.com/docs/concepts/projects/custom-domains'
  };
}

export default {
  getDomainConfig,
  isRequestFromCustomDomain,
  getDomainUrl,
  getCanonicalUrl,
  getDomainBranding,
  isValidCustomDomain,
  getDomainVerificationInstructions
};