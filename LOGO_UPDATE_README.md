# Logo Customization Update

This update removes all SolidCAM branding and replaces it with dynamic logo functionality that uses the uploaded logo from the Chat Factory deployment.

## Files Updated

### ✅ Core Logo Utility
- **Created**: `utils/logo.ts` - Central utility for logo management

### ✅ Authentication & User Flow Pages
- **Updated**: `auth/CustomLoginForm.tsx` - Main login page now uses custom logo
- **Updated**: `pages/account-created-confirmation.tsx` - Account creation confirmation
- **Updated**: `pages/verification-sent.tsx` - Email verification page
- **Updated**: `pages/password-reset-confirmation.tsx` - Password reset page

### ✅ Layout & Core Components
- **Updated**: `components/core/Layout/layout.tsx` - Removed hardcoded URLs
- **Updated**: `pages/_document.tsx` - Dynamic website name and privacy policy URL

### ✅ API Files
- **Updated**: `pages/api/upload.ts` - Removed hardcoded bucket names
- **Updated**: `pages/api/delete.ts` - Updated bucket references  
- **Updated**: `pages/api/refresh-image-url.ts` - Updated bucket references

### ✅ Asset Management
- **Moved**: `public/solidcam.png` → `public/solidcam.png.backup` (for safety)

## Environment Variables Used

The template now uses these environment variables for branding:

```env
NEXT_PUBLIC_CHATBOT_NAME="Your Chatbot Name"
NEXT_PUBLIC_CHATBOT_LOGO_URL="https://firebasestorage.googleapis.com/..."
NEXT_PUBLIC_CHATBOT_PRIMARY_COLOR="#3b82f6"
NEXT_PUBLIC_CHATBOT_DESCRIPTION="AI-powered assistant"
NEXT_PUBLIC_APP_URL="https://yourapp.vercel.app"
```

## How It Works

1. **Logo Resolution**: The `getChatbotLogoUrl()` function checks for custom logo first, falls back to generic bot icon
2. **Error Handling**: If custom logo fails to load, automatically falls back to `/bot-icon-generic.svg`
3. **Dynamic Branding**: All pages now use the chatbot name and logo from environment variables
4. **Responsive**: Logo maintains aspect ratio and has max height constraints

## Testing

After deployment, verify:
- ✅ Login page shows your custom logo
- ✅ Account creation pages show your branding
- ✅ Error pages show your logo
- ✅ If logo fails to load, generic bot icon appears
- ✅ All hardcoded "SolidCAM" references are removed

## Fallback Behavior

If no environment variables are set:
- Logo: `/bot-icon-generic.svg`
- Name: "AI Assistant" 
- Color: "#3b82f6" (blue)
- Description: "AI-powered assistant"

## Benefits

1. **Fully Branded**: Your uploaded logo appears throughout the user journey
2. **Reliable**: Automatic fallbacks prevent broken images
3. **Flexible**: Easy to customize colors, names, and descriptions
4. **Clean**: No hardcoded company-specific references remain
