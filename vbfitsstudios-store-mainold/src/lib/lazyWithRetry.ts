import React, { lazy } from 'react';

/**
 * A wrapper for React.lazy that automatically retries the import if it fails.
 * This is crucial for fixing Vite chunk loading errors (Failed to fetch dynamically imported module)
 * when a user navigates to a new page after a deployment has invalidated old chunks.
 */
export const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Assume that the error is due to a stale chunk, force a refresh
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        return window.location.reload();
      }
      // The page has already been reloaded, so throw the error to be caught by the ErrorBoundary
      throw error;
    }
  });
