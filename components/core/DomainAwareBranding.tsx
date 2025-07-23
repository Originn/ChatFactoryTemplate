import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import { useDomain } from '../../hooks/useDomain';
import { getTemplateConfig } from '../../config/template';

interface DomainAwareBrandingProps {
  showCopyright?: boolean;
  showPrivacyLink?: boolean;
  showPoweredBy?: boolean;
  customStyles?: any;
}

const DomainAwareBranding: React.FC<DomainAwareBrandingProps> = ({
  showCopyright = true,
  showPrivacyLink = true,
  showPoweredBy = true,
  customStyles = {}
}) => {
  const { branding, domainConfig, isLoading } = useDomain();
  const templateConfig = getTemplateConfig();
  
  // Don't render during SSR/hydration to avoid mismatch
  if (isLoading) {
    return null;
  }
  
  // Determine what to show based on domain
  const shouldShowPoweredBy = showPoweredBy && branding.showPoweredBy;
  const currentYear = new Date().getFullYear();

  return (
    <Box 
      component="footer" 
      sx={{ 
        p: 2, 
        textAlign: 'center', 
        mt: 'auto',
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        ...customStyles 
      }}
    >
      {showCopyright && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          © {currentYear} {branding.companyName}™. All rights reserved.
        </Typography>
      )}
      
      {showPrivacyLink && (
        <Typography variant="body2" sx={{ mb: shouldShowPoweredBy ? 1 : 0 }}>
          <Link href="/privacy-policy" color="primary" underline="hover">
            Privacy Policy
          </Link>
        </Typography>
      )}
      
      {shouldShowPoweredBy && (
        <Typography variant="caption" color="text.disabled">
          Powered by{' '}
          <Link 
            href="https://chatfactory.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            color="primary"
            underline="hover"
          >
            ChatFactory
          </Link>
        </Typography>
      )}
      
      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.disabled">
            Domain: {domainConfig.currentDomain} | 
            Custom: {domainConfig.isCustomDomain ? 'Yes' : 'No'} | 
            Configured: {templateConfig.isCustomDomainConfigured ? 'Yes' : 'No'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default DomainAwareBranding;
