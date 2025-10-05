# Automated Firebase Chatbot Deployment Guide

**Complete automation guide** for deploying a chatbot with OAuth authentication using Firebase and Vercel. All steps are automated except OAuth redirect URI configuration.

## Overview

This guide provides **fully automated commands** for deploying a chatbot from `ChatFactoryTemplate` to a Firebase project with Google OAuth authentication and Vercel hosting.

**What's Automated:**
- ✅ Firebase project creation
- ✅ Service enablement
- ✅ Firebase web app creation
- ✅ Authentication provider configuration
- ✅ Environment variable setup
- ✅ Deployment to Vercel

**Manual Step Required:**
- ❌ OAuth redirect URIs (Google Cloud limitation)

## Prerequisites

- Vercel account
- Google Cloud Console access with billing enabled
- Firebase CLI installed and authenticated
- gcloud CLI installed and authenticated
- Service account key for `docsai-chatbot-app` (for central tracking)

## Initial Setup

Before running the deployment, ensure you have the main service account key:

```bash
# Download the main service account key (one time setup)
gcloud iam service-accounts keys create "./keys/docsai-chatbot-app-main-key.json" \
  --iam-account="firebase-project-manager@docsai-chatbot-app.iam.gserviceaccount.com" \
  --project="docsai-chatbot-app"
```

## Step 1: Firebase Project Setup

### 1.1 Automated Project Creation

```bash
# Variables - Update these for your project
PROJECT_ID="chatfactory-pool-002"
PROJECT_NAME="ChatFactory Pool 002"
BILLING_ACCOUNT_ID="YOUR_BILLING_ACCOUNT_ID"  # Get from: gcloud billing accounts list

# Create Google Cloud project
gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"

# Link billing account (required for Firebase)
gcloud billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID

# Enable required APIs
gcloud services enable firebase.googleapis.com --project=$PROJECT_ID
gcloud services enable firebasehosting.googleapis.com --project=$PROJECT_ID
gcloud services enable identitytoolkit.googleapis.com --project=$PROJECT_ID
gcloud services enable firestore.googleapis.com --project=$PROJECT_ID

# Add Firebase to the Google Cloud project
firebase projects:addfirebase $PROJECT_ID

# Create Firestore database
gcloud firestore databases create --location=us-central1 --project=$PROJECT_ID

# Enable Secret Manager for project tracking
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

# Create dedicated service account for this project
gcloud iam service-accounts create chatbot-service-account \
  --project=$PROJECT_ID \
  --display-name="Chatbot Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:chatbot-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:chatbot-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

# Create and download service key
mkdir -p ./keys
gcloud iam service-accounts keys create "./keys/$PROJECT_ID-service-key.json" \
  --iam-account="chatbot-service-account@$PROJECT_ID.iam.gserviceaccount.com"
```

### 1.2 Automated Firebase App Creation & Configuration

```bash
# Set project context
gcloud config set project $PROJECT_ID

# Create Firebase web app and capture the app ID
echo "Creating Firebase web app..."
APP_ID=$(firebase apps:create web "Pool Project Auth Setup Chatbot (Reusable) App" --project=$PROJECT_ID | grep -o '1:[0-9]*:web:[a-z0-9]*')

# Get Firebase configuration
echo "Getting Firebase configuration..."
firebase apps:sdkconfig web $APP_ID > firebase-config.json

# Extract configuration values for environment setup
API_KEY=$(jq -r '.apiKey' firebase-config.json)
AUTH_DOMAIN=$(jq -r '.authDomain' firebase-config.json)
PROJECT_ID_FROM_CONFIG=$(jq -r '.projectId' firebase-config.json)
STORAGE_BUCKET=$(jq -r '.storageBucket' firebase-config.json)
MESSAGING_SENDER_ID=$(jq -r '.messagingSenderId' firebase-config.json)
MEASUREMENT_ID=$(jq -r '.measurementId' firebase-config.json)

echo "✅ Firebase app created with ID: $APP_ID"
echo "✅ Configuration saved to firebase-config.json"
```

## Step 2: Automated Environment Configuration

### 2.1 Generate Environment Variables

