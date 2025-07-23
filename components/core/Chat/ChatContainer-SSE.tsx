// components/core/Chat/ChatContainer.tsx
import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Box, Container, Typography } from '@mui/material';
import { User } from 'firebase/auth';
import useChatSSE from '@/hooks/useChatSSE'; // Changed from useChat
import useTextAreaHeight from '@/hooks/useTextAreaHeight';
import useTheme from '@/hooks/useTheme';
import useFileUpload from '@/hooks/useFileUpload';
import usePasteImageUpload from '@/hooks/usePasteImageUpload';
import useFileUploadFromHome from '@/hooks/useFileUploadFromHome';
import { getTemplateConfig } from '../../../config/template';
import { auth } from '@/utils/firebase';
import { handleSubmitClick } from '@/utils/tracking';
import MemoryService from '@/utils/memoryService';
import Cookies from 'js-cookie';

// Import components with the new structure
import { MessageList, ChatInput } from '@/components/core/Chat';
import { ChatMessage } from '@/components/core/Chat/types';
import { 
  MicrophoneRecorder, 
  ImageUpload, 
  ImagePreview, 
  EnlargedImageView 
} from '@/components/core/Media';
import Layout from '@/components/core/Layout';
import { 
  LoadingDots 
} from '@/components/ui/Loaders';
import { 
  InitialDisclaimerModal 
} from '@/components/ui/Modals';
import { 
  Tooltip
} from '@/components/ui/Feedback';
import { 
  GoogleAnalytics 
} from '@/components/analytics';

// Props interface for ChatContainer
interface ChatContainerProps {
  user: User | null;
  userProfile: any | null;
  isAnonymous: boolean;
}

// Environment constants
const PRODUCTION_ENV = 'production';

// Image paths with environment awareness