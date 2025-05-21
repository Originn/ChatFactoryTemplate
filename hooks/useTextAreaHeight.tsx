import { useEffect, RefObject } from 'react';
import styles from '@/styles/Home.module.css';

interface UseTextAreaHeightParams {
  textAreaRef: RefObject<HTMLTextAreaElement>;
  content: string;
  setTextAreaHeight: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Custom hook to handle dynamic text area height adjustment
 */
const useTextAreaHeight = ({ textAreaRef, content, setTextAreaHeight }: UseTextAreaHeightParams) => {
  useEffect(() => {
    adjustTextAreaHeight();
  }, [content]);

  useEffect(() => {
    // Ensure height is adjusted when the component mounts
    adjustTextAreaHeight();
  }, []);

  const adjustTextAreaHeight = () => {
    if (textAreaRef.current) {
      // Start with auto height to properly calculate scrollHeight
      textAreaRef.current.style.height = 'auto';
      
      // Get base height and calculate new height based on content
      const baseHeight = 24;
      const minHeight = 58; // Minimum textarea height
      const newHeight = Math.min(textAreaRef.current.scrollHeight, 10 * baseHeight);
      
      // Apply the new height to the textarea
      textAreaRef.current.style.height = `${newHeight}px`;
  
      // Calculate the offset to adjust textarea position
      const offset = newHeight - baseHeight;
      textAreaRef.current.style.transform = `translateY(-${offset}px)`;
      
      // Update state with new height
      setTextAreaHeight(`${newHeight}px`);
  
      // Calculate the growth from minimum height
      const growth = Math.max(0, newHeight - minHeight);
  
      // Get the chat container element
      const chatContainer = document.querySelector(`.${styles.cloud}`);
      if (chatContainer && growth > 0) {
        // For screens <= 600px height, base cloud height is 55vh
        // For larger screens, base cloud height is 68vh
        const baseCloudHeight = window.innerHeight <= 600 ? 55 : 68;
        
        // Set height directly with vh units minus growth in px
        chatContainer.setAttribute('style', `height: calc(${baseCloudHeight}vh - ${growth}px) !important`);
      } else if (chatContainer) {
        // Reset to default height if no growth
        const defaultHeight = window.innerHeight <= 600 ? '55vh' : '68vh';
        chatContainer.setAttribute('style', `height: ${defaultHeight} !important`);
      }
    }
  };

  return { adjustTextAreaHeight };
};

export default useTextAreaHeight;