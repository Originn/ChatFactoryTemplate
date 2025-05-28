// Template validation and testing utilities for ChatFactory hub integration
// This file provides functions to validate template variables and test deployments

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  unreplacedVariables: string[];
}

export interface DeploymentConfig {
  companyInfo: {
    name: string;
    domain: string;
    description?: string;
  };
  productInfo: {
    name: string;
    latestVersion: string;
    abbreviation?: string;
  };
  supportInfo: {
    email: string;
    supportUrl: string;
    technicalSupportUrl: string;
  };
  deploymentInfo: {
    productionUrl: string;
    pineconeIndexName: string;
    customDomain?: string;
  };
}

/**
 * All template variables that need to be replaced during deployment
 */
export const TEMPLATE_VARIABLES = [
  'COMPANY_NAME',
  'COMPANY_DOMAIN', 
  'COMPANY_DESCRIPTION',
  'PRODUCT_NAME',
  'PRODUCT_LATEST_VERSION',
  'PRODUCT_ABBREVIATION',
  'SUPPORT_EMAIL',
  'SUPPORT_URL',
  'TECHNICAL_SUPPORT_URL',
  'PRODUCTION_URL',
  'PINECONE_INDEX_NAME'
] as const;

/**
 * Files that should be processed for template variable replacement
 */
export const TEMPLATE_FILES = [
  // TypeScript/JavaScript files
  'utils/prompts/promptTemplates.ts',
  'utils/prompts/deepseekPrompt.ts',
  'utils/makechain.ts',
  'pages/_app.tsx',
  'components/core/Chat/ChatContainer.tsx',
  'config/pinecone.ts',
  'config/template.ts',
  
  // Configuration files
  'next.config.js',
  'package.json',
  
  // Documentation
  'README.md',
  'TEMPLATE_VARIABLES.md',
  
  // Environment template
  '.env.example'
] as const;

/**
 * Validate deployment configuration against schema
 */
export function validateDeploymentConfig(config: DeploymentConfig): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!config.companyInfo?.name) errors.push('Company name is required');
  if (!config.companyInfo?.domain) errors.push('Company domain is required');
  if (!config.productInfo?.name) errors.push('Product name is required');
  if (!config.productInfo?.latestVersion) errors.push('Product version is required');
  if (!config.supportInfo?.email) errors.push('Support email is required');
  if (!config.supportInfo?.supportUrl) errors.push('Support URL is required');
  if (!config.supportInfo?.technicalSupportUrl) errors.push('Technical support URL is required');
  if (!config.deploymentInfo?.productionUrl) errors.push('Production URL is required');
  if (!config.deploymentInfo?.pineconeIndexName) errors.push('Pinecone index name is required');

  // Validate formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (config.supportInfo?.email && !emailRegex.test(config.supportInfo.email)) {
    errors.push('Support email format is invalid');
  }

  const urlRegex = /^https?:\/\/.+/;
  if (config.supportInfo?.supportUrl && !urlRegex.test(config.supportInfo.supportUrl)) {
    errors.push('Support URL format is invalid');
  }
  if (config.supportInfo?.technicalSupportUrl && !urlRegex.test(config.supportInfo.technicalSupportUrl)) {
    errors.push('Technical support URL format is invalid');
  }

  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
  if (config.companyInfo?.domain && !domainRegex.test(config.companyInfo.domain)) {
    errors.push('Company domain format is invalid');
  }

  // Validate Pinecone index name (lowercase, hyphens allowed)
  const pineconeRegex = /^[a-z0-9][a-z0-9\-]*[a-z0-9]$/;
  if (config.deploymentInfo?.pineconeIndexName && !pineconeRegex.test(config.deploymentInfo.pineconeIndexName)) {
    errors.push('Pinecone index name must be lowercase alphanumeric with hyphens');
  }

  // Warnings for missing optional fields
  if (!config.companyInfo?.description) warnings.push('Company description not provided');
  if (!config.productInfo?.abbreviation) warnings.push('Product abbreviation not provided');

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    unreplacedVariables: []
  };
}

/**
 * Create variable replacement map from deployment config
 */
export function createVariableMap(config: DeploymentConfig): Record<string, string> {
  return {
    COMPANY_NAME: config.companyInfo.name,
    COMPANY_DOMAIN: config.companyInfo.domain,
    COMPANY_DESCRIPTION: config.companyInfo.description || 'software',
    PRODUCT_NAME: config.productInfo.name,
    PRODUCT_LATEST_VERSION: config.productInfo.latestVersion,
    PRODUCT_ABBREVIATION: config.productInfo.abbreviation || config.productInfo.name.substring(0, 4).toUpperCase(),
    SUPPORT_EMAIL: config.supportInfo.email,
    SUPPORT_URL: config.supportInfo.supportUrl,
    TECHNICAL_SUPPORT_URL: config.supportInfo.technicalSupportUrl,
    PRODUCTION_URL: config.deploymentInfo.productionUrl,
    PINECONE_INDEX_NAME: config.deploymentInfo.pineconeIndexName
  };
}

/**
 * Replace template variables in file content
 */
export function replaceTemplateVariables(content: string, variableMap: Record<string, string>): string {
  let result = content;
  
  for (const [variable, value] of Object.entries(variableMap)) {
    const pattern = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
    result = result.replace(pattern, value);
  }
  
  return result;
}

/**
 * Find unreplaced template variables in content
 */
export function findUnreplacedVariables(content: string): string[] {
  const pattern = /\{\{([A-Z_]+)\}\}/g;
  const matches = [];
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    matches.push(match[1]);
  }
  
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Validate that all template variables have been replaced in deployed files
 */
export function validateTemplateReplacement(fileContents: Record<string, string>): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allUnreplacedVariables: string[] = [];

  for (const [filepath, content] of Object.entries(fileContents)) {
    const unreplacedVariables = findUnreplacedVariables(content);
    
    if (unreplacedVariables.length > 0) {
      errors.push(`File ${filepath} contains unreplaced variables: ${unreplacedVariables.join(', ')}`);
      allUnreplacedVariables.push(...unreplacedVariables);
    }
  }

  const uniqueUnreplacedVariables = [...new Set(allUnreplacedVariables)];

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    unreplacedVariables: uniqueUnreplacedVariables
  };
}

/**
 * Test deployment configuration with sample values
 */
export function createTestConfig(): DeploymentConfig {
  return {
    companyInfo: {
      name: "Test Company",
      domain: "testcompany.com",
      description: "test software"
    },
    productInfo: {
      name: "TestCAM", 
      latestVersion: "2024",
      abbreviation: "TCAM"
    },
    supportInfo: {
      email: "support@testcompany.com",
      supportUrl: "https://testcompany.com/support", 
      technicalSupportUrl: "https://testcompany.com/technical-support"
    },
    deploymentInfo: {
      productionUrl: "https://chat.testcompany.com/",
      pineconeIndexName: "testcompany-knowledge-base"
    }
  };
}

export default {
  validateDeploymentConfig,
  createVariableMap,
  replaceTemplateVariables,
  findUnreplacedVariables,
  validateTemplateReplacement,
  createTestConfig,
  TEMPLATE_VARIABLES,
  TEMPLATE_FILES
};