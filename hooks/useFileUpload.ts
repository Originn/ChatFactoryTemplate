// hooks/useFileUpload.ts

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ImagePreview {
  url: string;
  fileName: string;
}

interface UploadProgress {
  [key: string]: number;
}

const useFileUpload = (
  setQuery: (query: string | ((prevQuery: string) => string)) => void,
  roomId: string | null,
  auth: any,
  setUploadStatus: (status: string | null) => void
) => {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      alert('Please sign in to upload images');
      return;
    }

    setUploadStatus('Uploading and processing...');
    
    for (const file of Array.from(files)) {
      const timestamp = Date.now();
      const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`;
      const formData = new FormData();
      formData.append("file", file, fileNameWithTimestamp);
      formData.append("header", sessionStorage.getItem('header') || 'default-header');

      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('Authorization', userEmail);
        // Add this line to explicitly indicate it's a public upload
        xhr.setRequestHeader('x-upload-type', 'public');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setUploadProgress(prev => ({
              ...prev,
              [fileNameWithTimestamp]: percentComplete
            }));
          }
        };

        xhr.onload = async () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            if (data.imageUrls) {
              data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
                setImagePreviews(prevPreviews => [...prevPreviews, { url, fileName }]);
                setQuery(prevQuery => `${prevQuery}\n${url}`);
              });
            }
            setUploadProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[fileNameWithTimestamp];
              return newProgress;
            });
          } else {
            throw new Error('Upload failed');
          }
        };

        xhr.onerror = () => {
          throw new Error('Upload failed');
        };

        xhr.send(formData);
      } catch (error) {
        console.error('Error uploading file:', error);
        setUploadStatus('Upload and processing failed.');
        setTimeout(() => setUploadStatus(null), 3000);
        return;
      }
    }
    setUploadStatus('Upload and processing complete.');
    setTimeout(() => setUploadStatus(null), 3000);
  };

  const handleDeleteImage = async (fileName: string, index: number) => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': userEmail
        },
        body: JSON.stringify({ fileName }),
      });
      
      if (!response.ok) throw new Error('Failed to delete image');
      
      setImagePreviews(prevPreviews => {
        const newPreviews = prevPreviews.filter((_, i) => i !== index);
        const urlToDelete = prevPreviews[index].url;
        setQuery(prevQuery => {
          const lines = prevQuery.split('\n');
          return lines.filter(line => !line.includes(urlToDelete)).join('\n');
        });
        return newPreviews;
      });
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  return {
    imagePreviews,
    handleFileChange,
    handleDeleteImage,
    setImagePreviews,
    uploadProgress,
  };
};
export default useFileUpload;
