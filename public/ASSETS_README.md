# Public Assets - Template Placeholders

This directory contains placeholder assets that should be replaced during deployment through the DocsAI hub.

## Assets to Replace

### Bot Icon
- **File**: `bot-icon-placeholder.svg`
- **Description**: Chatbot avatar displayed in conversations
- **Recommended Size**: 64x64 pixels
- **Formats**: SVG (preferred), PNG, JPG
- **Usage**: Users upload their custom bot icon through DocsAI hub interface

### Favicon  
- **File**: `favicon.ico`
- **Description**: Browser tab icon
- **Recommended Size**: 32x32 pixels (multi-size ICO preferred)
- **Formats**: ICO (preferred), PNG
- **Usage**: Users upload their custom favicon through DocsAI hub interface

### User Icon
- **File**: `usericon.png` 
- **Description**: Default user avatar (typically not customized per client)
- **Current**: Generic user icon
- **Usage**: Usually kept as-is unless client requests custom user avatars

## Deployment Process

During chatbot deployment, the DocsAI hub will:

1. **Collect Assets**: User uploads bot icon and favicon through hub interface
2. **Validate Assets**: Check file size, format, and dimensions
3. **Replace Files**: Overwrite placeholder files with user's custom assets
4. **Update References**: Ensure all file paths point to correct assets

## File Formats Supported

- **SVG**: Scalable, preferred for icons
- **PNG**: High quality, transparency support
- **JPG**: Good for photos, no transparency
- **ICO**: Multi-size format for favicons

## Size Recommendations

- **Bot Icon**: 64x64px (will be displayed at various sizes)
- **Favicon**: 32x32px with 16x16px fallback in ICO format
- **Maximum File Size**: 500KB per asset

---

*Note: These are placeholder assets for the ChatFactoryTemplate. They will be automatically replaced during deployment through the DocsAI hub.*