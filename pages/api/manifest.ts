import { NextApiRequest, NextApiResponse } from 'next';
import { getTemplateConfig } from '../../config/template';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const config = getTemplateConfig();
  
  const manifest = {
    name: config.favicon.manifestName,
    short_name: config.favicon.manifestShortName,
    description: config.companyDescription,
    icons: [
      {
        src: config.favicon.iconUrl,
        sizes: "48x48 32x32 16x16",
        type: "image/x-icon"
      },
      {
        src: config.favicon.icon192Url,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: config.favicon.icon512Url,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    start_url: "/",
    display: "standalone",
    theme_color: config.favicon.themeColor,
    background_color: config.favicon.backgroundColor,
    orientation: "portrait-primary",
    scope: "/",
    lang: "en"
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  res.status(200).json(manifest);
}