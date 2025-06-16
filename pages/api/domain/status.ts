import { NextApiRequest, NextApiResponse } from 'next';
import { getDomainConfig, getDomainBranding } from '../../../utils/customDomain';
import { getTemplateConfig } from '../../../config/template';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const domainConfig = getDomainConfig(req);
    const branding = getDomainBranding(req);
    const templateConfig = getTemplateConfig();

    return res.status(200).json({
      success: true,
      domain: {
        current: domainConfig.currentDomain,
        custom: domainConfig.customDomain,
        isCustomDomain: domainConfig.isCustomDomain,
        isLocal: domainConfig.isLocal,
        isVercel: domainConfig.isVercel
      },
      branding: {
        companyName: branding.companyName,
        chatbotName: branding.chatbotName,
        showPoweredBy: branding.showPoweredBy
      },
      configuration: {
        customDomainConfigured: templateConfig.isCustomDomainConfigured,
        customDomainValue: templateConfig.customDomain
      },
      headers: {
        host: req.headers.host,
        userAgent: req.headers['user-agent'],
        customDomainHeader: req.headers['x-custom-domain'] || null
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelUrl: process.env.VERCEL_URL || null,
        customDomainEnv: process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || null
      }
    });
  } catch (error: any) {
    console.error('Domain status API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get domain status',
      details: error.message
    });
  }
}
