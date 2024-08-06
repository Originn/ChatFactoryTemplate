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
  setHomeImagePreviews: React.Dispatch<React.SetStateAction<ImagePreview[]>>
) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [pastedImagePreviews, setPastedImagePreviews] = useState<ImagePreview[]>([]);

  const uploadImage = (blob: Blob, fileName: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", blob, fileName);

      const now = new Date();
      const dateTimeString = now.toISOString();
      formData.append("header", dateTimeString);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

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
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          reject(new Error('Upload failed'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error'));
      };

      xhr.send(formData);
    });
  };

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (event.target !== textAreaRef.current) {
        return;
      }

      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf("image") !== -1) {
            event.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
              const timestamp = Date.now();
              const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`;
              try {
                const data = await uploadImage(blob, fileNameWithTimestamp);
                if (data.imageUrls) {
                  data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
                    const cacheBustedUrl = `${url}`;
                    const newImagePreview = { url: cacheBustedUrl, fileName: fileName };
                    setHomeImagePreviews((prevPreviews: ImagePreview[]) => [...prevPreviews, newImagePreview]);
                    setPastedImagePreviews((prevPreviews: ImagePreview[]) => [...prevPreviews, newImagePreview]);
                    // Update progress to 100% for the uploaded file
                    setUploadProgress(prev => ({
                      ...prev,
                      [fileName]: 100
                    }));
                  });
                }
              } catch (error) {
                console.error('Error processing pasted image:', error);
              } finally {
                // Remove progress after a short delay
                setTimeout(() => {
                  setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[fileNameWithTimestamp];
                    return newProgress;
                  });
                }, 1000);
              }
            }
          }
        }
      }
    };

    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.addEventListener('paste', handlePaste);
    }

    return () => {
      if (textArea) {
        textArea.removeEventListener('paste', handlePaste);
      }
    };
  }, [setHomeImagePreviews, roomId, auth, textAreaRef]);

  const clearPastedImagePreviews = () => {
    setPastedImagePreviews([]);
    setHomeImagePreviews(prevPreviews => prevPreviews.filter(preview => !pastedImagePreviews.includes(preview)));
  };

  return { uploadProgress, clearPastedImagePreviews };
};

export default usePasteImageUpload;