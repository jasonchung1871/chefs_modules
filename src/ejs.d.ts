declare module '*.ejs' {
  const value: string;
  export default value
}

declare var Formio: any;

interface FormioConfig {
  GEO_ADDRESS_API_URL?: string;
  // Add other properties as needed
}

declare global {
  interface Window {
    FORMIO_CONFIG?: FormioConfig;
  }
}

export {};
