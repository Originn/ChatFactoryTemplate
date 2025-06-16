# Custom Domain Configuration

This template supports custom domains for your chatbot deployment. When a custom domain is configured, the chatbot will automatically adapt its branding and behavior.

## How It Works

### 1. Domain Detection
The template automatically detects whether it's being accessed via:
- **Custom Domain** (e.g., `chat.yourcompany.com`)
- **Vercel Domain** (e.g., `your-chatbot.vercel.app`)
- **Local Development** (e.g., `localhost:3000`)

### 2. Environment Variable
The custom domain is configured via the `NEXT_PUBLIC_CUSTOM_DOMAIN` environment variable:

```bash
NEXT_PUBLIC_CUSTOM_DOMAIN=chat.yourcompany.com
```

### 3. Automatic Branding
When accessed via a custom domain:
- ✅ **"Powered by ChatFactory"** is hidden
- ✅ **Company branding** takes priority
- ✅ **SEO and social meta tags** use custom domain
- ✅ **Middleware** handles routing correctly

When accessed via Vercel domain:
- ❌ **"Powered by ChatFactory"** is shown
- ❌ **Standard branding** is displayed

## Files Modified

### Core Files
- `middleware.ts` - Domain routing and detection
- `utils/customDomain.ts` - Domain utilities and configuration
- `hooks/useDomain.ts` - React hook for domain information
- `config/template.ts` - Template configuration with domain support

### Components
- `components/core/DomainAwareBranding.tsx` - Smart branding component
- `components/core/Chat/ChatContainer.tsx` - Updated to use domain-aware branding

### Configuration
- `next.config.js` - Custom domain headers and environment
- `.env.example` - Added NEXT_PUBLIC_CUSTOM_DOMAIN variable

### API
- `pages/api/domain/status.ts` - Domain status endpoint for debugging

## Usage in Components

### Using the Domain Hook
```tsx
import { useDomain } from '@/hooks/useDomain';

function MyComponent() {
  const { domainConfig, branding, isCustomDomain } = useDomain();
  
  return (
    <div>
      {isCustomDomain ? (
        <h1>Welcome to {branding.companyName}</h1>
      ) : (
        <h1>Welcome to our chatbot</h1>
      )}
    </div>
  );
}
```

### Using Domain Utilities
```tsx
import { getDomainConfig, getDomainBranding } from '@/utils/customDomain';

// Server-side usage
export async function getServerSideProps({ req }) {
  const domainConfig = getDomainConfig(req);
  const branding = getDomainBranding(req);
  
  return {
    props: {
      isCustomDomain: domainConfig.isCustomDomain,
      companyName: branding.companyName
    }
  };
}
```

## Deployment Process

1. **ChatFactory App** saves custom domain to Firestore
2. **Vercel Deploy API** configures domain on Vercel project
3. **Environment Variables** are set including `NEXT_PUBLIC_CUSTOM_DOMAIN`
4. **Template Deployment** automatically detects and uses custom domain
5. **DNS Configuration** is handled by the user (CNAME/A records)

## Domain Verification

The template includes utilities for domain verification:

```tsx
import { getDomainVerificationInstructions } from '@/utils/customDomain';

const instructions = getDomainVerificationInstructions('chat.example.com');
// Returns DNS setup instructions
```

## Debug Information

In development mode, the `DomainAwareBranding` component shows debug information:
- Current domain
- Custom domain status
- Environment configuration

## API Endpoint

Check domain status via: `GET /api/domain/status`

Returns:
```json
{
  "success": true,
  "domain": {
    "current": "chat.example.com",
    "custom": "chat.example.com",
    "isCustomDomain": true,
    "isLocal": false,
    "isVercel": false
  },
  "branding": {
    "companyName": "Your Company",
    "chatbotName": "AI Assistant",
    "showPoweredBy": false
  }
}
```

## Environment Variables

Add to your `.env` file:
```bash
# Custom Domain (Optional)
NEXT_PUBLIC_CUSTOM_DOMAIN=chat.yourcompany.com
```

## DNS Configuration

To use a custom domain, configure DNS:

### Option 1: CNAME Record
```
chat.yourcompany.com CNAME your-chatbot.vercel.app
```

### Option 2: A Record
```
chat.yourcompany.com A 76.76.21.21
```

The domain will be automatically verified through Vercel's domain verification process.
