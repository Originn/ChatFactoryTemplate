/**
 * Utility functions for handling chatbot logo
 */

/**
 * Get the chatbot logo URL from environment variables
 * Falls back to a generic bot icon if no custom logo is provided
 */
export function getChatbotLogoUrl(): string {
  // Try to get the custom logo URL from environment variable
  const customLogoUrl = process.env.NEXT_PUBLIC_CHATBOT_LOGO_URL;
  
  // Debug logging for both development and production
  console.log('🔍 Logo Debug Info:', {
    customLogoUrl: customLogoUrl || 'NOT SET',
    environment: process.env.NODE_ENV,
    hasCustomLogo: !!(customLogoUrl && customLogoUrl.trim() !== ''),
    allChatbotEnvVars: {
      NEXT_PUBLIC_CHATBOT_LOGO_URL: process.env.NEXT_PUBLIC_CHATBOT_LOGO_URL || 'NOT SET',
      NEXT_PUBLIC_CHATBOT_NAME: process.env.NEXT_PUBLIC_CHATBOT_NAME || 'NOT SET',
      NEXT_PUBLIC_CHATBOT_ID: process.env.NEXT_PUBLIC_CHATBOT_ID || 'NOT SET'
    }
  });
  
  if (customLogoUrl && customLogoUrl.trim() !== '') {
    console.log('✅ Using custom logo URL:', customLogoUrl);
    return customLogoUrl;
  }
  
  // Fallback to generic bot icon
  const fallbackUrl = '/bot-icon-generic.svg';
  console.log('⚠️ Using fallback logo:', fallbackUrl);
  
  return fallbackUrl;
}

/**
 * Get the chatbot name from environment variables
 * Falls back to a generic name if not provided
 */
export function getChatbotName(): string {
  return process.env.NEXT_PUBLIC_CHATBOT_NAME || 'AI Assistant';
}

/**
 * Get chatbot branding info
 */
export function getChatbotBranding() {
  const branding = {
    name: getChatbotName(),
    logoUrl: getChatbotLogoUrl(),
    primaryColor: process.env.NEXT_PUBLIC_CHATBOT_PRIMARY_COLOR || '#3b82f6',
    description: process.env.NEXT_PUBLIC_CHATBOT_DESCRIPTION || 'AI-powered assistant'
  };
  
  console.log('🎨 Chatbot Branding:', branding);
  return branding;
}
