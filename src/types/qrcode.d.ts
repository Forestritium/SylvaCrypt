declare module 'qrcode' {
  interface QRCodeToDataURLOptions {
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
  function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  export default { toDataURL };
}
