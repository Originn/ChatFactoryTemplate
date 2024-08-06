import React, { ChangeEvent, FC } from 'react';
import Image from 'next/image';
import styles from '@/styles/Home.module.css';

interface ImageUploadProps {
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

const ImageUpload: FC<ImageUploadProps> = ({ handleFileChange }) => {
  return (
    <label htmlFor="fileInput" className={`${styles.fileUploadButtonInHome}`}>
      <input
        id="fileInput"
        type="file"
        accept="image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        multiple
      />
      <Image src="/image-upload-48.png" alt="Upload JPG" width="30" height="30" />
    </label>
  );
};

export default ImageUpload;


