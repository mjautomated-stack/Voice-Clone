
export type VoicePersona = {
  id: string;
  name: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  description: string;
  imageUrl: string;
  language: string;
  color: string;
  age: 'Young' | 'Adult' | 'Senior';
  gender: 'Male' | 'Female' | 'Non-binary';
  accent: string;
  isCustom?: boolean;
  vocalProfile?: string;
  createdAt?: number;
};

export interface SynthesisAsset {
  id: string;
  text: string;
  audioData: string; // Base64
  personaName: string;
  timestamp: number;
}

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
};

export interface TranscriptionItem {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Feedback {
  personaId: string;
  rating: number;
  comment: string;
  timestamp: Date;
}

export type AuthMode = 'login' | 'signup' | 'recovery';
