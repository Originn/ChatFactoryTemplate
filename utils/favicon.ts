/**
 * Utility functions for handling favicon and app icons
 */

// Safe environment variable access with fallbacks
const getEnvVar = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
};

/**
 * Get the favicon URL from environment variables
 * Falls back to default favicon.ico if no custom favicon is provided
 */
export function getFaviconUrl(): string {
  // Try to get the custom favicon URL from environment variable
  const customFaviconUrl = getEnvVar('NEXT_PUBLIC_FAVICON_URL');
  
  if (customFaviconUrl && customFaviconUrl.trim() !== '') {
    return customFaviconUrl;
  }
  
  // Fallback to default favicon
  return '/favicon.ico';
}

/**
 * Get the app title for favicon and meta tags
 */
export function getAppTitle(): string {
  const chatbotName = getEnvVar('NEXT_PUBLIC_CHATBOT_NAME', 'AI Assistant');
  return `${chatbotName} ChatBot`;
}

/**
 * Get the app description for meta tags
 */
export function getAppDescription(): string {
  const chatbotName = getEnvVar('NEXT_PUBLIC_CHATBOT_NAME', 'AI Assistant');
  return `${chatbotName} - AI-powered chat assistant to help answer your questions`;
}

/**
 * Get the theme color for meta tags
 */
export function getThemeColor(): string {
  return getEnvVar('NEXT_PUBLIC_THEME_COLOR', '#000000');
}