```bash
# Read existing .env.local and create backup
cp .env.local .env.local.backup

# Update Firebase configuration automatically
cat > temp_firebase_vars.txt << EOF
NEXT_PUBLIC_FIREBASE_API_KEY=$API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID_FROM_CONFIG
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=$APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$MEASUREMENT_ID
EOF

# Remove old Firebase variables and add new ones
grep -v "NEXT_PUBLIC_FIREBASE_" .env.local > .env.local.temp
cat temp_firebase_vars.txt >> .env.local.temp
mv .env.local.temp .env.local

# Clean up
rm temp_firebase_vars.txt firebase-config.json

echo "✅ Environment variables updated automatically"
```

### 2.2 Avoid sync-env Issues

**CRITICAL**: The `package.json` contains a `sync-env` script that can overwrite your local environment with old Vercel environment variables:

```json
"sync-env": "vercel link --yes --project=OLD_PROJECT && ... && vercel env pull --yes .env.local"
```

**Solutions:**
1. **Recommended**: Use `npm run build:prod` for deployment (skips sync-env)
2. **Alternative**: Update the project name in sync-env script to match your new deployment

## Step 3: Automated Firebase Authentication Setup

### 3.1 Enable Authentication Providers Automatically

```bash
# Authenticate with project service account
export GOOGLE_APPLICATION_CREDENTIALS="./keys/$PROJECT_ID-service-key.json"
gcloud auth activate-service-account --key-file="./keys/$PROJECT_ID-service-key.json"

# Get access token for API calls
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Enable Email/Password provider
echo "Enabling Email/Password authentication..."
curl -s -X PATCH "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signIn": {
      "allowDuplicateEmails": false,
      "email": {
        "enabled": true,
        "passwordRequired": true
      }
    }
  }' > /dev/null

# Enable Google OAuth provider (this will auto-create OAuth client)
echo "Enabling Google OAuth provider..."
curl -s -X POST "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs?idpId=google.com" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "clientId": "",
    "clientSecret": ""
  }' > /dev/null

echo "✅ Authentication providers enabled"
```

### 3.2 Get OAuth Client Information

```bash
# Get the OAuth client ID that Firebase created
echo "Getting OAuth client configuration..."
OAUTH_CONFIG=$(curl -s -X GET "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs/google.com" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

# Extract client ID for next step
OAUTH_CLIENT_ID=$(echo $OAUTH_CONFIG | jq -r '.clientId')
echo "✅ OAuth Client ID: $OAUTH_CLIENT_ID"
```

### 3.3 Set Project Availability Tracking

```bash
# Create project availability secret (false = available, true = in use)
echo "Setting up project tracking..."
echo "false" | gcloud secrets create project-in-use --data-file=- --project=$PROJECT_ID

# Authenticate with main service account for central tracking
export GOOGLE_APPLICATION_CREDENTIALS="./keys/docsai-chatbot-app-main-key.json"
gcloud auth activate-service-account --key-file="./keys/docsai-chatbot-app-main-key.json"
ACCESS_TOKEN_MAIN=$(gcloud auth print-access-token)

# Switch back to project service account
export GOOGLE_APPLICATION_CREDENTIALS="./keys/$PROJECT_ID-service-key.json"
gcloud auth activate-service-account --key-file="./keys/$PROJECT_ID-service-key.json"

# Add project to available projects collection
curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN_MAIN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fields\": {
      \"$PROJECT_ID\": {
        \"mapValue\": {
          \"fields\": {
            \"status\": {\"stringValue\": \"available\"},
            \"createdAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
            \"lastChecked\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
            \"projectName\": {\"stringValue\": \"$PROJECT_NAME\"}
          }
        }
      }
    }
  }" > /dev/null

echo "✅ Project tracking configured"
```

## Step 4: **MANUAL STEP** - OAuth Redirect URI Configuration

⚠️ **This is the only manual step required** - Google doesn't provide an API to update OAuth redirect URIs.

### 4.1 Display Configuration Instructions

```bash
# Display the information you need for manual configuration
echo "==========================================="
echo "MANUAL CONFIGURATION REQUIRED"
echo "==========================================="
echo "Go to: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "Find OAuth Client ID: $OAUTH_CLIENT_ID"
echo ""
echo "Add these Authorized JavaScript origins:"
echo "  - https://$PROJECT_ID.firebaseapp.com"
echo "  - http://localhost"
echo "  - http://localhost:5000"
echo ""
echo "Add these Authorized redirect URIs:"
echo "  - https://$PROJECT_ID.firebaseapp.com/__/auth/handler"
echo ""
echo "Save and wait 5-15 minutes for propagation."
echo "==========================================="
```

