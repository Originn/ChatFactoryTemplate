# Template Variables Documentation

This document provides a comprehensive guide to all template variables used in the ChatFactoryTemplate. The DocsAI hub will replace these variables when creating new chatbot instances.

## Variable Format
All template variables follow the format: `{{VARIABLE_NAME}}`

## Required Variables

### Company Information
| Variable | Description | Example Value | Usage |
|----------|-------------|---------------|-------|
| `{{COMPANY_NAME}}` | Full company name for branding | "Acme Corporation" | UI labels, copyright notices, prompts |
| `{{COMPANY_DOMAIN}}` | Company domain without protocol | "acme.com" | Pinecone namespaces, configurations |
| `{{COMPANY_DESCRIPTION}}` | Brief company description | "manufacturing software" | Meta descriptions, prompts |

### Product Information  
| Variable | Description | Example Value | Usage |
|----------|-------------|---------------|-------|
| `{{PRODUCT_NAME}}` | Product display name | "AcmeCAM" | UI titles, AI prompts, documentation |
| `{{PRODUCT_LATEST_VERSION}}` | Current product version year | "2024" | AI prompts, default year references |
| `{{PRODUCT_ABBREVIATION}}` | Short product code | "ACAM" | Internal references, configurations |

### Support & Contact
| Variable | Description | Example Value | Usage |
|----------|-------------|---------------|-------|
| `{{SUPPORT_EMAIL}}` | Support contact email | "support@acme.com" | Error messages, help text |
| `{{SUPPORT_URL}}` | General support page URL | "https://acme.com/support" | Help links, documentation |
| `{{TECHNICAL_SUPPORT_URL}}` | Technical support page URL | "https://acme.com/technical-support" | AI prompts, critical support links |

### Deployment Configuration
| Variable | Description | Example Value | Usage |
|----------|-------------|---------------|-------|
| `{{PRODUCTION_URL}}` | Deployment base URL | "https://chat.acme.com/" | Image paths, asset loading |
| `{{PINECONE_INDEX_NAME}}` | Vector database index name | "acme-knowledge-base" | Pinecone configuration |

### Asset Replacements
| Asset | File Path | Description | Replacement Instructions |
|-------|-----------|-------------|-------------------------|
| Bot Icon | `public/bot-icon-placeholder.svg` | Chatbot avatar icon | Replace with client's bot icon (64x64px recommended, SVG/PNG) |
| Favicon | `public/favicon.ico` | Browser tab icon | Replace with client's favicon |

## Variable Usage by File

### High-Impact Files (Core Functionality)
- **`utils/prompts/promptTemplates.ts`**: 8 variables used in AI prompts
- **`utils/prompts/deepseekPrompt.ts`**: 8 variables used in AI prompts  
- **`utils/makechain.ts`**: 2 variables in conversation titles
- **`pages/_app.tsx`**: 2 variables in page metadata
- **`components/core/Chat/ChatContainer.tsx`**: 3 variables in UI

### Configuration Files
- **`config/pinecone.ts`**: 2 variables for database configuration
- **`next.config.js`**: Deployment domain configuration
- **`README.md`**: All variables used in documentation

## Variable Replacement Strategy

### Development Mode
When `NODE_ENV === 'development'`, the template uses fallback values:
```typescript
{
  companyName: "Your Company",
  productName: "Your Product", 
  productLatestVersion: "2024",
  // ... etc
}
```

### Production Deployment
The DocsAI hub should perform string replacement on ALL files before deployment:

1. **Text-based replacement** in these file types:
   - `.ts`, `.tsx`, `.js`, `.jsx` files
   - `.md` files  
   - `.json` files
   - `.env.example` file

2. **Build-time replacement** recommended for optimal performance

3. **Files to exclude** from replacement:
   - `node_modules/`
   - `.git/`
   - `.next/`
   - Binary files

## Validation Requirements

### Pre-deployment Validation
The hub should validate that all required variables are provided:
- No `{{VARIABLE_NAME}}` patterns remain in deployed files
- All URLs are valid and accessible
- Email addresses are properly formatted
- Product names don't contain special characters that could break functionality

### Post-deployment Testing
- Verify AI prompts contain correct product/company names
- Check UI displays correct branding
- Confirm support links work correctly
- Test image loading from production URL

## Environment Variables

These environment variables will also need to be configured per deployment:
```env
# Database (unique per client)
DATABASE_URL=

# AI Provider Keys (client-specific)  
OPENAI_API_KEY=

# Pinecone (client-specific)
PINECONE_API_KEY=
PINECONE_INDEX_NAME={{PINECONE_INDEX_NAME}}

# Firebase (unique project per client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
# ... other Firebase variables

# Google Cloud (client-specific)
GCLOUD_STORAGE_BUCKET=
GOOGLE_APPLICATION_CREDENTIALS_BASE64=

# Application URLs
NEXT_PUBLIC_SERVER_URL={{PRODUCTION_URL}}
```

## Template Testing

To test the template system locally:
1. Modify values in `config/template.ts`
2. Run `npm run dev`
3. Verify changes appear in UI and functionality works
4. Test with different company/product combinations

## Integration Notes for DocsAI Hub

### Recommended Deployment Flow
1. **User Input**: Collect all required variables through hub interface
2. **Validation**: Verify all inputs meet requirements
3. **Template Clone**: Create fresh copy of ChatFactoryTemplate
4. **Variable Replacement**: Replace all `{{VARIABLE_NAME}}` instances
5. **Environment Setup**: Configure client-specific environment variables
6. **Build & Deploy**: Deploy to Vercel with custom domain
7. **Post-deployment Test**: Automated testing of key functionality

### Error Handling
- If any `{{VARIABLE_NAME}}` remains after replacement, deployment should fail
- Provide clear error messages indicating which variables are missing
- Log all replacements for debugging purposes

---

**Last Updated**: May 22, 2025
**Template Version**: 1.0.0