export interface FeedbackComponentProps {
    messageIndex: number;
    handleOpenModal: (type: string, index: number) => void;
  }
  
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageIndex: number | null;
  onSubmit: (messageIndex: number | null, remark: string) => void;
  feedbackType: string; // This could be more specific, like 'up' | 'down' | 'comment' if you have a fixed set of feedback types
}