### 4.2 Manual Steps Required

1. Open the Google Cloud Console URL displayed above
2. Find and edit the OAuth client ID shown above
3. Add the JavaScript origins and redirect URIs as displayed
4. Save the configuration
5. Wait 5-15 minutes for changes to propagate globally

## Step 5: Automated Deployment

### 5.1 Deploy to Vercel

```bash
# Deploy using build:prod to avoid sync-env issues
echo "Building and deploying to Vercel..."
npm run build:prod
VERCEL_URL=$(vercel --prod | grep -o 'https://[^[:space:]]*')

echo "✅ Deployed to: $VERCEL_URL"
echo ""
echo "🔄 After OAuth configuration (Step 4), test at: $VERCEL_URL"
```

### 5.3 Mark Project as In Use

```bash
# Mark project as in use after successful deployment
echo "Marking project as in use..."

# Update secret to indicate project is in use
echo "true" | gcloud secrets versions add project-in-use --data-file=- --project=$PROJECT_ID

# Update central tracking collection
ACCESS_TOKEN_MAIN=$(gcloud auth print-access-token)
curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN_MAIN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fields\": {
      \"$PROJECT_ID\": {
        \"mapValue\": {
          \"fields\": {
            \"status\": {\"stringValue\": \"in-use\"},
            \"deployedAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
            \"vercelUrl\": {\"stringValue\": \"$VERCEL_URL\"},
            \"lastChecked\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
            \"projectName\": {\"stringValue\": \"$PROJECT_NAME\"}
          }
        }
      }
    }
  }" > /dev/null

echo "✅ Project marked as in use"
```

### 5.2 Automated Testing (after OAuth setup)

```bash
# Once OAuth is configured, you can test the deployment
echo "Testing OAuth functionality..."
echo "1. Visit: $VERCEL_URL"
echo "2. Click 'Sign in with Google'"
echo "3. Verify redirect to: https://$PROJECT_ID.firebaseapp.com/__/auth/handler"
echo "4. Confirm successful authentication"
```

## Step 6: Troubleshooting

### Common Issues

#### Issue: `redirect_uri_mismatch`
**Cause**: OAuth client doesn't have the correct redirect URI
**Fix**: Add `https://chatfactory-pool-002.firebaseapp.com/__/auth/handler` to authorized redirect URIs

#### Issue: OAuth redirects to old Firebase project
**Cause**: Environment variables still point to old project
**Fix**: Verify `.env.local` has correct Firebase configuration for new project

#### Issue: `auth/unauthorized-domain`
**Cause**: Vercel domain not in Firebase authorized domains
**Fix**: Add Vercel domain to Firebase Auth settings, or use Firebase hosting domain only

#### Issue: Wrong API key in OAuth URL
**Cause**: `sync-env` script pulled old environment variables
**Fix**: Use `npm run build:prod` or update environment variables

### Verification Checklist

- [ ] Firebase project has Google Sign-in enabled
- [ ] OAuth client has correct redirect URI (`chatfactory-pool-002.firebaseapp.com/__/auth/handler`)
- [ ] `.env.local` uses correct Firebase project configuration
- [ ] OAuth flow redirects to correct Firebase domain
- [ ] Authentication completes successfully

## Key Learnings

1. **Firebase Auth Pattern**: Use Firebase hosting domain for OAuth, not Vercel domain
2. **Environment Variable Management**: Be careful with `sync-env` script overwriting local config
3. **OAuth Propagation**: Changes to OAuth settings take 5-15 minutes to propagate
4. **Multiple OAuth Clients**: One Firebase project can have multiple OAuth clients - ensure you're configuring the right one
5. **Build Process**: Use `build:prod` to avoid environment variable conflicts

## For chatfactory-pool-002 Deployment

Replace all instances of `chatfactory-pool-001` with `chatfactory-pool-002` in:
- Environment variables
- OAuth redirect URIs
- Firebase console URLs
- All commands in this guide

## Example Working URLs

