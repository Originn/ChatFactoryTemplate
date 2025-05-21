import React from 'react';
import Image from 'next/image';
import { Tooltip } from '@/components/ui/Feedback';
import styles from '@/styles/Home.module.css';

interface ImageUploadProps {
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ handleFileChange }) => {
  return (
    <>
      <input
        id="fileInput"
        type="file"
        accept="image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        multiple
      />
      <label
        htmlFor="fileInput"
        className={styles.fileUploadButton}
        title="Upload image for embedding"
      >
        <Tooltip message="Upload image for embedding" hideOnClick={true}>
          <Image
            src="/image-upload-48.png"
            alt="Upload JPG"
            width={30}
            height={30}
          />
        </Tooltip>
      </label>
    </>
  );
};

export default ImageUpload;