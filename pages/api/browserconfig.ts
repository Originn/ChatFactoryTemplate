import { NextApiRequest, NextApiResponse } from 'next';
import { getTemplateConfig } from '../../config/template';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const config = getTemplateConfig();
  
  const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="${config.favicon.iconUrl}"/>
            <TileColor>${config.favicon.themeColor}</TileColor>
        </tile>
    </msapplication>
</browserconfig>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  res.status(200).send(browserConfig);
}