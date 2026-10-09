/** The file name a Content-Disposition header gives, if it gives one. */
export const fileNameOf = (
  disposition: string | undefined,
  fallback: string,
): string => {
  const match = disposition && /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : fallback;
};

/**
 * Hands `text` to the browser as a file to save. For a file the API sends
 * to a signed-in caller: a plain link would not carry the access token.
 */
export const saveText = (text: string, fileName: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
