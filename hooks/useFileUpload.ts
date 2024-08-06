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
          // Create a new XMLHttpRequest to track progress
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload', true);

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
                  const cacheBustedUrl = `${url}?${uuidv4()}`;
                  setImagePreviews((prevPreviews: ImagePreview[]) => [...prevPreviews, { url: cacheBustedUrl, fileName }]);
                  setQuery((prevQuery: string) => `${prevQuery}\n${cacheBustedUrl}`);
                });
              }
              // Remove progress after successful upload
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

  const handleDeleteImage = async (fileName: string, index: number) => {
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      
      if (!response.ok) throw new Error('Failed to delete image');
      
      setImagePreviews(prevPreviews => {
        const newPreviews = prevPreviews.filter((_, i) => i !== index);
        const urlToDelete = prevPreviews[index].url;
        
        // Remove the URL from the textarea
        setQuery((prevQuery: string) => {
          const lines = prevQuery.split('\n');
          return lines.filter(line => !line.includes(urlToDelete)).join('\n');
        });
        
        return newPreviews;
      });
    } catch (error) {
      console.error('Error deleting internal image:', error);
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
