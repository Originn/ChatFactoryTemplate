import { AnchorHTMLAttributes  } from 'react';

export interface DocumentWithMetadata {
    metadata: {
      source: string;
    };
  }

export type RequestsInProgressType = {
    [key: string]: boolean;
};

export interface CustomLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href?: string;
  }