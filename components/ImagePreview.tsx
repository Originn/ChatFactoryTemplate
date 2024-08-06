import React from 'react';
import CircularProgressBar from './CircularProgressBar';

interface ImagePreviewData {
  url: string;
  fileName: string;
}

interface ImagePreviewProps {
  image: ImagePreviewData;
  index: number;
  onDelete: (fileName: string, index: number) => void;
  uploadProgress: number | null;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ image, index, onDelete, uploadProgress }) => {
  return (
    <div className="image-wrapper" style={{ 
      position: 'relative', 
      width: '150px', 
      height: '150px', 
      marginBottom: '10px',
      overflow: 'hidden',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <img
        src={image.url}
        alt={`Image Preview ${index + 1}`}
        className="image-preview"
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover'
        }}
      />
      <button 
        onClick={() => {
          onDelete(image.fileName, index);
        }} 
        className="delete-button" 
        style={{ 
          position: 'absolute', 
          top: '5px', 
          right: '5px',
          background: 'rgba(255, 255, 255, 0.7)',
          border: 'none',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#333',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)')}
      >
        ×
      </button>
      {uploadProgress !== null && !isNaN(uploadProgress) && uploadProgress < 100 && (
        <div style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.7)', padding: '2px', borderRadius: '50%' }}>
          <CircularProgressBar progress={Math.round(uploadProgress)} />
        </div>
      )}
    </div>
  );
};

export { ImagePreview };
export type { ImagePreviewData };