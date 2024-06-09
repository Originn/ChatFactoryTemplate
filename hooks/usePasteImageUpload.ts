import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ImagePreview {
  url: string;
  fileName: string;
}

const usePasteImageUpload = (
  currentStage: number | null,
  setImagePreviews: React.Dispatch<React.SetStateAction<ImagePreview[]>>,
  setQuery: React.Dispatch<React.SetStateAction<string>>,
  roomId: string | null,
  auth: any
) => {
  useEffect(() => {
    if (currentStage !== 4) {
      return;
    }

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf("image") !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              const timestamp = Date.now();
              const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`; // Generate a unique filename with timestamp
              const formData = new FormData();
              formData.append("file", blob, fileNameWithTimestamp);

              const header = sessionStorage.getItem('header') || `image-${uuidv4()}`;
              formData.append("header", header);

              const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });

              const data = await response.json();
              if (data.imageUrls) {
                data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
                  setImagePreviews((prevPreviews: ImagePreview[]) => [...prevPreviews, { url, fileName }]);
                  setQuery((prevQuery: string) => `${prevQuery}\n${url}`);
                });

                await fetch('/api/chat', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    imageUrl: data.imageUrl,
                    roomId,
                    userEmail: auth.currentUser?.email || 'default-email',
                  }),
                });
              }
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [currentStage, setImagePreviews, setQuery, roomId, auth]);
};

export default usePasteImageUpload;
