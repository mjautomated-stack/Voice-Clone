
import { Language, VoicePersona } from './types';

export const LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
];

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'zephyr-persona',
    name: 'Zephyr',
    voiceName: 'Zephyr',
    description: 'Energetic and friendly support agent with a clear California accent.',
    imageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop',
    language: 'en-US',
    color: 'blue',
    age: 'Adult',
    gender: 'Male',
    accent: 'American'
  },
  {
    id: 'puck-persona',
    name: 'Puck',
    voiceName: 'Puck',
    description: 'Youthful and playful conversational companion for casual chats.',
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
    language: 'en-US',
    color: 'emerald',
    age: 'Young',
    gender: 'Female',
    accent: 'British'
  },
  {
    id: 'kore-persona',
    name: 'Kore',
    voiceName: 'Kore',
    description: 'Professional, calm and highly analytical executive assistant.',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
    language: 'en-US',
    color: 'indigo',
    age: 'Adult',
    gender: 'Female',
    accent: 'Mid-Atlantic'
  },
  {
    id: 'charon-persona',
    name: 'Charon',
    voiceName: 'Charon',
    description: 'Deep, resonant, and wisdom-filled storyteller with a seasoned voice.',
    imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    language: 'en-US',
    color: 'purple',
    age: 'Senior',
    gender: 'Male',
    accent: 'Southern'
  },
  {
    id: 'fenrir-persona',
    name: 'Fenrir',
    voiceName: 'Fenrir',
    description: 'Fast-paced, gritty, and direct technical assistant.',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    language: 'en-US',
    color: 'amber',
    age: 'Adult',
    gender: 'Male',
    accent: 'Australian'
  }
];
