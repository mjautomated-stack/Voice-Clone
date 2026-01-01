
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createBlob, createWavFile } from './utils/audio-utils';
import { LANGUAGES, VOICE_PERSONAS } from './constants';
import { Language, VoicePersona, TranscriptionItem, SynthesisAsset } from './types';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  // Core State
  const [selectedLang, setSelectedLang] = useState<Language>(LANGUAGES[0]);
  const [selectedPersona, setSelectedPersona] = useState<VoicePersona>(VOICE_PERSONAS[0]);
  
  // Custom Clones & Vault
  const [customPersonas, setCustomPersonas] = useState<VoicePersona[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // TTS & Assets
  const [ttsText, setTtsText] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisGallery, setSynthesisGallery] = useState<SynthesisAsset[]>([]);

  // Session State
  const [isLive, setIsLive] = useState(false);
  const [isAIspeaking, setIsAIspeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Audio Processing Refs
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentOutputTranscriptionRef = useRef('');
  const currentInputTranscriptionRef = useRef('');

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('vox_vault_pro');
    if (saved) setCustomPersonas(JSON.parse(saved));
    const savedGallery = localStorage.getItem('vox_gallery_pro');
    if (savedGallery) setSynthesisGallery(JSON.parse(savedGallery));
  }, []);

  useEffect(() => {
    localStorage.setItem('vox_vault_pro', JSON.stringify(customPersonas));
  }, [customPersonas]);

  useEffect(() => {
    localStorage.setItem('vox_gallery_pro', JSON.stringify(synthesisGallery));
  }, [synthesisGallery]);

  // Vocal Cloning Logic
  const processAudioForCloning = async (blob: Blob) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
      const base64Data = await base64Promise;

      // Use Gemini 3 Pro to analyze the vocal fingerprints
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            { text: "Analyze this vocal sample. Provide a detailed description of the voice including: pitch (high/low), tone (raspy/smooth/warm/cold), accent (specific region if possible), cadence, and any unique characteristics. This description will be used to guide a TTS model to clone the voice. Output the description only." },
            { inlineData: { data: base64Data, mimeType: blob.type || 'audio/webm' } }
          ]
        }
      });

      const vocalDescriptor = response.text || "A unique neural vocal signature.";
      
      const newClone: VoicePersona = {
        id: `clone-${Date.now()}`,
        name: `Neural Clone #${customPersonas.length + 1}`,
        voiceName: 'Zephyr', // Base model used for synthesis modulation
        description: `Custom cloned voice: ${vocalDescriptor}`,
        imageUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=400&fit=crop',
        language: selectedLang.code,
        color: 'indigo',
        age: 'Adult',
        gender: 'Non-binary',
        accent: 'Custom Cloned',
        isCustom: true,
        vocalProfile: vocalDescriptor,
        createdAt: Date.now()
      };

      setCustomPersonas(prev => [newClone, ...prev]);
      setSelectedPersona(newClone);
      setShowUploadModal(false);
    } catch (err: any) {
      console.error(err);
      setError("Vocal analysis failed. Please ensure the sample is clear.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        processAudioForCloning(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      (window as any)._activeCloneRecorder = recorder;
    } catch (err) {
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    const r = (window as any)._activeCloneRecorder;
    if (r) {
      r.stop();
      setIsRecording(false);
    }
  };

  // Synthesis Logic
  const synthesizeSpeech = async () => {
    if (!ttsText.trim()) return;
    setIsSynthesizing(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // We instruct the TTS model to adopt the analyzed vocal profile
      const instruction = selectedPersona.isCustom 
        ? `Adopt the following vocal characteristics: ${selectedPersona.vocalProfile}. Speak the text precisely in this tone and accent.`
        : `Use the persona of ${selectedPersona.name}: ${selectedPersona.description}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: `${instruction}\n\nText: ${ttsText}` }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedPersona.voiceName } },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const newAsset: SynthesisAsset = {
          id: `syn-${Date.now()}`,
          text: ttsText,
          audioData: audioData,
          personaName: selectedPersona.name,
          timestamp: Date.now()
        };
        setSynthesisGallery(prev => [newAsset, ...prev]);
        playAudio(audioData);
        setTtsText('');
      }
    } catch (err) {
      setError("Synthesis failed. Try a shorter text or different persona.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const playAudio = async (base64: string) => {
    const ctx = audioContextOutRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextOutRef.current = ctx;
    const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    setIsAIspeaking(true);
    source.onended = () => setIsAIspeaking(false);
    source.start(0);
  };

  const downloadAsset = (asset: SynthesisAsset) => {
    const pcmBytes = decode(asset.audioData);
    const wavBlob = createWavFile(pcmBytes, 24000, 1);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoxClone_${asset.personaName}_${asset.id}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startLiveConversation = async () => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      
      audioContextInRef.current = new AudioContext({ sampleRate: 16000 });
      audioContextOutRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      const systemPrompt = `You are currently using the voice clone of: ${selectedPersona.name}. 
      Vocal characteristics to mimic: ${selectedPersona.isCustom ? selectedPersona.vocalProfile : selectedPersona.description}.
      Respond to the user naturally in ${selectedLang.name}. Be helpful and professional.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedPersona.voiceName } },
          },
          systemInstruction: systemPrompt,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsLive(true);
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            
            if (message.serverContent?.turnComplete) {
              const input = currentInputTranscriptionRef.current;
              const output = currentOutputTranscriptionRef.current;
              if (input) setTranscriptions(p => [...p, { sender: 'user', text: input, timestamp: new Date() }]);
              if (output) setTranscriptions(p => [...p, { sender: 'ai', text: output, timestamp: new Date() }]);
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setIsAIspeaking(true);
              const ctx = audioContextOutRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => {
                activeSourcesRef.current.delete(source);
                if (activeSourcesRef.current.size === 0) setIsAIspeaking(false);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              activeSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => s.stop());
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAIspeaking(false);
            }
          },
          onerror: () => {
            setError("Session error. Please reconnect.");
            stopLiveConversation();
          },
        },
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      setError(err.message);
      stopLiveConversation();
    }
  };

  const stopLiveConversation = () => {
    setIsLive(false);
    setIsAIspeaking(false);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    sessionPromiseRef.current?.then(s => s.close().catch(() => {}));
    sessionPromiseRef.current = null;
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-200">
      
      {/* CLONE UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass w-full max-w-lg p-10 rounded-[3rem] border-white/10 shadow-2xl relative">
            <button onClick={() => setShowUploadModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-2xl voice-gradient flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/20">
                <i className="fas fa-dna text-white text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black">Vocal DNA Capture</h2>
              <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold">Clone any voice with 10s of audio.</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-10">
              <div 
                onClick={() => !isAnalyzing && document.getElementById('audio-upload')?.click()}
                className="group border-2 border-slate-800 border-dashed rounded-[2rem] p-8 flex flex-col items-center gap-4 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer"
              >
                <input type="file" id="audio-upload" className="hidden" accept="audio/*" onChange={(e) => e.target.files?.[0] && processAudioForCloning(e.target.files[0])} />
                <i className="fas fa-file-arrow-up text-3xl text-slate-600 group-hover:text-indigo-400"></i>
                <span className="text-[10px] font-black uppercase">Upload File</span>
              </div>

              <div 
                onClick={() => !isAnalyzing && (isRecording ? stopRecording() : startRecording())}
                className={`group border-2 rounded-[2rem] p-8 flex flex-col items-center gap-4 transition-all cursor-pointer ${isRecording ? 'border-red-500 bg-red-500/10' : 'border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5'}`}
              >
                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-slate-600 group-hover:bg-indigo-400'}`}></div>
                <span className="text-[10px] font-black uppercase">{isRecording ? 'Stop Recording' : 'Live Record'}</span>
              </div>
            </div>

            {isAnalyzing && (
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-indigo-500/20 text-center">
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-indigo-500 w-1/3 animate-[progress_1.5s_infinite]"></div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Deconstructing Neural Signals...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DASHBOARD LAYOUT */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* SIDEBAR: NEURAL VAULT */}
        <aside className="lg:col-span-3 border-r border-white/5 p-8 flex flex-col gap-10 bg-[#0c121e]/80">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl voice-gradient flex items-center justify-center"><i className="fas fa-satellite-dish text-white"></i></div>
            <div>
              <h1 className="text-xl font-black tracking-tighter">VOX VAULT</h1>
              <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Neural Assets v2.4</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Neural Fingerprints</h2>
              <button onClick={() => setShowUploadModal(true)} className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"><i className="fas fa-plus"></i></button>
            </div>
            
            <div className="space-y-4">
              {customPersonas.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => setSelectedPersona(p)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedPersona.id === p.id ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/5' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black truncate">{p.name}</p>
                      <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">{p.accent}</p>
                    </div>
                    {p.isCustom && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCustomPersonas(prev => prev.filter(x => x.id !== p.id)); }} 
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-700 hover:text-red-500 transition-all"
                      >
                        <i className="fas fa-trash-can text-[10px]"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="pt-6 border-t border-white/5 mt-6">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Preset Nodes</h2>
                {VOICE_PERSONAS.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedPersona(p)}
                    className={`p-4 rounded-2xl border mb-3 transition-all cursor-pointer group ${selectedPersona.id === p.id ? 'bg-indigo-500/10 border-indigo-500' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-4">
                      <img src={p.imageUrl} className="w-8 h-8 rounded-lg object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-tight">{p.name}</p>
                        <p className="text-[7px] text-slate-500 uppercase font-bold">{p.accent}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN PANEL */}
        <main className="lg:col-span-9 p-8 lg:p-12 overflow-y-auto custom-scrollbar">
          
          <header className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-8">
              <div className="w-24 h-24 rounded-[2.5rem] glass p-1 border-indigo-500/20 shadow-2xl">
                <img src={selectedPersona.imageUrl} className="w-full h-full rounded-[2.3rem] object-cover" alt="" />
              </div>
              <div>
                <h2 className="text-5xl font-black italic tracking-tighter uppercase text-white leading-none">{selectedPersona.name}</h2>
                <div className="flex gap-3 mt-4">
                  <span className="text-[9px] px-4 py-1.5 bg-indigo-500/10 text-indigo-400 font-black uppercase tracking-widest border border-indigo-500/20 rounded-full">{selectedPersona.accent}</span>
                  <span className="text-[9px] px-4 py-1.5 bg-white/5 text-slate-500 font-black uppercase tracking-widest border border-white/5 rounded-full">Neural Engine v2.0</span>
                </div>
              </div>
            </div>

            <div className="glass px-8 py-4 rounded-[2rem] border-white/5 flex items-center gap-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Language:</span>
              <select 
                className="bg-transparent border-none focus:ring-0 text-xs font-black text-indigo-400 cursor-pointer outline-none" 
                value={selectedLang.code} 
                onChange={(e) => setSelectedLang(LANGUAGES.find(l => l.code === e.target.value)!)}
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.flag} {l.name}</option>)}
              </select>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            
            {/* LIVE INTERACTION HUB */}
            <div className="glass rounded-[4rem] p-12 border-white/5 relative overflow-hidden flex flex-col items-center justify-center min-h-[550px] shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent"></div>
              
              <div className="z-10 flex flex-col items-center text-center gap-12 w-full">
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-full blur-[80px] transition-all duration-1000 opacity-30 ${isAIspeaking ? 'bg-indigo-500 scale-125' : 'bg-indigo-900 scale-100'}`}></div>
                  <AudioVisualizer isActive={isAIspeaking || isLive} color={isAIspeaking ? '#818cf8' : '#4f46e5'} />
                </div>
                
                <div className="max-w-xs">
                  <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-3">{isLive ? 'Link Established' : 'System Standby'}</h3>
                  <p className="text-slate-500 text-[11px] font-bold leading-relaxed uppercase tracking-wide">
                    {isLive 
                      ? `Real-time neural sync active. Speak now in ${selectedLang.name}.` 
                      : `Adopt the vocal identity of ${selectedPersona.name} for persistent interaction.`}
                  </p>
                </div>

                <div className="flex gap-4">
                  {!isLive ? (
                    <button 
                      onClick={startLiveConversation} 
                      className="px-14 py-6 rounded-full voice-gradient text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:-translate-y-1 transition-all active:scale-95"
                    >
                      Establish Connection
                    </button>
                  ) : (
                    <button 
                      onClick={stopLiveConversation} 
                      className="px-14 py-6 rounded-full bg-red-600/90 text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:-translate-y-1 transition-all"
                    >
                      Sever Link
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="absolute bottom-10 left-10 right-10 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-[10px] font-black uppercase text-red-500 text-center animate-in slide-in-from-bottom duration-500">
                  <i className="fas fa-triangle-exclamation mr-2"></i> {error}
                </div>
              )}
            </div>

            {/* SYNTHESIS & GALLERY */}
            <div className="flex flex-col gap-10">
              
              <div className="glass rounded-[3rem] p-10 border-white/5 shadow-xl flex flex-col gap-8">
                <div className="flex items-center gap-4 text-slate-500">
                  <i className="fas fa-keyboard text-indigo-500"></i>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Synthesis Engine</span>
                </div>
                <textarea 
                  value={ttsText} 
                  onChange={(e) => setTtsText(e.target.value)} 
                  placeholder={`Type text to synthesize in ${selectedPersona.name}'s voice...`}
                  className="w-full bg-slate-900/50 border border-slate-800/50 rounded-3xl p-8 text-sm text-slate-300 min-h-[160px] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none placeholder:text-slate-700 font-medium"
                />
                <button 
                  onClick={synthesizeSpeech} 
                  disabled={isSynthesizing || !ttsText.trim()}
                  className="w-full py-6 rounded-2.5xl voice-gradient text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-xl disabled:opacity-20 transition-all hover:scale-[1.01] active:scale-98"
                >
                  {isSynthesizing ? <i className="fas fa-circle-notch animate-spin text-lg"></i> : 'Generate Neural Asset'}
                </button>
              </div>

              <div className="glass rounded-[3rem] p-10 border-white/5 shadow-xl flex-1 flex flex-col max-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4 text-slate-500">
                    <i className="fas fa-box-archive text-indigo-500"></i>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Asset Gallery</span>
                  </div>
                  <button onClick={() => setSynthesisGallery([])} className="text-[9px] font-black text-slate-600 hover:text-white uppercase tracking-widest">Wipe Cache</button>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar space-y-4 pr-2">
                  {synthesisGallery.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                      <i className="fas fa-folder-open text-4xl mb-4"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">No assets generated</p>
                    </div>
                  ) : (
                    synthesisGallery.map(g => (
                      <div key={g.id} className="group p-5 bg-white/[0.02] border border-white/5 rounded-2.5xl flex items-center justify-between hover:bg-white/[0.05] transition-all cursor-pointer">
                        <div className="flex-1 min-w-0 pr-6" onClick={() => playAudio(g.audioData)}>
                          <p className="text-[11px] font-bold text-white truncate mb-1 leading-relaxed">{g.text}</p>
                          <p className="text-[8px] text-indigo-400 font-black uppercase tracking-tighter">{g.personaName} • {new Date(g.timestamp).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => downloadAsset(g)}
                            className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700 transition-all"
                            title="Export WAV"
                          >
                            <i className="fas fa-download text-sm"></i>
                          </button>
                          <button 
                            onClick={() => playAudio(g.audioData)}
                            className="w-10 h-10 rounded-xl voice-gradient flex items-center justify-center text-white transition-all shadow-lg shadow-indigo-500/20"
                          >
                            <i className="fas fa-play text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TRANSMISSION LOG */}
          <div className="mt-12 glass rounded-[4rem] p-10 border-white/5 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-10 px-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 flex items-center gap-4">
                <i className="fas fa-terminal text-indigo-500"></i> Transmission Log
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></div>
                <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">{isLive ? 'Live Feed' : 'Offline'}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-8">
              {transcriptions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10 gap-8 grayscale">
                  <i className="fas fa-tower-broadcast text-6xl"></i>
                  <p className="text-[10px] font-black uppercase tracking-[1em] ml-[1em]">Scanning Signals</p>
                </div>
              ) : (
                transcriptions.map((t, idx) => (
                  <div key={idx} className={`flex ${t.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom duration-500`}>
                    <div className={`max-w-[70%] px-8 py-6 rounded-[2.5rem] text-sm font-medium leading-relaxed ${t.sender === 'user' ? 'bg-indigo-600/90 text-white rounded-tr-none shadow-2xl shadow-indigo-500/20' : 'bg-slate-800/80 text-slate-300 rounded-tl-none border border-white/5 shadow-xl'}`}>
                      <div className="flex items-center justify-between mb-3 opacity-50">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{t.sender === 'user' ? 'Local Transmitter' : selectedPersona.name}</span>
                        <span className="text-[8px] font-bold">{t.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {t.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </main>
      </div>
      
      {/* STATUS HUD */}
      <footer className="fixed bottom-10 right-10 z-50 pointer-events-none">
        <div className="glass px-8 py-4 rounded-full border-white/10 flex items-center gap-6 shadow-2xl backdrop-blur-3xl animate-in slide-in-from-right duration-700">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-indigo-500 shadow-[0_0_15px_#6366f1] animate-pulse' : 'bg-slate-600'}`}></div>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Neural.Link_{isLive ? 'Active' : 'Idle'}</span>
          </div>
          <div className="h-4 w-px bg-white/10"></div>
          <div className="flex items-center gap-3">
            <i className="fas fa-microchip text-[10px] text-indigo-500"></i>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">GPU_Compute_Stable</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-progress {
          animation: progress 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
