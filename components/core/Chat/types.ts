export interface ChatMessage {
  type: 'userMessage' | 'apiMessage';
  message: string;
  isComplete: boolean;
  qaId?: string;
  sourceDocs?: any[];
  images?: Array<{ url: string; fileName: string }>;
  imageUrls?: string[];
}

export interface ChatHistoryItem {
  id: string;
  roomId: string;
  conversation_json: any;
  conversation_title?: string;
  date: string;
}

export interface RequestsInProgressType {
  [key: string]: boolean;
}

export interface CustomLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
}
