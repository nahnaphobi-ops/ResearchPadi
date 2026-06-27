export const chunkText = (text: string, size: number = 500, overlap: number = 50) => {
  const words = text.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += (size - overlap)) {
    chunks.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  
  return chunks;
};
