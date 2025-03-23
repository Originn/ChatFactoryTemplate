# SolidCAM ChatBot

A web-based chatbot application built specifically for SolidCAM users that provides intelligent assistance through natural language processing. The application allows users to ask questions about SolidCAM, upload images for analysis, and receive answers based on a knowledge base of SolidCAM documentation and resources.

## Overview

SolidCAM ChatBot is a specialized AI assistant designed to help SolidCAM users with technical questions, troubleshooting, and guidance. It leverages advanced language models and an extensive knowledge base to provide accurate and relevant information about SolidCAM software. The application supports multilingual conversations, image analysis, and maintains conversation context to provide increasingly relevant responses.

## 🌟 Features

- **Natural Language Processing**: Interact with the chatbot using natural language queries
- **Image Analysis**: Upload images of CAM parts for detailed analysis and assistance
- **Multilingual Support**: Automatic language detection and translations
- **Chat History**: Save and retrieve previous conversations
- **User Authentication**: Secure login with multiple authentication methods
- **Feedback System**: Allows users to provide feedback on answers
- **Dark/Light Mode**: Toggle between themes for better user experience
- **Voice Input**: Microphone support for voice-to-text input
- **Responsive Design**: Works on desktop and mobile devices
- **Embedding Support**: Can be embedded into SolidCAM web applications

## 🏗️ Project Structure

### Core Components

- **Frontend**: Built with Next.js and React
- **Backend**: Node.js, Express, and Socket.IO
- **Database**: PostgreSQL for storing conversations and feedback
- **AI Processing**: Integration with OpenAI and other AI providers
- **Authentication**: Firebase Authentication
- **Vector Database**: Pinecone for efficient document retrieval

### Directory Layout

```
solidcamChatBot/
├── auth/                     # Authentication-related components
├── components/               # React components
│   ├── ui/                   # Reusable UI components
│   └── [various components]  # Application-specific components
├── config/                   # Configuration files
├── declarations/             # TypeScript declarations
├── hooks/                    # React hooks for state management
├── interfaces/               # TypeScript interfaces
├── pages/                    # Next.js pages
│   ├── api/                  # API endpoints
│   └── [various pages]       # Application pages
├── public/                   # Static assets
├── scripts/                  # Utility scripts
├── styles/                   # CSS and styling files
├── types/                    # TypeScript type definitions
├── utils/                    # Utility functions
│   ├── makechain.ts          # Logic for creating LLM chains
│   ├── memoryService.ts      # Chat memory handling
│   └── [other utilities]     # Various helper functions
├── db.js                     # Database connection and queries
├── server.cjs                # Express server setup
└── socketServer.cjs          # Socket.IO server implementation
```

## 🛠️ Key Components

### 1. Frontend Components

- **Home.tsx**: Main chat interface where users interact with the bot
- **ChatHistory.tsx**: Displays and manages saved conversations
- **FeedbackComponent.tsx**: Allows users to rate and comment on responses
- **ImageUploadFromHome.tsx**: Handles image uploads from the chat interface
- **MicrophoneRecorder.tsx**: Captures voice input
- **EnlargedImageView.tsx**: Displays uploaded images in fullscreen view
- **InitialDisclaimerModal.tsx**: Shows initial terms and conditions to users
- **UserMenu.tsx**: User profile and settings management component

### 2. Backend Services

- **makechain.ts**: Core logic for handling user queries and generating responses
- **memoryService.ts**: Manages conversation context and history
- **contextManager.ts**: Manages the context window for AI processing with optimized retrieval
- **streamManager.ts**: Handles streaming of responses to the client
- **pinecone-client.ts**: Interface with Pinecone vector database
- **modelProviders.ts**: Manages different AI model providers (OpenAI, DeepSeek)
- **roomSessionsDb.ts**: Manages chat room sessions and persistence
- **speechRecognition.ts**: Handles voice-to-text conversion
- **BufferMemory.ts**: Custom implementation of memory buffer for conversation context

### 3. API Endpoints

- **/api/chat.ts**: Main endpoint for chat functionality
- **/api/chat-history.ts**: Retrieves conversation history
- **/api/latest-chat-history.ts**: Gets the most recent chat for a user
- **/api/upload.ts**: Handles file uploads
- **/api/delete.ts**: Removes uploaded files
- **/api/submit-feedback.ts**: Records user feedback
- **/api/userEmbed.ts**: Special endpoint for embedding mode
- **/api/privacy-settings.ts**: Retrieves user privacy preferences
- **/api/update-privacy-settings.ts**: Updates user privacy settings
- **/api/delete-account.ts**: Handles account deletion requests
- **/api/delete-chat-history.ts**: Removes user conversation history
- **/api/export-user-data.ts**: Exports user data for GDPR compliance
- **/api/refresh-image-url.ts**: Updates expired image URLs
- **/api/user-data-stats.ts**: Retrieves usage statistics

### 4. Database Structure

The application uses PostgreSQL with the following key tables:

- **QuestionsAndAnswers**: Stores user queries and bot responses
- **user_chat_history**: Stores complete conversation history by room
- **user_privacy_settings**: Stores user privacy preferences

## 🔌 Integrations

- **AI Model Providers**:
  - **OpenAI**: Primary language model provider (gpt-4o)
  - **DeepSeek**: Alternative language model provider (deepseek-chat)
  - **Text Embeddings**: Uses OpenAI text-embedding-3-small for semantic search

- **Backend Services**:
  - **Firebase**: Authentication, storage, and user management
  - **Pinecone**: Vector database for retrieval augmented generation
  - **PostgreSQL**: Database for conversation and feedback storage
  - **Socket.IO**: Real-time communication between client and server

