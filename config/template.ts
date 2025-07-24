// Template configuration for chatbot customization
// Configure these values via environment variables in your .env file

export interface TemplateConfig {
  // Company Information
  companyName: string;
  companyDomain: string;
  companyDescription: string;
  supportUrl: string;
  
  // Product Information  
  productName: string;
  productLatestVersion: string;
  productAbbreviation: string;
  
  // Branding
  screenshotAltText: string;
  
  // Support & Contact
  supportEmail: string;
  technicalSupportUrl: string;
  
  // Custom Domain
  customDomain: string | null;
  isCustomDomainConfigured: boolean;

  // Favicon Configuration
  favicon: {
    iconUrl: string;
    appleTouchIconUrl: string;
    icon192Url: string;
    icon512Url: string;
    themeColor: string;
    backgroundColor: string;
    manifestName: string;
    manifestShortName: string;
  };
}

// Helper function to get template values from environment variables
export const getTemplateConfig = (): TemplateConfig => {
  const customDomain = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || null;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME || process.env.NEXT_PUBLIC_CHATBOT_NAME || "AI Assistant";
  
  return {
    // Company Information
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "Your Company",
    companyDomain: process.env.NEXT_PUBLIC_COMPANY_DOMAIN || "yourcompany.com",
    companyDescription: process.env.NEXT_PUBLIC_COMPANY_DESCRIPTION || "AI-powered software",
    supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL || "https://yourcompany.com/support",
    
    // Product Information
    productName,
    productLatestVersion: process.env.NEXT_PUBLIC_PRODUCT_LATEST_VERSION || "2024",
    productAbbreviation: process.env.NEXT_PUBLIC_PRODUCT_ABBREVIATION || "AI",
    
    // Branding
    screenshotAltText: `${productName} screenshot`,
    
    // Support & Contact
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@yourcompany.com",
    technicalSupportUrl: process.env.NEXT_PUBLIC_TECHNICAL_SUPPORT_URL || process.env.NEXT_PUBLIC_SUPPORT_URL || "https://yourcompany.com/support",
    
    // Custom Domain
    customDomain,
    isCustomDomainConfigured: !!customDomain,

    // Favicon Configuration
    favicon: {
      iconUrl: process.env.NEXT_PUBLIC_FAVICON_URL || '/favicon.ico',
      appleTouchIconUrl: process.env.NEXT_PUBLIC_APPLE_TOUCH_ICON_URL || '/favicon.ico',
      icon192Url: process.env.NEXT_PUBLIC_ICON_192_URL || '/favicon.ico',
      icon512Url: process.env.NEXT_PUBLIC_ICON_512_URL || '/favicon.ico',
      themeColor: process.env.NEXT_PUBLIC_THEME_COLOR || '#000000',
      backgroundColor: process.env.NEXT_PUBLIC_BACKGROUND_COLOR || '#ffffff',
      manifestName: process.env.NEXT_PUBLIC_MANIFEST_NAME || `${productName} ChatBot`,
      manifestShortName: process.env.NEXT_PUBLIC_MANIFEST_SHORT_NAME || productName,
    }
  };
};