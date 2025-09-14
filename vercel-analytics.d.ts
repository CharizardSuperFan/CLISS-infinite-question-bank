// This file provides a manual type definition for the Vercel Analytics React component.
// It helps TypeScript understand the module's shape when automatic resolution fails in this specific build environment.
declare module '@vercel/analytics/react' {
  import React from 'react';

  /**
   * The Vercel Analytics component. It requires no props for basic setup.
   * This component automatically tracks page views and other metrics when deployed on Vercel.
   */
  const Analytics: React.FC;
  export { Analytics };
}