After successful deployment:
- **Vercel App**: `https://your-app-name.vercel.app`
- **OAuth Redirect**: `https://chatfactory-pool-002.firebaseapp.com/__/auth/handler`
- **Firebase Console**: `https://console.firebase.google.com/project/chatfactory-pool-002`
- **Google Cloud Console**: `https://console.cloud.google.com/apis/credentials?project=chatfactory-pool-002`

## Complete Automation Script

### Single Command Deployment

Save this as `deploy-chatbot.sh` for one-command deployment:

```bash
#!/bin/bash

# Configuration
BILLING_ACCOUNT_ID="YOUR_BILLING_ACCOUNT_ID"  # Update this

echo "🚀 Starting automated chatbot deployment"

# Step 0: Set up authentication for central tracking
echo "🔐 Setting up authentication..."
export GOOGLE_APPLICATION_CREDENTIALS="./keys/docsai-chatbot-app-main-key.json"
gcloud auth activate-service-account --key-file="./keys/docsai-chatbot-app-main-key.json"

# Step 0: Find available project or create new one
find_available_project() {
  echo "🔍 Finding available project..."
  ACCESS_TOKEN=$(gcloud auth print-access-token)
  AVAILABLE_PROJECTS=$(curl -s -X GET "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  echo "$AVAILABLE_PROJECTS" | jq -r '.fields | to_entries[] | select(.value.mapValue.fields.status.stringValue == "available") | .key' | while read proj; do
    if [ ! -z "$proj" ]; then
      gcloud config set project $proj 2>/dev/null
      SECRET_VALUE=$(gcloud secrets versions access latest --secret="project-in-use" --project=$proj 2>/dev/null)
      if [ "$SECRET_VALUE" = "false" ]; then
        echo "$proj"
        return 0
      fi
    fi
  done
  return 1
}

AVAILABLE_PROJECT=$(find_available_project)
if [ ! -z "$AVAILABLE_PROJECT" ]; then
  echo "✅ Using available project: $AVAILABLE_PROJECT"
  PROJECT_ID="$AVAILABLE_PROJECT"
  PROJECT_NAME="ChatFactory Pool $(echo $PROJECT_ID | grep -o '[0-9]*$')"
  SKIP_PROJECT_CREATION=true
else
  echo "📝 Creating new project..."
  PROJECT_ID="chatfactory-pool-$(date +%s | tail -c 4)"
  PROJECT_NAME="ChatFactory Pool $(echo $PROJECT_ID | grep -o '[0-9]*$')"
  SKIP_PROJECT_CREATION=false
fi

echo "🎯 Target project: $PROJECT_ID"

# Step 1: Create Firebase project (if needed)
if [ "$SKIP_PROJECT_CREATION" = "false" ]; then
  echo "📁 Creating Firebase project..."
  gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"
  gcloud billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID
  gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com identitytoolkit.googleapis.com firestore.googleapis.com secretmanager.googleapis.com --project=$PROJECT_ID
  firebase projects:addfirebase $PROJECT_ID
  gcloud firestore databases create --location=us-central1 --project=$PROJECT_ID
else
  echo "♻️  Using existing project, ensuring services are enabled..."
  gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com identitytoolkit.googleapis.com firestore.googleapis.com secretmanager.googleapis.com --project=$PROJECT_ID
fi

# Step 2: Create Firebase app
echo "🔥 Creating Firebase web app..."
gcloud config set project $PROJECT_ID
APP_ID=$(firebase apps:create web "Pool Project Auth Setup Chatbot (Reusable) App" --project=$PROJECT_ID | grep -o '1:[0-9]*:web:[a-z0-9]*')
firebase apps:sdkconfig web $APP_ID > firebase-config.json

# Step 3: Extract configuration
API_KEY=$(jq -r '.apiKey' firebase-config.json)
AUTH_DOMAIN=$(jq -r '.authDomain' firebase-config.json)
PROJECT_ID_FROM_CONFIG=$(jq -r '.projectId' firebase-config.json)
STORAGE_BUCKET=$(jq -r '.storageBucket' firebase-config.json)
MESSAGING_SENDER_ID=$(jq -r '.messagingSenderId' firebase-config.json)
MEASUREMENT_ID=$(jq -r '.measurementId' firebase-config.json)

# Step 4: Update environment variables
echo "⚙️ Updating environment variables..."
cp .env.local .env.local.backup
cat > temp_firebase_vars.txt << EOF
NEXT_PUBLIC_FIREBASE_API_KEY=$API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID_FROM_CONFIG
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=$APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$MEASUREMENT_ID
EOF
grep -v "NEXT_PUBLIC_FIREBASE_" .env.local > .env.local.temp
cat temp_firebase_vars.txt >> .env.local.temp
mv .env.local.temp .env.local

# Step 5: Enable authentication
echo "🔐 Enabling authentication providers..."
ACCESS_TOKEN=$(gcloud auth print-access-token)
curl -s -X PATCH "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"signIn":{"allowDuplicateEmails":false,"email":{"enabled":true,"passwordRequired":true}}}' > /dev/null

curl -s -X POST "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs?idpId=google.com" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"clientId":"","clientSecret":""}' > /dev/null

# Step 6: Set up project tracking
echo "📊 Setting up project tracking..."
if [ "$SKIP_PROJECT_CREATION" = "false" ]; then
  echo "false" | gcloud secrets create project-in-use --data-file=- --project=$PROJECT_ID
  # Add to central tracking as available initially
  curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"fields\":{\"$PROJECT_ID\":{\"mapValue\":{\"fields\":{\"status\":{\"stringValue\":\"available\"},\"createdAt\":{\"timestampValue\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},\"projectName\":{\"stringValue\":\"$PROJECT_NAME\"}}}}}}" > /dev/null
fi

# Step 7: Get OAuth client info
OAUTH_CONFIG=$(curl -s -X GET "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs/google.com" -H "Authorization: Bearer $ACCESS_TOKEN")
OAUTH_CLIENT_ID=$(echo $OAUTH_CONFIG | jq -r '.clientId')

# Step 8: Deploy
echo "🚀 Deploying to Vercel..."
npm run build:prod
VERCEL_URL=$(vercel --prod | grep -o 'https://[^[:space:]]*')

# Step 9: Mark project as in use
echo "📌 Marking project as in use..."
echo "true" | gcloud secrets versions add project-in-use --data-file=- --project=$PROJECT_ID
curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fields\":{\"$PROJECT_ID\":{\"mapValue\":{\"fields\":{\"status\":{\"stringValue\":\"in-use\"},\"deployedAt\":{\"timestampValue\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},\"vercelUrl\":{\"stringValue\":\"$VERCEL_URL\"},\"projectName\":{\"stringValue\":\"$PROJECT_NAME\"}}}}}}" > /dev/null

# Clean up
rm temp_firebase_vars.txt firebase-config.json

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "==========================================="
echo "Project: $PROJECT_ID"
echo "Deployed to: $VERCEL_URL"
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "Go to: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "Find OAuth Client ID: $OAUTH_CLIENT_ID"
echo "Add these Authorized JavaScript origins:"
echo "  - https://$PROJECT_ID.firebaseapp.com"
echo "  - http://localhost"
echo "  - http://localhost:5000"
echo "Add these Authorized redirect URIs:"
echo "  - https://$PROJECT_ID.firebaseapp.com/__/auth/handler"
echo ""
echo "After OAuth setup, test at: $VERCEL_URL"
echo "==========================================="
```

