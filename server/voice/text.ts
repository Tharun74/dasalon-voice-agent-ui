export function sentenceChunker(locale: string) {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
  let pending = '';
  return {
    push(fragment: string, final = false) {
      pending += fragment;
      const segments = Array.from(segmenter.segment(pending), item => item.segment);
      pending = final ? '' : segments.pop() ?? '';
      return segments.map(segment => segment.trim()).filter(Boolean);
    },
  };
}

export function normalizeForSpeech(text: string, language: string) {
  const units = language === 'hi-IN' ? ['रुपये', 'अमेरिकी डॉलर'] : language === 'ta-IN' ? ['ரூபாய்', 'டாலர்'] : ['rupees', 'dollars'];
  return text
    .replace(/([₹$])\s*(\d[\d,]*(?:\.\d{1,2})?)/gu, (_, currency: string, amount: string) =>
      `${amount.replaceAll(',', '')} ${units[currency === '₹' ? 0 : 1]}`)
    .replace(/\b(1[0-2]|0?[1-9]):00\s*(a\.?m\.?|p\.?m\.?)\b\.?/giu, '$1 $2')
    .replace(/\b([ap])\.?m\.?\b\.?/giu, (_, half: string) => half.toLowerCase() === 'a' ? 'A M' : 'P M');
}
