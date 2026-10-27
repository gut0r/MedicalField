/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  medicalFieldDesktop?: Readonly<{
    isDesktop: true;
    storagePath: string;
    inspectShortcut: string;
  }>;
}

