import { HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'altcha-widget': HTMLAttributes<HTMLElement> & {
        challengeurl?: string;
        strings?: {
          label?: string;
          error?: string;
        };
      };
    }
  }
}

export {};

