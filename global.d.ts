declare global {
  interface Window {
      gtag: (...args: any[]) => void;
      gtagReady?: boolean; // Add this property
  }
}

export {};
