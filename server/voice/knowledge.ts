import type { SarvamLanguage } from '../../src/adapters/sarvam-protocol.js';

interface SalonService {
  name: string;
  from: number;
}
export interface SalonKnowledge {
  name: string;
  currency: 'USD' | 'INR';
  services: Record<'cut' | 'gloss' | 'scalp', SalonService>;
  hours: string | null;
  staff: readonly string[];
  location: string | null;
  policies: readonly string[];
  products: readonly string[];
  aftercare: readonly string[];
  faqs: Readonly<Record<string, string>>;
  contact: { phone: string | null; whatsapp: string | null };
}
export const salon: SalonKnowledge = {
  name: 'Maison Serein',
  currency: 'USD',
  services: {
    cut: { name: 'Cut and shape', from: 85 },
    gloss: { name: 'Gloss and color', from: 110 },
    scalp: { name: 'Scalp ritual', from: 75 },
  },
  hours: null,
  staff: [],
  location: null,
  policies: [],
  products: [],
  aftercare: [],
  faqs: {},
  contact: { phone: null, whatsapp: null },
};

export const factIds = ['services', 'cut', 'gloss', 'scalp', 'hours', 'staff', 'location', 'policies', 'products', 'aftercare', 'availability', 'booking', 'cancel', 'handoff', 'capabilities'] as const;
export type FactId = typeof factIds[number];
const cannedIds = ['greeting', 'refusal', 'smallTalk', 'sensitive', 'unclear', 'end', 'unavailable'] as const;
export type CannedId = typeof cannedIds[number];
export type SpeechId = FactId | CannedId;

type VettedLocale = 'en-IN' | 'hi-IN' | 'ta-IN';
export const vettedLocales: readonly VettedLocale[] = ['en-IN', 'hi-IN', 'ta-IN'];
export function speechLocale(language: SarvamLanguage): VettedLocale {
  return language === 'hi-IN' || language === 'ta-IN' ? language : 'en-IN';
}

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: salon.currency, maximumFractionDigits: 0 });
const cut = price.format(salon.services.cut.from);
const gloss = price.format(salon.services.gloss.from);
const scalp = price.format(salon.services.scalp.from);
const { name } = salon;

