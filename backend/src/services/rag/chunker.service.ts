/**
 * Split text into overlapping chunks of roughly `size` words, breaking on
 * sentence boundaries so each chunk reads as complete thoughts. `overlap` is
 * the number of words carried over (as whole sentences) into the next chunk.
 */
export const chunkText = (text: string, size: number = 500, overlap: number = 50) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const maxWords = Math.max(1, size);
  const carry = Math.max(0, Math.min(overlap, maxWords - 1));

  // Sentences; very long ones are cut into word windows so no chunk overflows.
  const sentences = (clean.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [clean])
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      const words = s.split(' ');
      if (words.length <= maxWords) return [s];
      const parts: string[] = [];
      for (let i = 0; i < words.length; i += maxWords) parts.push(words.slice(i, i + maxWords).join(' '));
      return parts;
    });

  const chunks: string[] = [];
  let current: string[] = [];
  let count = 0;

  for (const sentence of sentences) {
    const n = sentence.split(' ').length;
    if (count + n > maxWords && current.length) {
      chunks.push(current.join(' '));
      // Carry trailing sentences (up to `carry` words) into the next chunk.
      const kept: string[] = [];
      let keptWords = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const w = current[i].split(' ').length;
        if (keptWords + w > carry) break;
        kept.unshift(current[i]);
        keptWords += w;
      }
      current = kept;
      count = keptWords;
    }
    current.push(sentence);
    count += n;
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks;
};
