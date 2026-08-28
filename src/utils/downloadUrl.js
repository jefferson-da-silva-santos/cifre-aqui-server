export function buildDownloadUrl(fileName) {
  return `/downloads/pdfs/${encodeURIComponent(fileName)}`;
}