### Usage

```bash
# Make executable and run
chmod +x deploy-chatbot.sh
./deploy-chatbot.sh
```

## Project Discovery and Management

### Find Available Project

Before creating a new project, check for available ones:

```bash
#!/bin/bash

# Function to find an available project
find_available_project() {
  echo "🔍 Finding available project..."

  # Get available projects from central tracking
  ACCESS_TOKEN=$(gcloud auth print-access-token)
  AVAILABLE_PROJECTS=$(curl -s -X GET "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  # Parse projects with status 'available'
  echo "$AVAILABLE_PROJECTS" | jq -r '.fields | to_entries[] | select(.value.mapValue.fields.status.stringValue == "available") | .key' | while read PROJECT_ID; do
    if [ ! -z "$PROJECT_ID" ]; then
      echo "📋 Checking project: $PROJECT_ID"

      # Double-check with project secret
      gcloud config set project $PROJECT_ID 2>/dev/null
      SECRET_VALUE=$(gcloud secrets versions access latest --secret="project-in-use" --project=$PROJECT_ID 2>/dev/null)

      if [ "$SECRET_VALUE" = "false" ]; then
        echo "✅ Available project found: $PROJECT_ID"
        echo "$PROJECT_ID"
        return 0
      else
        echo "⚠️  Project $PROJECT_ID marked as in-use in secret, updating tracking..."
        # Update central tracking to reflect actual status
        curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
          -H "Authorization: Bearer $ACCESS_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"fields\":{\"$PROJECT_ID\":{\"mapValue\":{\"fields\":{\"status\":{\"stringValue\":\"in-use\"},\"lastChecked\":{\"timestampValue\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}}}}}}" > /dev/null
      fi
    fi
  done

  echo "❌ No available projects found"
  return 1
}

# Usage
AVAILABLE_PROJECT=$(find_available_project)
if [ ! -z "$AVAILABLE_PROJECT" ]; then
  echo "Using available project: $AVAILABLE_PROJECT"
  PROJECT_ID="$AVAILABLE_PROJECT"
else
  echo "Creating new project..."
  PROJECT_ID="chatfactory-pool-$(date +%s | tail -c 4)"
fi
```

