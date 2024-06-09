import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ImagePreview {
  url: string;
  fileName: string;
}

const useFileUpload = (
  setQuery: (query: string | ((prevQuery: string) => string)) => void, 
  roomId: string | null, 
  auth: any
) => {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`; // Generate a unique filename with timestamp
        const formData = new FormData();
        formData.append("file", file, fileNameWithTimestamp);

        const header = sessionStorage.getItem('header') || 'default-header';
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
              imageUrl: data.imageUrl, // Ensure this key matches what the server expects
              roomId, // Make sure roomId is always sent
              userEmail: auth.currentUser?.email || 'default-email',
            }),
          });
        }
      }
    }
  };

  const handleDeleteImage = async (fileName: string, index: number) => {
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName }),
      });

      if (response.ok) {
        setImagePreviews((prevPreviews: ImagePreview[]) => {
          const newPreviews = prevPreviews.filter((_, i) => i !== index);
          const urlToDelete = prevPreviews[index].url;
          setQuery((prevQuery: string) => {
            const lines = prevQuery.split('\n');
            return lines.filter(line => line !== urlToDelete).join('\n');
          });
          return newPreviews;
        });
      } else {
        console.error('Failed to delete image from GCP');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  return {
    imagePreviews,
    handleFileChange,
    handleDeleteImage,
    setImagePreviews,
  };
};

export default useFileUpload;
