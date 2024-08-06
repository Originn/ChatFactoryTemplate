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
  setQuery: (query: string | ((prevQuery: string) => string)) => void, 
  roomId: string | null, 
  auth: any,
  setUploadStatus: (status: string | null) => void
) => {
  const [homeImagePreviews, setHomeImagePreviews] = useState<ImagePreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHomeFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 2) {
      alert('Only 2 images are allowed per upload');
      return;
    }
    if (files && files.length > 0) {
      setUploadStatus('Uploading and processing...');
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const fileNameWithTimestamp = `${uuidv4()}-${timestamp}.jpg`;
        const formData = new FormData();
        formData.append("file", file, fileNameWithTimestamp);

        const now = new Date();
        const dateTimeString = now.toISOString();

        formData.append("header", dateTimeString);

        try {
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

          await new Promise<void>((resolve, reject) => {
            xhr.onload = () => {
              if (xhr.status === 200) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  if (data.imageUrls) {
                    setHomeImagePreviews((prevPreviews: ImagePreview[]) => {
                      const newPreviews = [
                        ...prevPreviews,
                        ...data.imageUrls.map(({ url, fileName }: { url: string, fileName: string }) => ({
                          url: `${url}`,
                          fileName: fileName
                        }))
                      ];
                      console.log("Updated homeImagePreviews:", newPreviews);
                      return newPreviews;
                    });
                    // Clear progress for uploaded files
                    data.imageUrls.forEach(({ fileName }: { fileName: string }) => {
                      setUploadProgress(prev => ({
                        ...prev,
                        [fileName]: null  // Set to null instead of 100
                      }));
                    });
                  }
                  resolve();
                } catch (error) {
                  console.error('Error parsing response:', error);
                  reject(new Error('Error parsing server response'));
                }
              } else {
                console.error('Upload failed with status:', xhr.status);
                console.error('Response:', xhr.responseText);
                reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
              }
            };

            xhr.onerror = () => {
              console.error('XHR error occurred');
              reject(new Error('Network error occurred during upload'));
            };

            xhr.send(formData);
          });
        } catch (error:any) {
          console.error('Error uploading file:', error);
          setUploadStatus(`Upload failed: ${error.message}`);
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
    // Reset the file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleHomeDeleteImage = async (fileName: string, index: number) => {
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      if (!response.ok) throw new Error('Failed to delete image');
      
      setHomeImagePreviews(prevPreviews => prevPreviews.filter((_, i) => i !== index));
      // Remove the progress for the deleted image
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });
    } catch (error) {
      console.error('Error deleting general user image:', error);
    } finally {
      // Reset the file input using the ref
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return {
    homeImagePreviews,
    handleHomeFileChange,
    handleHomeDeleteImage,
    setHomeImagePreviews,
    fileInputRef,
    uploadProgress,
  };
};

export default useFileUploadFromHome;