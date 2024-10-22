import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ImagePreview {
  url: string;
  fileName: string;
}

interface UploadProgress {
  [key: string]: number | null;  // Changed to allow null
}

const useFileUploadFromHome = (
  setQuery: (query: string) => void, 
  roomId: string | null, 
  auth: any,
  setUploadStatus: (status: string | null) => void
) => {
  const [homeImagePreviews, setHomeImagePreviews] = useState<ImagePreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [fileErrors, setFileErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHomeFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length > 2) {
      alert('Only 2 images are allowed per upload');
      return;
    }

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      alert('Please sign in to upload images');
      return;
    }

    setUploadStatus('Uploading and processing...');
    setFileErrors({});

    for (const file of Array.from(files)) {
      const timestamp = Date.now();
      const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`;
      const formData = new FormData();
      formData.append("file", file, fileNameWithTimestamp);
      formData.append("header", new Date().toISOString());

      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('Authorization', userEmail);
        // Add this header to indicate private upload
        xhr.setRequestHeader('x-upload-type', 'private');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setUploadProgress(prev => ({
              ...prev,
              [fileNameWithTimestamp]: percentComplete
            }));
          }
        };

        await new Promise<void>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              if (data.imageUrls) {
                setHomeImagePreviews(prevPreviews => {
                  const newPreviews = [
                    ...prevPreviews,
                    ...data.imageUrls.map(({ url, fileName }: { url: string, fileName: string }) => ({
                      url: url,
                      fileName: fileName
                    }))
                  ];

                  if (newPreviews.length > 2) {
                    reject(new Error('Exceeded maximum number of images'));
                    return prevPreviews;
                  }

                  return newPreviews;
                });
                data.imageUrls.forEach(({ fileName }: { fileName: string }) => {
                  setUploadProgress(prev => ({
                    ...prev,
                    [fileName]: null
                  }));
                });
              }
              resolve();
            } else {
              reject(new Error(xhr.responseText));
            }
          };

          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(formData);
        });
      } catch (error: any) {
        console.error('Upload error:', error);
        setFileErrors(prev => ({
          ...prev,
          [fileNameWithTimestamp]: error.message
        }));
      }
    }
    setUploadStatus(null);
  };

  const handleHomeDeleteImage = async (fileName: string, index: number, isPrivate: boolean) => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;
  
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': userEmail
        },
        body: JSON.stringify({ fileName, isPrivate }),  // Pass isPrivate to determine the bucket
      });
      
      if (!response.ok) throw new Error('Failed to delete image');
      
      // Filter out the deleted image from the state
      setHomeImagePreviews(prevPreviews => prevPreviews.filter((_, i) => i !== index));
  
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
    fileInputRef,
    uploadProgress,
    fileErrors,
  };
};

export default useFileUploadFromHome;