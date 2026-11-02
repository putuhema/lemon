declare module "foliate-js/view.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const makeBook: (file: Blob | File | string) => Promise<any>;
}
declare module "foliate-js/overlayer.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Overlayer: any;
}
declare module "foliate-js/epubcfi.js" {
  export const collapse: (cfi: string, toEnd?: boolean) => string;
  export const compare: (a: string, b: string) => number;
}
