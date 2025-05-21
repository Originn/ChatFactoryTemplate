import React from 'react';
import Image from 'next/image';
import { Box, IconButton } from '@mui/material';
import { Tooltip } from '@/components/ui/Feedback';

interface ImageUploadProps {
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ handleFileChange }) => {
  return (
    <Box component="span">
      <input
        id="fileInput"
        type="file"
        accept="image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        multiple
      />
      <IconButton component="label" htmlFor="fileInput" title="Upload image for embedding" size="small">
        <Tooltip message="Upload image for embedding" hideOnClick={true}>
          <Image src="/image-upload-48.png" alt="Upload JPG" width={30} height={30} />
        </Tooltip>
      </IconButton>
    </Box>
  );
};

export default ImageUpload;