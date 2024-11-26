// pages/index.tsx

import React from 'react';
import Home from '@/components/Home';

interface IndexPageProps {
  isFromSolidcamWeb?: boolean;
}

const IndexPage: React.FC<IndexPageProps> = ({ isFromSolidcamWeb }) => {
  return <Home isFromSolidcamWeb={isFromSolidcamWeb} />;
};

export default IndexPage;
