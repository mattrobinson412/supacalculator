declare module 'papaparse' {
  export function unparse(data: any): string
}

declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void
}