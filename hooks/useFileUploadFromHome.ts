import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ImagePreview {
  url: string;
  fileName: string;
}

const useFileUploadFromHome = (
  setQuery: (query: string | ((prevQuery: string) => string)) => void, 
  roomId: string | null, 
  auth: any,
  setUploadStatus: (status: string | null) => void
) => {
  const [homeImagePreviews, setHomeImagePreviews] = useState<ImagePreview[]>([]);

  const handleHomeFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadStatus('Uploading and processing...');
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`;
        const formData = new FormData();
        formData.append("file", file, fileNameWithTimestamp);

        // Get the current date and time
        const now = new Date();
        const dateTimeString = now.toISOString(); // You can format this string as you like

        formData.append("header", dateTimeString);

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          if (data.imageUrls) {
            data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
              const cacheBustedUrl = `${url}?${uuidv4()}`;
              setHomeImagePreviews((prevPreviews: ImagePreview[]) => [...prevPreviews, { url: cacheBustedUrl, fileName }]);
              // No update to setQuery here
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
        } catch (error) {
          console.error('Error uploading file:', error);
          setUploadStatus('Upload and processing failed.');
          setTimeout(() => {
            setUploadStatus(null);
          }, 3000);
          return;
        }
      }
      setUploadStatus('Upload and processing complete.');
      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
    }
  };

  const handleHomeDeleteImage = async (fileName: string, index: number) => {
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName }),
      });

      if (response.ok) {
        setHomeImagePreviews((prevPreviews: ImagePreview[]) => {
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
    homeImagePreviews,
    handleHomeFileChange,
    handleHomeDeleteImage,
    setHomeImagePreviews,
  };
};

export default useFileUploadFromHome;
