// components/EnlargedImageView.tsx
import React from 'react';

interface EnlargedImageViewProps {
  imageUrl: string;
  altText: string;
  onClose: () => void;
}

const EnlargedImageView: React.FC<EnlargedImageViewProps> = ({ imageUrl, altText, onClose }) => {
    return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            maxWidth: '90%',
            maxHeight: '90%',
            position: 'relative'
          }}>
            <img 
              src={imageUrl} 
              alt={altText} 
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
            <button 
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer'
              }}
            >
              X
            </button>
          </div>
        </div>
      );
    };

export default EnlargedImageView;