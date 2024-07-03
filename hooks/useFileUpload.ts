import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ImagePreview {
  url: string;
  fileName: string;
}

const useFileUpload = (
  setQuery: (query: string | ((prevQuery: string) => string)) => void, 
  roomId: string | null, 
  auth: any,
  setUploadStatus: (status: string | null) => void // Add setUploadStatus as a parameter
) => {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadStatus('Uploading and processing...');
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`;
        const formData = new FormData();
        formData.append("file", file, fileNameWithTimestamp);

        const header = sessionStorage.getItem('header') || 'default-header';
        formData.append("header", header);

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          if (data.imageUrls) {
            data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
              const cacheBustedUrl = `${url}?${uuidv4()}`; // Add a unique query parameter to the URL
              setImagePreviews((prevPreviews: ImagePreview[]) => [...prevPreviews, { url: cacheBustedUrl, fileName }]);
              setQuery((prevQuery: string) => `${prevQuery}\n${cacheBustedUrl}`);
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
        } catch (error) {
          console.error('Error uploading file:', error);
          setUploadStatus('Upload and processing failed.'); // Set upload status to "Upload and processing failed."
          setTimeout(() => {
            setUploadStatus(null); // Clear the status after a short delay
          }, 3000);
          return; // Exit the loop if an error occurs
        }
      }
      setUploadStatus('Upload and processing complete.'); // Set upload status to "Upload and processing complete."
      setTimeout(() => {
        setUploadStatus(null); // Clear the status after a short delay
      }, 3000);
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
