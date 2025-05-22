# DocsAI Hub Integration Guide

This guide explains how to integrate the ChatFactoryTemplate with your DocsAI hub for automated chatbot deployment.

## Overview

The ChatFactoryTemplate is now a fully generic template that can be customized for any company/product by replacing template variables during deployment. This guide provides the complete integration workflow.

## Integration Architecture

```
DocsAI Hub → Template Clone → Variable Replacement → Environment Setup → Vercel Deploy
```

## Step-by-Step Integration

### 1. Template Preparation

The template is ready for deployment with these key features:
- ✅ All Heroku references removed
- ✅ Generic template variable system implemented  
- ✅ Comprehensive documentation provided
- ✅ Validation tools included

### 2. Hub Deployment Workflow

#### Phase 1: User Input Collection
```typescript
// Use the deployment schema for validation
import schema from './deployment-schema.json';
import { validateDeploymentConfig } from './utils/templateValidation';

// Collect user input through your hub interface
const userConfig = {
  companyInfo: {
    name: "User's Company",
    domain: "usercompany.com"
  },
  productInfo: {
    name: "UserCAM",
    latestVersion: "2024"
  },
  // ... collect all required fields
};

// Validate configuration
const validation = validateDeploymentConfig(userConfig);
if (!validation.isValid) {
  throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
}
```

#### Phase 2: Template Instantiation
```typescript
import { 
  createVariableMap, 
  replaceTemplateVariables,
  TEMPLATE_FILES 
} from './utils/templateValidation';

// 1. Clone fresh copy of ChatFactoryTemplate
const templatePath = await cloneTemplate();

// 2. Create variable replacement map
const variableMap = createVariableMap(userConfig);

// 3. Process all template files
for (const filePath of TEMPLATE_FILES) {
  const content = await readFile(path.join(templatePath, filePath));
  const replacedContent = replaceTemplateVariables(content, variableMap);
  await writeFile(path.join(templatePath, filePath), replacedContent);
}

// 4. Replace asset files (icons, images)
if (userConfig.assets?.botIcon) {
  await replaceAssetFile(
    path.join(templatePath, 'public/bot-icon-placeholder.svg'),
    userConfig.assets.botIcon
  );
}

if (userConfig.assets?.favicon) {
  await replaceAssetFile(
    path.join(templatePath, 'public/favicon.ico'),
    userConfig.assets.favicon
  );
}
```

#### Asset Replacement Helper
```typescript
async function replaceAssetFile(filePath, assetData) {
  if (assetData.startsWith('data:')) {
    // Handle base64 encoded assets
    const base64Data = assetData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(filePath, buffer);
  } else if (assetData.startsWith('http')) {
    // Handle URL assets
    const response = await fetch(assetData);
    const buffer = await response.buffer();
    await writeFile(filePath, buffer);
  } else {
    // Handle file path assets
    await copyFile(assetData, filePath);
  }
}
```

#### Phase 3: Deployment Validation
```typescript
import { validateTemplateReplacement } from './utils/templateValidation';

// Read all processed files
const fileContents = {};
for (const filePath of TEMPLATE_FILES) {
  fileContents[filePath] = await readFile(path.join(templatePath, filePath));
}

// Validate no template variables remain
const validationResult = validateTemplateReplacement(fileContents);
if (!validationResult.isValid) {
  throw new Error(`Template validation failed: ${validationResult.errors.join(', ')}`);
}
```

#### Phase 4: Environment Configuration
```typescript
// Create environment variables for deployment
const envVars = {
  // Database (create unique DB per client)
  DATABASE_URL: createClientDatabase(userConfig),
  
  // AI Provider (use client's keys or your managed keys)
  OPENAI_API_KEY: userConfig.openaiApiKey || managedOpenAIKey,
  
  // Pinecone (client-specific index)
  PINECONE_API_KEY: userConfig.pineconeApiKey || managedPineconeKey,
  PINECONE_INDEX_NAME: userConfig.deploymentInfo.pineconeIndexName,
  
  // Firebase (create unique project per client)
  ...createFirebaseConfig(userConfig),
  
  // Google Cloud (client-specific bucket)
  GCLOUD_STORAGE_BUCKET: createStorageBucket(userConfig),
  GOOGLE_APPLICATION_CREDENTIALS_BASE64: createServiceAccountKey(userConfig),
  
  // Application URLs
  NEXT_PUBLIC_SERVER_URL: userConfig.deploymentInfo.productionUrl,
  
  // Analytics (optional)
  NEXT_PUBLIC_GA_MEASUREMENT_ID: userConfig.analyticsId
};
```

