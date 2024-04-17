//components/FileUpload.tsx
import React, { ChangeEvent } from 'react';
import styles from '@/styles/Home.module.css';
import PDFPreview from '@/components/PDFPreview';
import DonutProgressIndicator from '@/components/DonutProgressIndicator';

interface FileUploadProps {
  file: File | null;
  filePreview: string | null;
  uploadProgress: number | null;
  loading: boolean;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  removeImage: () => Promise<void>;
  triggerFileInputClick: () => void;
  uploadImage: (file: File) => Promise<void>;
  setFile: (file: File | null) => void;
  setFilePreview: (preview: string | null) => void;
  setUploadProgress: (progress: number | null) => void;
  setError: (error: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const FileUpload: React.FC<FileUploadProps> = ({
  file,
  filePreview,
  uploadProgress,
  loading,
  handleFileChange,
  removeImage,
  uploadImage,
  setFile,
  setFilePreview,
  setUploadProgress,
  setError,
  fileInputRef,
}) => {
    const triggerFileInputClick = () => {
        fileInputRef.current?.click();
      };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      handleFileChange(event);
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setError(null); // Clear any previous errors

        if (selectedFile.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const blob = new Blob([selectedFile], { type: selectedFile.type });
            const blobUrl = URL.createObjectURL(blob);
            setFilePreview(blobUrl);
            uploadImage(selectedFile);
          };
          reader.readAsDataURL(selectedFile);
        } else {
          setFilePreview(null);
          await uploadImage(selectedFile);
        }
      } else {
        setError("No file selected");
      }
    } catch (error) {
      setError(`Error uploading file: ${error}`);
    }
  };

  return (
    <>
      {filePreview && (
        <div className={styles.filePreviewContainer} style={{ position: 'relative', display: 'inline-block' }}>
          <img src={filePreview} alt="File preview" style={{ width: '80px', height: '80px', display: 'block' }} />
          <button
            type="button"
            onClick={removeImage}
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              transform: 'translateX(100%)',
              background: 'gray',
              color: 'white',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25em',
              fontSize: '0.7em',
              fontWeight: 'bold',
              lineHeight: '1',
              zIndex: 10,
            }}
          >
            X
          </button>
          {uploadProgress !== null && (
            <div
              style={{
                position: 'absolute',
                top: '1px',
                left: '1px',
                zIndex: 2,
              }}
            >
              <DonutProgressIndicator progress={uploadProgress} />
            </div>
          )}
        </div>
      )}
      {file && file.type === 'application/pdf' && (
        <div className={styles.filePreviewContainer}>
          <PDFPreview file={file} />
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
      <div className={styles.buttonContainer}>
        <button
          type="button"
          disabled={loading}
          onClick={triggerFileInputClick}
          className={styles.uploadbutton}
        >
          <img src="paperclip.svg" alt="Paperclip" style={{ transform: 'rotate(180deg)' }} className={styles.svgicon} />
        </button>
      </div>
    </>
  );
};

export default FileUpload;