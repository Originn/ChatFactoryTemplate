/**
 * Utility functions for handling chatbot logo
 */

// Safe environment variable access with fallbacks
const getEnvVar = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
};

/**
 * Get the chatbot logo URL from environment variables
 * Falls back to a generic bot icon if no custom logo is provided
 */
export function getChatbotLogoUrl(): string {
  // Try to get the custom logo URL from environment variable
  const customLogoUrl = getEnvVar('NEXT_PUBLIC_CHATBOT_LOGO_URL');
  
  if (customLogoUrl && customLogoUrl.trim() !== '') {
    return customLogoUrl;
  }
  
  // Fallback to generic bot icon
  return '/bot-icon-generic.svg';
}

/**
 * Get the chatbot name from environment variables
 * Falls back to a generic name if not provided
 */
export function getChatbotName(): string {
  return getEnvVar('NEXT_PUBLIC_CHATBOT_NAME', 'AI Assistant');
}

/**
 * Get chatbot branding info
 */
export function getChatbotBranding() {
  return {
    name: getChatbotName(),
    logoUrl: getChatbotLogoUrl(),
    primaryColor: getEnvVar('NEXT_PUBLIC_CHATBOT_PRIMARY_COLOR', '#3b82f6'),
    description: getEnvVar('NEXT_PUBLIC_CHATBOT_DESCRIPTION', 'AI-powered assistant')
  };
}
