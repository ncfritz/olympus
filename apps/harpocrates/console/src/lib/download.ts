/** Hands the browser a file to save. Nothing is kept anywhere else. */
export const saveFile = (
  fileName: string,
  content: string | Uint8Array<ArrayBuffer>,
  type = "application/octet-stream",
): void => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // After the click has been handled: revoking first cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** A base64 file, as the key export answers one, to bytes. */
export const fromBase64 = (data: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