- **Frontend Frameworks**:
  - **Next.js**: React framework for server-side rendering
  - **Tailwind CSS**: Utility-first CSS framework
  - **LangChain**: Framework for building LLM applications
  - **React Markdown**: For rendering markdown responses

## 📋 Features in Detail

### Chat System

The chat system enables real-time communication between users and the AI assistant:

- **Streaming Responses**: Answers appear gradually as they're generated
- **Source Documents**: References to SolidCAM documentation and webinars that contributed to the answer
- **Feedback Collection**: Users can rate the quality of responses with thumbs up/down and comments
- **Context Awareness**: The system maintains conversation context and optimizes which parts of previous conversations to include
- **Room-Based Sessions**: Conversations are organized into "rooms" with unique IDs for persistence
- **Real-Time Updates**: Uses Socket.IO for real-time message streaming and state synchronization

### Image Processing

The system can analyze uploaded images to provide context-aware responses:

- **Multiple Upload Methods**: Supports drag-and-drop, file selection, and paste functionality
- **Progress Tracking**: Shows upload progress for each image
- **Image Preview**: Displays thumbnails with options to enlarge or delete
- **Persistent Context**: Remembers uploaded images across conversation turns
- **CAM Analysis**: Analyzes image content for CAM-specific elements and geometry
- **Follow-up Intelligence**: Automatically references previous images when relevant to new questions

### Authentication and User Management

User authentication is managed through Firebase with support for:

- **Multiple Auth Methods**: Email/password, Google, Apple, and Microsoft authentication
- **Custom Login Flow**: Managed through AuthWrapper and CustomLoginForm components
- **Email Verification**: Required email verification process
- **Password Reset**: Self-service password reset functionality
- **Account Management**: User can manage their profile and settings
- **Anonymous Mode**: Limited functionality for users who aren't logged in
- **Session Persistence**: Maintains user sessions across visits
- **Role-Based Access**: Different capabilities based on user authentication status

### Privacy and GDPR Compliance

The application includes comprehensive privacy features:

- **Privacy Settings**: User-configurable privacy preferences
- **Data Controls**: Optional analytics tracking and history storage
- **Retention Periods**: Configurable history retention periods
- **Data Export**: Users can export their conversation data
- **Account Deletion**: Option to delete account and all associated data
- **Consent Management**: Initial disclaimer and consent tracking
- **Automated Anonymization**: Scripts for periodic data anonymization
- **GDPR Tables**: Database structure designed for GDPR compliance
- **Data Minimization**: Only stores necessary user information

### Embedding Mode

The application can be embedded in SolidCAM's web application:

- **Cross-Window Communication**: Communicates with the parent window via postMessage API
- **State Synchronization**: Shares room IDs between embedded and standalone versions
- **Responsive Design**: Customized UI when running in embedded mode
- **Identifier Management**: Maintains consistent user identity between embedded and standalone modes
- **Simplified Interface**: Hides certain elements when embedded for better integration
- **Simplified Authentication**: Uses browserID for authentication in embedded mode
- **Parent Notifications**: Notifies parent window about important state changes

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- PostgreSQL database
- OpenAI API key
- DeepSeek API key (optional)
- Pinecone API key and index
- Firebase project with Authentication enabled
- Environment variables configured (see below)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the necessary environment variables
4. Set up the PostgreSQL database with the required tables:
   ```
   # You can use the script in scripts/gdpr_tables_migration.sql
   ```

### Development

Run the development server:
```
npm run dev
```

### Production

Build and start the production server:
```
npm run build
npm start
```

## 🔧 Environment Variables

The application requires several environment variables:

### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string

### AI Model Configuration
- `OPENAI_API_KEY`: API key for OpenAI
- `DEEPSEEK_API_KEY`: API key for DeepSeek (optional)
- `MODEL_NAME`: Name of the OpenAI model to use (default: gpt-4o)
- `TEMPERATURE`: Temperature setting for language model (default: 0)
- `IMAGE_MODEL_NAME`: Model for image analysis (default: gpt-4o-mini)

### Vector Database
- `PINECONE_API_KEY`: API key for Pinecone
- `PINECONE_ENVIRONMENT`: Pinecone environment
- `PINECONE_INDEX`: Pinecone index name
- `K_EMBEDDINGS`: Number of embeddings to retrieve (default: 8)
- `FETCH_K_EMBEDDINGS`: Number of embeddings to fetch before filtering (default: 12)
- `LAMBDA_EMBEDDINGS`: Weight factor for MMR search (default: 0.1)
- `MINSCORESOURCESTHRESHOLD`: Minimum score for relevant sources (default: 0.78)

### Firebase Configuration
- `FIREBASE_API_KEY`: Firebase API key
- `FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `FIREBASE_APP_ID`: Firebase app ID
- `FIREBASE_CLIENT_EMAIL`: Firebase client email (for admin)
- `FIREBASE_PRIVATE_KEY`: Firebase private key (for admin)

### Server Configuration
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Node environment (development/production)
- `NEXT_PUBLIC_SERVER_URL`: Public URL for the server
- `NEXT_PUBLIC_CODE_PREFIX`: Prefix for code embedding mode

## 📚 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🧰 Maintenance

The application includes several maintenance scripts:

- **deleteOldChatHistory.js**: Removes chat histories older than the retention period
- **monthly-anonymization.js**: Performs GDPR-compliant anonymization of user data
- **release-tasks.js**: Tasks to run during application deployment
- **QuestionEmbedder.ts**: Tool for embedding questions into the knowledge base

## 🔗 Related Resources

- [SolidCAM Official Website](https://www.solidcam.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)

## 📄 License

Proprietary - © 2024 SolidCAM™. All rights reserved.