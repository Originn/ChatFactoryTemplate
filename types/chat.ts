import { Document } from 'langchain/document';
import { ImagePreviewData } from '@/components/core/Media';

export type Message = {
  type: 'apiMessage' | 'userMessage';
  message: string;
  isStreaming?: boolean;
  sourceDocs?: Document[];
  qaId?: string;
  isComplete: boolean;
  images?: ImagePreviewData[];
  imageUrls?: string[];  // Add imageUrls here
};