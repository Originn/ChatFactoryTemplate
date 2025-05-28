# {{PRODUCT_NAME}} ChatBot

A web-based chatbot application built specifically for {{PRODUCT_NAME}} users that provides intelligent assistance through natural language processing. The application allows users to ask questions about {{PRODUCT_NAME}}, upload images for analysis, and receive answers based on a knowledge base of {{PRODUCT_NAME}} documentation and resources.

## Overview

{{PRODUCT_NAME}} ChatBot is a specialized AI assistant designed to help {{PRODUCT_NAME}} users with technical questions, troubleshooting, and guidance. It leverages advanced language models and an extensive knowledge base to provide accurate and relevant information about {{PRODUCT_NAME}} software. The application supports multilingual conversations, image analysis, and maintains conversation context to provide increasingly relevant responses.

## 🌟 Features

- **Natural Language Processing**: Interact with the chatbot using natural language queries
- **Image Analysis**: Upload images for detailed analysis and assistance
- **Multilingual Support**: Automatic language detection and translations
- **Chat History**: Save and retrieve previous conversations
- **User Authentication**: Secure login with multiple authentication methods
- **Feedback System**: Allows users to provide feedback on answers
- **Dark/Light Mode**: Toggle between themes for better user experience
- **Voice Input**: Microphone support for voice-to-text input
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Project Structure

### Core Components

- **Frontend**: Built with Next.js and React
- **Backend**: Node.js, Express, and Server-Sent Events (SSE)
- **Database**: PostgreSQL for storing conversations and feedback
- **AI Processing**: Integration with OpenAI and other AI providers
- **Authentication**: Firebase Authentication
- **Vector Database**: Pinecone for efficient document retrieval

### Key Directories

```
├── components/          # React components
│   ├── core/           # Main chatbot components
│   ├── ui/             # UI components and modals
│   └── analytics/      # Analytics and tracking
├── pages/              # Next.js pages and API routes
├── utils/              # Utility functions and configurations
├── config/             # Configuration files
├── auth/               # Authentication components
├── hooks/              # Custom React hooks
├── styles/             # Global styles and theme configurations
└── public/             # Static assets
```
## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- PostgreSQL database
- Firebase project (for authentication)
- Pinecone account (for vector database)
- OpenAI API key (or other AI provider)

### Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd chatbot-template
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy `.env.example` to `.env` and configure the following variables:

   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name

   # AI Provider
   OPENAI_API_KEY=your_openai_api_key
   
   # Pinecone Vector Database
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_ENVIRONMENT=your_pinecone_environment
   PINECONE_INDEX_NAME=your_index_name

   # Firebase Authentication
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   # ... other Firebase config variables

   # Google Cloud Storage
   GCLOUD_STORAGE_BUCKET=your_storage_bucket
   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
   ```

4. **Database Setup**
   Set up your PostgreSQL database and run any necessary migrations.

5. **Run the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## 🔧 Configuration

### Template Customization

This chatbot template can be customized for different products and companies by modifying the template configuration in `config/template.ts`:

```typescript
export const TEMPLATE_CONFIG: TemplateConfig = {
  companyName: "{{COMPANY_NAME}}",
  productName: "{{PRODUCT_NAME}}",
  productLatestVersion: "{{PRODUCT_LATEST_VERSION}}",
  technicalSupportUrl: "{{TECHNICAL_SUPPORT_URL}}",
  // ... other configuration options
};
```

The DocsAI hub will automatically replace these template variables when creating new chatbot instances.

## 📚 Documentation

For detailed information about specific components and features:

- **AI Integration**: See `utils/makechain.ts` for AI model configurations
- **Authentication**: Check `auth/` directory for Firebase setup
- **Database Operations**: Review `db.js` for database interactions
- **Component Documentation**: Each component includes inline documentation

## 🤝 Contributing

This is a template project. Contributions should focus on:
- Improving template flexibility
- Adding new customization options
- Bug fixes and performance improvements
- Documentation enhancements

## 📄 License

This project is proprietary and licensed for use with the DocsAI platform.

## 🆘 Support

For support with this template:
- Contact: {{SUPPORT_EMAIL}}
- Documentation: {{SUPPORT_URL}}

---

**Note**: This is a template project. Replace all template variables (format: `{``{VARIABLE_NAME}``}`) with actual values when deploying through the DocsAI hub.
