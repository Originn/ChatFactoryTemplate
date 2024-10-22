import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ImagePreview {
  url: string;
  fileName: string;
}

interface UploadProgress {
  [key: string]: number;
}

const usePasteImageUpload = (
  roomId: string | null,
  auth: any,
  textAreaRef: React.RefObject<HTMLTextAreaElement>,
  setHomeImagePreviews: React.Dispatch<React.SetStateAction<ImagePreview[]>>,
  currentStage: number | null // Pass the current stage here
) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [pastedImagePreviews, setPastedImagePreviews] = useState<ImagePreview[]>([]);

  const uploadImage = (blob: Blob, fileName: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) {
        reject(new Error('User not authenticated'));
        return;
      }
  
      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("header", sessionStorage.getItem('header') || 'default-header');
  
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.setRequestHeader('Authorization', userEmail);
  
      // Determine upload type based on the current stage
      const isPublicUpload = currentStage === 4;
      xhr.setRequestHeader('x-upload-type', isPublicUpload ? 'public' : 'private');
  
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(prev => ({
            ...prev,
            [fileName]: percentComplete
          }));
        }
      };
  
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload failed'));
        }
      };
  
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  };

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (event.target !== textAreaRef.current) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.indexOf("image") !== -1) {
          event.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const timestamp = Date.now();
          const fileName = `${uuidv4()}-${timestamp}.jpg`;
          
          try {
            const data = await uploadImage(blob, fileName);
            if (data.imageUrls) {
              data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
                const newPreview = { url, fileName };
                setHomeImagePreviews(prev => [...prev, newPreview]);
                setPastedImagePreviews(prev => [...prev, newPreview]);
                setUploadProgress(prev => ({
                  ...prev,
                  [fileName]: 100
                }));
              });
            }
          } catch (error) {
            console.error('Error processing pasted image:', error);
          } finally {
            setTimeout(() => {
              setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[fileName];
                return newProgress;
              });
            }, 1000);
          }
        }
      }
    };

    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.addEventListener('paste', handlePaste);
      return () => textArea.removeEventListener('paste', handlePaste);
    }
  }, [setHomeImagePreviews, roomId, auth, textAreaRef, currentStage]); // Add currentStage to dependencies

  const clearPastedImagePreviews = () => {
    setPastedImagePreviews([]);
    setHomeImagePreviews(prev => 
      prev.filter(preview => !pastedImagePreviews.includes(preview))
    );
  };

  return { uploadProgress, clearPastedImagePreviews };
};

export default usePasteImageUpload;
