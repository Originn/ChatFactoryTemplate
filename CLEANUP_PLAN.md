# ChatFactoryTemplate Cleanup Plan

## Overview
Convert SolidCAM-specific chatbot into a generic template for DocsAI chatbot creation hub.

## Phase 1: Remove Heroku Infrastructure ⏳
**Goal**: Remove all Heroku-specific deployment files and configurations

### Files to Delete:
- [ ] `Procfile` - Heroku process definition
- [ ] `.slugignore` - Heroku build exclusion file  
- [ ] `server.cjs` - Custom Express server for Heroku deployment
- [ ] `scripts/decode-google-credentials.js` - Heroku credential decoder
- [ ] `scripts/release-tasks.js` - Heroku release phase tasks
- [ ] `scripts/release-migration.cjs` - Heroku migration runner

### Package.json Updates:
- [ ] Remove `heroku-prebuild` script
- [ ] Remove `heroku-postbuild` script
- [ ] Update `name` from "solidcam-chat" to "chatbot-template"
- [ ] Update `author` field to be generic
- [ ] Remove "solidcam" from `keywords` array
- [ ] Consider removing `engines` section (not needed for Vercel)

### Code Updates:
- [ ] Update `dev` script to use standard Next.js dev server
- [ ] Remove any Heroku timeout configurations
- [ ] Remove domain redirect logic from server files

## Phase 2: Generic Template Conversion ⏳
**Goal**: Replace SolidCAM-specific references with template variables

### High Priority Files (Core Functionality):
- [ ] `utils/prompts/promptTemplates.ts` (18 references)
- [ ] `utils/prompts/deepseekPrompt.ts` (13 references)
- [ ] `utils/makechain.ts` (11 references)
- [ ] `pages/_app.tsx` (app title)
- [ ] `components/core/Chat/ChatContainer.tsx` (UI labels)

### Medium Priority Files (Configuration):
- [ ] `next.config.js`
- [ ] `config/pinecone.ts`
- [ ] `.env.example`

### Template Variable System:
Create placeholders for:
- [ ] `{{COMPANY_NAME}}` - Company display name
- [ ] `{{COMPANY_DOMAIN}}` - Company website domain
- [ ] `{{COMPANY_DESCRIPTION}}` - Brief company description
- [ ] `{{SUPPORT_EMAIL}}` - Support contact email
- [ ] `{{PRIVACY_POLICY_URL}}` - Privacy policy URL

### Lower Priority Files (Content/UI):
- [ ] `README.md`
- [ ] `pages/privacy-policy.tsx`
- [ ] Authentication pages
- [ ] Modal components
- [ ] Form labels and content

## Phase 3: Template Variables & Hub Integration ⏳
**Goal**: Implement variable replacement system and integrate with DocsAI hub

### Environment Variables:
- [ ] Review and genericize environment variable defaults
- [ ] Create template for client-specific configurations:
  - [ ] `PINECONE_INDEX_NAME`
  - [ ] `GCLOUD_STORAGE_BUCKET` 
  - [ ] `NEXT_PUBLIC_SERVER_URL`
  - [ ] Firebase project settings

### Hub Integration:
- [ ] Define variable replacement interface
- [ ] Create deployment pipeline integration points
- [ ] Test template instantiation process

### Documentation:
- [ ] Update README with template usage instructions
- [ ] Document required environment variables
- [ ] Create deployment guide for hub integration

## Dependencies to Review Per Client:
- **Firebase**: Separate project per client
- **Pinecone**: Separate indexes per client  
- **Google Cloud Storage**: Separate buckets per client
- **Database**: Separate schemas/databases per client

## Success Criteria:
- ✅ No Heroku references remaining
- ✅ No SolidCAM hardcoded references
- ✅ Template can be instantiated with custom company info
- ✅ Deployment handled entirely by DocsAI hub
- ✅ All functionality preserved during conversion