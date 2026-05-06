export function renderableImageUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  const separatorIndex = trimmed.search(/[?#]/);
  const baseUrl = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;

  if (/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:[^/]+\/)+[^/]+\.(?:tif|tiff)$/i.test(baseUrl)) {
    const fileName = baseUrl.split("/").pop();
    if (fileName) {
      return `${baseUrl.replace("/wikipedia/commons/", "/wikipedia/commons/thumb/")}/1280px-${fileName}.jpg`;
    }
  }

  return trimmed;
}
