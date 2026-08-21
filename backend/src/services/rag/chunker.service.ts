export const chunkText = (text: string, size: number = 500, overlap: number = 50) => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  const window = Math.max(1, size);
  const step = Math.max(1, window - Math.min(Math.max(0, overlap), window - 1));

  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + window).join(' '));
    if (i + window >= words.length) break;
  }

  return chunks;
};