const lines: Record<VettedLocale, Record<SpeechId, string>> = {
  'en-IN': {
    greeting: `Hi, I'm the AI receptionist for ${name}. What can I help you with today?`,
    refusal: `I can only help with ${name}, including services, prices and appointments.`,
    smallTalk: 'Lovely to hear from you. Would you like to explore our salon services?',
    sensitive: 'If anyone is in immediate danger, contact your local emergency services. Please reach out to a qualified professional for help.',
    unclear: 'What would you like to know about our salon services or appointments?',
    end: 'Please contact the salon team directly if you need help. Thanks for visiting.',
    unavailable: 'I could not check that right now. Please try again or ask the salon team.',
    services: `Our menu includes ${salon.services.cut.name.toLowerCase()}, ${salon.services.gloss.name.toLowerCase()}, and a ${salon.services.scalp.name.toLowerCase()}.`,
    cut: `${salon.services.cut.name} starts at ${cut}.`,
    gloss: `${salon.services.gloss.name} starts at ${gloss}.`,
    scalp: `${salon.services.scalp.name} starts at ${scalp}.`,
    hours: salon.hours ?? 'The salon hours have not been published. Please check with the salon team.',
    staff: salon.staff.length ? `Our stylists are ${salon.staff.join(', ')}.` : 'I do not have a published stylist list. The salon team can help.',
    location: salon.location ?? 'The salon address has not been published. Please check with the salon team.',
    policies: salon.policies[0] ?? 'I do not have a published policy for that. Please check with the salon team.',
    products: salon.products[0] ?? 'I do not have a published product list. Please ask the salon team.',
    aftercare: salon.aftercare[0] ?? 'I do not have aftercare instructions for that service. Please ask your stylist.',
    availability: 'I cannot check live availability here. Please ask the salon team about openings.',
    booking: 'The salon team can help you book or reschedule an appointment.',
    cancel: 'Please contact the salon team directly to request a cancellation.',
    handoff: 'Please use the contact details on your salon materials to reach the team.',
    capabilities: 'I can explain our salon services and prices, and tell you how to get booking help.',
  },
  'hi-IN': {
    greeting: `नमस्ते, मैं ${name} की एआई रिसेप्शनिस्ट हूँ। मैं आपकी क्या मदद कर सकती हूँ?`,
    refusal: `मैं केवल ${name} की सेवाओं, कीमतों और अपॉइंटमेंट में मदद कर सकती हूँ।`,
    smallTalk: 'आपसे बात करके अच्छा लगा। क्या आप सैलून की सेवाओं के बारे में जानना चाहेंगे?',
    sensitive: 'अगर किसी को तत्काल खतरा है, तो स्थानीय आपातकालीन सेवा से संपर्क करें। मदद के लिए किसी योग्य विशेषज्ञ से बात करें।',
    unclear: 'आप सैलून की सेवाओं या अपॉइंटमेंट के बारे में क्या जानना चाहेंगे?',
    end: 'मदद के लिए सीधे सैलून की टीम से बात करें। आने के लिए धन्यवाद।',
    unavailable: 'मैं अभी यह जानकारी नहीं देख पाई। दोबारा कोशिश करें या सैलून की टीम से बात करें।',
    services: 'हम बाल काटने, ग्लॉस और कलर, और स्कैल्प केयर की सेवाएँ देते हैं।',
    cut: `हेयरकट की कीमत ${cut} से शुरू होती है।`,
    gloss: `ग्लॉस और कलर की कीमत ${gloss} से शुरू होती है।`,
    scalp: `स्कैल्प केयर की कीमत ${scalp} से शुरू होती है।`,
    hours: 'मेरे पास सैलून का समय नहीं है। कृपया सैलून की टीम से पूछें।',
    staff: 'मेरे पास स्टाइलिस्ट की सूची नहीं है। कृपया सैलून की टीम से पूछें।',
    location: 'मेरे पास सैलून का पता नहीं है। कृपया सैलून की टीम से पूछें।',
    policies: 'मेरे पास इस नीति की जानकारी नहीं है। कृपया सैलून की टीम से पूछें।',
    products: 'मेरे पास उत्पादों की सूची नहीं है। कृपया सैलून की टीम से पूछें।',
    aftercare: 'मेरे पास इस सेवा के बाद की देखभाल की जानकारी नहीं है। कृपया अपने स्टाइलिस्ट से पूछें।',
    availability: 'मैं उपलब्ध समय नहीं देख सकती। कृपया सैलून की टीम से पूछें।',
    booking: 'अपॉइंटमेंट लेने या बदलने के लिए सैलून की टीम से बात करें।',
    cancel: 'अपॉइंटमेंट रद्द करने के लिए सीधे सैलून की टीम से बात करें।',
    handoff: 'सैलून की टीम से संपर्क करने के लिए सैलून की दी हुई जानकारी देखें।',
    capabilities: 'मैं सैलून की सेवाओं, उनकी कीमतों और अपॉइंटमेंट की जानकारी दे सकती हूँ।',
  },
  'ta-IN': {
    greeting: `வணக்கம், நான் ${name} சலூனின் ஏஐ வரவேற்பாளர். உங்களுக்கு எப்படி உதவலாம்?`,
    refusal: `${name} சலூனின் சேவைகள், கட்டணங்கள், முன்பதிவு பற்றி மட்டுமே என்னால் உதவ முடியும்.`,
    smallTalk: 'உங்களுடன் பேசுவதில் மகிழ்ச்சி. சலூன் சேவைகளைப் பற்றி அறிய விரும்புகிறீர்களா?',
    sensitive: 'உடனடி ஆபத்து இருந்தால் உள்ளூர் அவசர சேவைகளை அழைக்கவும். உதவிக்கு தகுதியான நிபுணரை அணுகவும்.',
    unclear: 'சலூன் சேவைகள் அல்லது முன்பதிவு பற்றி என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?',
    end: 'உதவிக்கு சலூன் குழுவை நேரடியாகத் தொடர்புகொள்ளுங்கள். நன்றி.',
    unavailable: 'இப்போது அதைச் சரிபார்க்க முடியவில்லை. மீண்டும் முயலுங்கள் அல்லது சலூன் குழுவிடம் கேளுங்கள்.',
    services: 'முடி வெட்டுதல், பளபளப்பு மற்றும் நிறமிடுதல், உச்சந்தலைப் பராமரிப்பு ஆகியவை எங்கள் சேவைகள்.',
    cut: `முடி வெட்டும் கட்டணம் ${cut} முதல் தொடங்குகிறது.`,
    gloss: `பளபளப்பு மற்றும் நிறமிடும் கட்டணம் ${gloss} முதல் தொடங்குகிறது.`,
    scalp: `உச்சந்தலைப் பராமரிப்புக் கட்டணம் ${scalp} முதல் தொடங்குகிறது.`,
    hours: 'சலூன் திறந்திருக்கும் நேரம் என்னிடம் இல்லை. சலூன் குழுவிடம் கேளுங்கள்.',
    staff: 'சிகை அலங்கார நிபுணர்கள் பட்டியல் என்னிடம் இல்லை. சலூன் குழுவிடம் கேளுங்கள்.',
    location: 'சலூன் முகவரி என்னிடம் இல்லை. சலூன் குழுவிடம் கேளுங்கள்.',
    policies: 'அந்தக் கொள்கை பற்றிய தகவல் என்னிடம் இல்லை. சலூன் குழுவிடம் கேளுங்கள்.',
    products: 'தயாரிப்புப் பட்டியல் என்னிடம் இல்லை. சலூன் குழுவிடம் கேளுங்கள்.',
    aftercare: 'இந்த சேவைக்குப் பிந்தைய பராமரிப்பு வழிமுறைகள் என்னிடம் இல்லை. உங்கள் நிபுணரிடம் கேளுங்கள்.',
    availability: 'காலியாக உள்ள நேரத்தைப் பார்க்க முடியவில்லை. சலூன் குழுவிடம் கேளுங்கள்.',
    booking: 'முன்பதிவு செய்ய அல்லது மாற்ற சலூன் குழுவைத் தொடர்புகொள்ளுங்கள்.',
    cancel: 'முன்பதிவை ரத்து செய்ய சலூன் குழுவை நேரடியாகத் தொடர்புகொள்ளுங்கள்.',
    handoff: 'சலூன் குழுவை அணுக, சலூன் வழங்கிய தொடர்பு விவரங்களைப் பயன்படுத்துங்கள்.',
    capabilities: 'சலூன் சேவைகள், கட்டணங்கள், முன்பதிவு உதவி பற்றி என்னால் விளக்க முடியும்.',
  },
};

export const guardrails = Object.freeze({
  strict: true,
  scope: 'The configured salon only: services, prices, stylists, hours, directions, appointment requests and changes, policies, products, aftercare, handoff, and assistant capabilities.',
  allowSmallTalk: true,
  refusals: Object.fromEntries(vettedLocales.map(language => [language, lines[language].refusal])) as Record<VettedLocale, string>,
});

export function approvedLine(id: SpeechId, language: SarvamLanguage): string {
  const locale = speechLocale(language);
  return id === 'refusal' ? guardrails.refusals[locale] : lines[locale][id];
}

export const approvedIds: readonly SpeechId[] = [...factIds, ...cannedIds];
