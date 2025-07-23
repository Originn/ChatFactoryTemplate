
// hooks/useFileUploadFromHome.ts

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
  setUploadStatus: (status: string | null) => void,
  enableEmbeddings: boolean = false  // 🎯 NEW: Optional embedding generation
) => {
  const [homeImagePreviews, setHomeImagePreviews] = useState<ImagePreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [fileErrors, setFileErrors] = useState<{ [key: string]: string }>({});
  const [embeddingStatus, setEmbeddingStatus] = useState<{ [key: string]: string }>({}); // 🎯 NEW: Track embedding status
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🎯 NEW: Generate embeddings for uploaded images
  const generateImageEmbeddings = async (imageUrls: Array<{url: string, fileName: string}>, userEmail: string) => {
    if (!enableEmbeddings || !imageUrls || imageUrls.length === 0) return;

    try {
      console.log(`🎯 Generating embeddings for ${imageUrls.length} uploaded image(s)...`);
      
      // Set embedding status
      imageUrls.forEach(({ fileName }) => {
        setEmbeddingStatus(prev => ({
          ...prev,
          [fileName]: 'generating'
        }));
      });

      console.log(`✅ ${imageUrls.length} image(s) uploaded successfully to Firebase Storage`);
      
      // Update embedding status to indicate ready for on-demand processing
      imageUrls.forEach(({ fileName }) => {
        setEmbeddingStatus(prev => ({
          ...prev,
          [fileName]: 'ready' // Changed from 'success' to 'ready'
        }));
      });

      // Note: Embeddings will be created on-demand during conversations
      console.log('💡 Embeddings will be created when images are first used in conversation');

    } catch (error: any) {
      console.error('Error generating embeddings:', error);
      
      // Update embedding status to error
      imageUrls.forEach(({ fileName }) => {
        setEmbeddingStatus(prev => ({
          ...prev,
          [fileName]: 'error'
        }));
      });

      // Optional: Show error message to user
      // You could add a toast notification here
    }
  };

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
                
                // 🎯 NEW: Generate embeddings if enabled
                if (enableEmbeddings) {
                  generateImageEmbeddings(data.imageUrls, userEmail);
                }
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

  const handleHomeDeleteImage = async (fileName: string, isPrivate: boolean) => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;
  
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': userEmail
        },
        body: JSON.stringify({ fileName, isPrivate }),
      });
      
      if (!response.ok) throw new Error('Failed to delete image');
      
      // Filter by fileName instead of index
      setHomeImagePreviews(prevPreviews => prevPreviews.filter(preview => preview.fileName !== fileName));
  
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
    embeddingStatus,  // 🎯 NEW: Return embedding status
  };
};

export default useFileUploadFromHome;