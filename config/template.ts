// Template configuration for chatbot customization
// These variables will be replaced by the DocsAI hub when creating new chatbot instances

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
}

// Default template configuration - will be replaced during chatbot creation
export const TEMPLATE_CONFIG: TemplateConfig = {  // Company placeholders
  companyName: "{{COMPANY_NAME}}",
  companyDomain: "{{COMPANY_DOMAIN}}", 
  companyDescription: "{{COMPANY_DESCRIPTION}}",
  supportUrl: "{{SUPPORT_URL}}",
  
  // Product placeholders
  productName: "{{PRODUCT_NAME}}",
  productLatestVersion: "{{PRODUCT_LATEST_VERSION}}", 
  productAbbreviation: "{{PRODUCT_ABBREVIATION}}",
  
  // Branding placeholders
  screenshotAltText: "{{PRODUCT_NAME}} screenshot",
  
  // Support placeholders
  supportEmail: "{{SUPPORT_EMAIL}}",
  technicalSupportUrl: "{{TECHNICAL_SUPPORT_URL}}"
};

// Helper function to get template values (for development/testing)
export const getTemplateConfig = (): TemplateConfig => {
  // In production, these would be replaced during template instantiation
  // For development, we can provide fallback values
  return process.env.NODE_ENV === 'development' ? {
    companyName: "Your Company",
    companyDomain: "yourcompany.com",
    companyDescription: "software",
    supportUrl: "https://yourcompany.com/support",
    productName: "Your Product",
    productLatestVersion: "2024",
    productAbbreviation: "YP",
    screenshotAltText: "Product screenshot", 
    supportEmail: "support@yourcompany.com",
    technicalSupportUrl: "https://yourcompany.com/technical-support"
  } : TEMPLATE_CONFIG;
};