### Release Project (Chatbot Deletion)

When deleting a chatbot, mark the project as available:

```bash
#!/bin/bash

# Function to release a project
release_project() {
  local PROJECT_ID=$1

  if [ -z "$PROJECT_ID" ]; then
    echo "Usage: release_project <project-id>"
    return 1
  fi

  echo "🔄 Releasing project: $PROJECT_ID"

  # Mark secret as available (false)
  echo "false" | gcloud secrets versions add project-in-use --data-file=- --project=$PROJECT_ID

  # Update central tracking
  ACCESS_TOKEN=$(gcloud auth print-access-token)
  curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"fields\": {
        \"$PROJECT_ID\": {
          \"mapValue\": {
            \"fields\": {
              \"status\": {\"stringValue\": \"available\"},
              \"releasedAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
              \"lastChecked\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}
            }
          }
        }
      }
    }" > /dev/null

  echo "✅ Project $PROJECT_ID marked as available"
}

# Usage
# release_project "chatfactory-pool-002"
```

### Complete Project Cleanup

For thorough cleanup (optional):

```bash
#!/bin/bash

# Function to completely clean a project for reuse
cleanup_project() {
  local PROJECT_ID=$1

  if [ -z "$PROJECT_ID" ]; then
    echo "Usage: cleanup_project <project-id>"
    return 1
  fi

  echo "🧹 Cleaning up project: $PROJECT_ID"
  gcloud config set project $PROJECT_ID

  # Delete Firestore data (optional)
  # gcloud firestore databases delete --database="(default)" --project=$PROJECT_ID --quiet

  # Clear Firebase Auth users
  # Note: This requires Firebase Admin SDK or manual cleanup

  # Reset project to available state
  echo "false" | gcloud secrets versions add project-in-use --data-file=- --project=$PROJECT_ID

  echo "✅ Project $PROJECT_ID cleaned and ready for reuse"
}
```

## Project Tracking Schema

The central tracking collection in `docsai-chatbot-app` uses this schema:

```json
{
  "project-tracking/available-projects": {
    "chatfactory-pool-001": {
      "status": "in-use",
      "projectName": "ChatFactory Pool 001",
      "createdAt": "2025-01-21T10:00:00.000Z",
      "deployedAt": "2025-01-21T10:30:00.000Z",
      "vercelUrl": "https://testbot1-pi.vercel.app",
      "lastChecked": "2025-01-21T10:30:00.000Z"
    },
    "chatfactory-pool-002": {
      "status": "available",
      "projectName": "ChatFactory Pool 002",
      "createdAt": "2025-01-21T11:00:00.000Z",
      "releasedAt": "2025-01-21T12:00:00.000Z",
      "lastChecked": "2025-01-21T12:00:00.000Z"
    }
  }
}
```

## Status Values

- `available`: Project is free and can be used for new chatbot
- `in-use`: Project is currently hosting a chatbot
- `maintenance`: Project is temporarily unavailable
- `deprecated`: Project should not be used for new deployments

---

*This guide provides complete automation for Firebase chatbot deployment with intelligent project management and tracking.*