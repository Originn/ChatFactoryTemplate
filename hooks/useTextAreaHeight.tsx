import { useEffect, RefObject } from 'react';

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
    adjustTextAreaHeight();
  }, []);

  const adjustTextAreaHeight = () => {
    if (textAreaRef.current) {
      const element = textAreaRef.current;
      element.style.height = 'auto';

      const maxHeight = 240; // match css max-height
      const newHeight = Math.min(element.scrollHeight, maxHeight);

      element.style.height = `${newHeight}px`;
      setTextAreaHeight(`${newHeight}px`);
    }
  };

  return { adjustTextAreaHeight };
};

export default useTextAreaHeight;