#### Phase 5: Vercel Deployment
```typescript
// Deploy to Vercel with custom domain
const deployment = await vercel.deploy({
  name: `chatbot-${userConfig.companyInfo.domain.replace('.', '-')}`,
  source: templatePath,
  env: envVars,
  domains: [userConfig.deploymentInfo.customDomain],
  framework: 'nextjs'
});

// Wait for deployment to complete
await waitForDeployment(deployment.id);
```

#### Phase 6: Post-Deployment Testing
```typescript
// Automated testing of deployed chatbot
const tests = [
  () => testPageLoad(deployment.url),
  () => testChatInterface(deployment.url),
  () => testAIResponses(deployment.url),
  () => testAuthentication(deployment.url),
  () => testImageUpload(deployment.url)
];

const testResults = await Promise.all(tests.map(test => test()));
const allTestsPassed = testResults.every(result => result.success);

if (!allTestsPassed) {
  await rollbackDeployment(deployment.id);
  throw new Error('Post-deployment tests failed');
}
```

## Required Hub Capabilities

### File Processing
Your hub needs to:
1. **Clone template repository** from ChatFactoryTemplate
2. **Read/write files** for variable replacement
3. **Validate file contents** before deployment

### External Service Integration
1. **Database Creation**: PostgreSQL instance per client
2. **Firebase Projects**: Separate auth project per client  
3. **Pinecone Indexes**: Separate vector database per client
4. **Google Cloud Storage**: Separate bucket per client
5. **Vercel Deployment**: Automated deployment with custom domain

### Monitoring & Maintenance
1. **Health Checks**: Monitor deployed chatbots
2. **Error Tracking**: Capture and report deployment issues
3. **Updates**: Handle template version updates
4. **Backups**: Regular backup of client configurations

## Error Handling

### Common Issues & Solutions

**Template Variable Not Replaced**
```typescript
// Check: All TEMPLATE_FILES processed
// Check: Variable name spelling in template
// Check: Variable provided in config
```

**Deployment Fails**
```typescript
// Check: All environment variables set
// Check: External services (DB, Firebase) configured
// Check: Custom domain DNS settings
```

**Post-Deployment Issues**  
```typescript
// Check: AI API keys valid and have quota
// Check: Database accessible and migrated
// Check: Storage bucket permissions correct
```

## Testing & Validation

### Local Testing
```bash  
# Test template system locally
cd ChatFactoryTemplate
npm install
npm run dev
# Verify template variables load correctly
```

### Deployment Testing
Use the test configuration from `templateValidation.ts`:
```typescript
import { createTestConfig } from './utils/templateValidation';
const testConfig = createTestConfig();
// Deploy with test configuration
// Run automated tests
// Clean up test deployment
```

## Security Considerations

1. **API Keys**: Store securely, rotate regularly
2. **Database Access**: Use connection pooling, restrict permissions
3. **File Processing**: Validate file paths, prevent directory traversal
4. **Environment Variables**: Never log sensitive values
5. **Custom Domains**: Validate domain ownership before deployment

## Monitoring & Analytics

Track these metrics for deployed chatbots:
- Deployment success rate
- Response time/availability  
- User engagement (messages, sessions)
- Error rates and types
- Resource usage (database, AI API calls)

## Support & Maintenance

### Template Updates
When ChatFactoryTemplate is updated:
1. Update your hub's template repository
2. Test new template with validation tools
3. Deploy to staging environment  
4. Roll out to production deployments

### Client Support
Provide clients with:
- Deployment status dashboard
- Usage analytics  
- Configuration management interface
- Support ticket system

---

## Quick Start Checklist

For hub developers integrating this template:

- [ ] Review `TEMPLATE_VARIABLES.md` - understand all variables
- [ ] Implement deployment schema validation using `deployment-schema.json`
- [ ] Use `utils/templateValidation.ts` for all file processing
- [ ] Set up external service integrations (DB, Firebase, Pinecone, etc.)
- [ ] Implement Vercel deployment pipeline
- [ ] Create automated testing suite
- [ ] Set up monitoring and error tracking
- [ ] Test end-to-end with sample configuration

**Template is ready for production integration!** 🚀

---

*Last Updated: May 22, 2025*  
*Template Version: 1.0.0*