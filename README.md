# AI ChatBot Template

A customizable web-based chatbot application that provides intelligent assistance through natural language processing. The application allows users to ask questions, upload images for analysis, and receive answers based on your knowledge base and documentation.

## Overview

This ChatBot Template is a specialized AI assistant that can be configured for any product or service. It leverages advanced language models and an extensive knowledge base to provide accurate and relevant information. The application supports multilingual conversations, image analysis, and maintains conversation context to provide increasingly relevant responses.

## 🚀 Quick Setup

### 1. Environment Configuration

Copy the example environment file and customize it for your chatbot:

```bash
cp .env.example .env
```

Then edit `.env` with your specific configuration:

```bash
# Company & Product Configuration
NEXT_PUBLIC_COMPANY_NAME=Your Company Name
NEXT_PUBLIC_PRODUCT_NAME=Your Product Name
NEXT_PUBLIC_COMPANY_DOMAIN=yourcompany.com
NEXT_PUBLIC_SUPPORT_URL=https://yourcompany.com/support
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourcompany.com

# Chatbot Appearance
NEXT_PUBLIC_CHATBOT_NAME=AI Assistant
NEXT_PUBLIC_CHATBOT_DESCRIPTION=AI-powered assistant for your product
NEXT_PUBLIC_CHATBOT_PRIMARY_COLOR=#3b82f6
```

### 2. Database Setup

Set up your Neon PostgreSQL database:
```bash
DATABASE_URL=your_neon_database_url
```

### 3. AI Configuration  

Configure your AI provider:
```bash
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
```

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
- **Backend**: Node.js, Express, and Socket.IO
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

This chatbot template can be customized for different products and companies by setting environment variables in your `.env` file:

```bash
# Company & Product Configuration
NEXT_PUBLIC_COMPANY_NAME=Your Company Name
NEXT_PUBLIC_PRODUCT_NAME=Your Product Name
NEXT_PUBLIC_TECHNICAL_SUPPORT_URL=https://yourcompany.com/support
# ... other configuration options
```

The template configuration system automatically reads these environment variables at runtime, making it easy to customize your chatbot without modifying code.

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

This project is proprietary and licensed for use with the ChatFactory platform.

## 🆘 Support

For support with this template:
- Contact: Set `NEXT_PUBLIC_SUPPORT_EMAIL` in your .env file
- Documentation: Set `NEXT_PUBLIC_SUPPORT_URL` in your .env file  

## 🚀 Production Deployment

1. Configure all environment variables in your `.env` file
2. Set up your Neon PostgreSQL database using the partitioning setup
3. Configure Firebase authentication 
4. Deploy to Vercel or your preferred hosting platform

---

**Ready to deploy your AI chatbot!** All template variables are now environment-driven for easy customization.
