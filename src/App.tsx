import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import {
  Drama, Target, Sparkles, Download, RotateCcw,
  ChevronDown, Upload as UploadIcon, X, Loader2, Play, Pause, Volume2, VolumeX, AlertCircle, Plus, Music,
  Star, Mic, Copy, Trash2, User, Camera, Image as ImageIcon
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductionPath = 'seedance' | 'custom' | 'voice' | null

interface ReferencePack {
  id: string; name: string; type: string;
  face_front: string | null; face_3quarter: string | null; face_profile: string | null; face_additional: string[];
  fish_audio_voice_id: string | null; lock_prompt: string;
  face_influence: number; voice_influence: number; style_influence: number;
  age: string | null; gender: string | null; ethnicity: string | null; hair: string | null;
  skin_tone: string | null; distinguishing: string | null;
  is_default: boolean; times_used: number;
}

type VoiceOption = 'custom' | 'default' | 'none'

// ── Path definitions ───────────────────────────────────────────────────────────

const PATHS = [
  { id: 'seedance' as const, title: 'AI Influencer', subtitle: 'Seedance 2.0', description: '13 AI characters, bulk testing', timing: '~3min', cost: '~720 credits', icon: Drama },
  { id: 'custom' as const, title: 'Custom Character', subtitle: 'Fish Audio + OmniHuman', description: 'Use Jordan or upload any face', timing: '~5min', cost: '~$0.06', icon: Target },
]

const BRAIN_DUMP_PLACEHOLDERS: Record<string, string> = {
  seedance: '15 second testimonial ad. Young Australian guy, early 20s, on his apartment balcony at golden hour. Excited about replacing his income with Airbnb. Selfie cam, casual hoodie. Hook with the money result first, then quick backstory, then the shift moment. CTA to BNBSuccess.com.au.',
  custom: "15 second ad with Jordan talking about how you don't need to own property. Excited hook, then calm explanation, confident close. Result-first hook style. CTA to link in bio. Or use a custom face — 15 second student testimonial about making $5K in their first month. Warm, relatable tone. Curiosity hook.",
}

const SETTINGS = ['Modern apartment', 'Office / workspace', 'Coffee shop', 'Beach / outdoor', 'Studio (plain bg)', 'Luxury interior', 'Urban street', 'Gym / fitness']
const CAMERAS = ['Static medium shot', 'Slow zoom in', 'Slow zoom out', 'Pan left to right', 'Handheld / organic', 'Close-up face', 'Full body static']
const LIGHTING_OPTIONS = ['Natural daylight', 'Golden hour', 'Studio softbox', 'Ring light', 'Moody / low key', 'Bright & clean', 'Neon accent']
const EMOTIONS = ['Neutral', 'Excited', 'Confident', 'Empathetic', 'Urgent', 'Friendly', 'Professional', 'Inspirational', 'Casual', 'Serious']
const INFLUENCERS = ['Auto-select', 'jayden', 'mila', 'kai', 'priya', 'sofia', 'emma', 'finn', 'lena', 'marcus', 'nico', 'astrid', 'valentina', 'zara']

// ── Reusable Components ────────────────────────────────────────────────────────

function Dropdown({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-[#9CA3AF] font-medium">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm focus:border-[#2A7B88] cursor-pointer">
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
      </div>
    </div>
  )
}

function SliderControl({ label, min, max, step, value, onChange, suffix }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label className="text-sm text-[#9CA3AF] font-medium">{label}</label>
        <span className="text-sm text-[#D4A843] font-mono">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, #D4A843 0%, #D4A843 ${((value - min) / (max - min)) * 100}%, #1B2A4A ${((value - min) / (max - min)) * 100}%, #1B2A4A 100%)` }}
      />
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────

function App() {
  // Core state
  const [selectedPath, setSelectedPath] = useState<ProductionPath>(null)
  const [brainDump, setBrainDump] = useState('')
  const [claudeParams, setClaudeParams] = useState<Record<string, any> | null>(null)
  const [isFormulating, setIsFormulating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [chunkVideoUrls, setChunkVideoUrls] = useState<string[]>([])
  const [isFallback, setIsFallback] = useState(false)

  // Shared params
  const [script, setScript] = useState('')
  const [sceneAction, setSceneAction] = useState('')
  const [sceneContext, setSceneContext] = useState('')
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null)
  const [isUploadingRef, setIsUploadingRef] = useState(false)

  // Long-form state
  const [segments, setSegments] = useState<any>(null)
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [_markedScript, setMarkedScript] = useState('')
  void _markedScript // used for future display
  const [chunkStatuses, setChunkStatuses] = useState<string[]>([])

  // Seedance params
  const [age, setAge] = useState(28)
  const [gender, setGender] = useState<'female' | 'male'>('female')
  const [hair, setHair] = useState('')
  const [skin, setSkin] = useState('')
  const [wardrobe, setWardrobe] = useState('')
  const [setting, setSetting] = useState(SETTINGS[0])
  const [camera, setCamera] = useState(CAMERAS[0])
  const [lighting, setLighting] = useState(LIGHTING_OPTIONS[0])
  const [duration, setDuration] = useState(15)
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16')
  const [influencer, setInfluencer] = useState('Auto-select')
  const [realism, setRealism] = useState(true)

  // Voice params (custom path)
  const [emotion, setEmotion] = useState('Confident')
  const [voiceTemp, setVoiceTemp] = useState(0.7)
  const [voiceSpeed, setVoiceSpeed] = useState(1.0)

  // Character library state
  const [refPacks, setRefPacks] = useState<ReferencePack[]>([])
  const [selectedPack, setSelectedPack] = useState<ReferencePack | null>(null)
  const [isLoadingRefs, setIsLoadingRefs] = useState(false)
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<string | null>(null)
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false)

  // Character Creator/Editor modal state
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [editingPack, setEditingPack] = useState<ReferencePack | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalAge, setModalAge] = useState('')
  const [modalGender, setModalGender] = useState('male')
  const [modalEthnicity, setModalEthnicity] = useState('')
  const [modalHair, setModalHair] = useState('')
  const [modalSkinTone, setModalSkinTone] = useState('')
  const [modalDistinguishing, setModalDistinguishing] = useState('')
  const [modalFaceFront, setModalFaceFront] = useState<string | null>(null)
  const [modalFace3Quarter, setModalFace3Quarter] = useState<string | null>(null)
  const [modalFaceProfile, setModalFaceProfile] = useState<string | null>(null)
  const [modalFaceAdditional, setModalFaceAdditional] = useState<string[]>([])
  const [modalVoiceOption, setModalVoiceOption] = useState<VoiceOption>('default')
  const [modalVoiceId, setModalVoiceId] = useState('')
  const [modalLockPrompt, setModalLockPrompt] = useState('')
  const [modalFaceInfluence, setModalFaceInfluence] = useState(0.90)
  const [modalVoiceInfluence, setModalVoiceInfluence] = useState(0.80)
  const [modalStyleInfluence, setModalStyleInfluence] = useState(0.50)
  const [isUploadingModal, setIsUploadingModal] = useState<string | null>(null)
  const [isSavingCharacter, setIsSavingCharacter] = useState(false)
  const [isDraggingSlot, setIsDraggingSlot] = useState<string | null>(null)

  // Voice Only state
  const [voiceModels, setVoiceModels] = useState<any[]>([])
  const [selectedVoiceModel, setSelectedVoiceModel] = useState<any>(null)
  const [manualVoiceId, setManualVoiceId] = useState('')
  const [ttsAudio, setTtsAudio] = useState<string | null>(null)
  const [isGeneratingTts, setIsGeneratingTts] = useState(false)
  const [ttsFormat, setTtsFormat] = useState('mp3')
  const [ttsSampleRate, setTtsSampleRate] = useState(44100)
  const [ttsBitrate, setTtsBitrate] = useState(128)
  const [showAddVoice, setShowAddVoice] = useState(false)
  const [newVoiceName, setNewVoiceName] = useState('')
  const [newVoiceId, setNewVoiceId] = useState('')
  const [newVoiceDesc, setNewVoiceDesc] = useState('')

  // Video player
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Suppress unused import warnings - these are used in JSX below
  const _suppressUnused = { UploadIcon }
  void _suppressUnused

  useEffect(() => {
    setClaudeParams(null); setBrainDump(''); setScript(''); setVideoUrl(null); setChunkVideoUrls([]); setIsFallback(false); setError(''); setStatusText(''); setProgress(0); setIsGenerating(false); setSegments(null); setMarkedScript('')
    setSelectedPack(null)
  }, [selectedPath])

  useEffect(() => () => { pollRef.current = null }, [])

  // ── Load reference packs ────────────────────────────────────────────────────

  const loadRefPacks = useCallback(async () => {
    setIsLoadingRefs(true)
    try {
      const res = await fetch('/api/references?action=list')
      if (!res.ok) throw new Error('Failed to load reference packs')
      const data = await res.json()
      const packs: ReferencePack[] = Array.isArray(data) ? data : (data.packs || [])
      setRefPacks(packs)
      if (!selectedPack) {
        const defaultPack = packs.find((p) => p.is_default)
        if (defaultPack) setSelectedPack(defaultPack)
        else if (packs.length > 0) setSelectedPack(packs[0])
      }
    } catch (err: any) {
      console.error('Failed to load ref packs:', err.message)
    } finally {
      setIsLoadingRefs(false)
    }
  }, [selectedPack])

  useEffect(() => {
    if (selectedPath === 'custom') loadRefPacks()
  }, [selectedPath, loadRefPacks])

  // ── Load voice models for Voice Only path ────────────────────────────────
  useEffect(() => {
    if (selectedPath === 'voice') {
      fetch('/api/voice-models').then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          setVoiceModels(data)
          const def = data.find((m: any) => m.is_default)
          if (def && !selectedVoiceModel) setSelectedVoiceModel(def)
        }
      }).catch(() => {})
    }
  }, [selectedPath])

  // ── TTS generation (Voice Only path) ──────────────────────────────────────
  const handleGenerateTts = async () => {
    if (!script.trim()) return
    setIsGeneratingTts(true); setTtsAudio(null)
    try {
      const vid = selectedVoiceModel?.fish_audio_id || manualVoiceId || '14d07e89acda4214bd319865a7e1a888'
      const res = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, voiceId: vid, temperature: voiceTemp, topP: 0.7, speed: voiceSpeed, format: ttsFormat, sampleRate: ttsSampleRate, bitrate: ttsBitrate }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'TTS failed')
      const data = await res.json()
      setTtsAudio(data.audio)
    } catch (err: any) { setError(err.message) }
    finally { setIsGeneratingTts(false) }
  }

  // ── Save voice model ────────────────────────────────────────────────────────
  const handleSaveVoiceModel = async () => {
    if (!newVoiceName.trim() || !newVoiceId.trim()) return
    try {
      const res = await fetch('/api/voice-models', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVoiceName, fishAudioId: newVoiceId, description: newVoiceDesc }) })
      if (!res.ok) throw new Error('Save failed')
      const model = await res.json()
      setVoiceModels(prev => [...prev, model])
      setSelectedVoiceModel(model)
      setShowAddVoice(false); setNewVoiceName(''); setNewVoiceId(''); setNewVoiceDesc('')
    } catch (err: any) { setError(err.message) }
  }

  // ── Voice preview ───────────────────────────────────────────────────────────

  const handleVoicePreview = async (text?: string, voiceId?: string) => {
    const previewText = text || script
    if (!previewText.trim()) return
    setIsPreviewingVoice(true)
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: previewText.slice(0, 200), voiceId: voiceId || selectedPack?.fish_audio_voice_id, emotion: emotion.toLowerCase(), speed: voiceSpeed, temperature: voiceTemp }),
      })
      if (!res.ok) throw new Error('Preview failed')
      const data = await res.json()
      setVoicePreviewAudio(data.audio)
    } catch (err: any) { setError(err.message) }
    finally { setIsPreviewingVoice(false) }
  }

  // ── Character modal helpers ────────────────────────────────────────────────

  const generateLockPrompt = (name: string, genderVal: string, ageVal: string, ethnicity: string, hairVal: string, skinTone: string, distinguishing: string) => {
    const parts = [name, genderVal, ageVal, ethnicity, hairVal ? `${hairVal} hair` : '', skinTone ? `${skinTone} skin` : '', distinguishing].filter(Boolean)
    return `Same character as references: ${parts.join(', ')}. One consistent identity.`
  }

  const openCharacterModal = (pack?: ReferencePack) => {
    if (pack) {
      setEditingPack(pack)
      setModalName(pack.name || '')
      setModalAge(pack.age || '')
      setModalGender(pack.gender || 'male')
      setModalEthnicity(pack.ethnicity || '')
      setModalHair(pack.hair || '')
      setModalSkinTone(pack.skin_tone || '')
      setModalDistinguishing(pack.distinguishing || '')
      setModalFaceFront(pack.face_front)
      setModalFace3Quarter(pack.face_3quarter)
      setModalFaceProfile(pack.face_profile)
      setModalFaceAdditional(pack.face_additional || [])
      setModalVoiceOption(pack.fish_audio_voice_id ? 'custom' : 'default')
      setModalVoiceId(pack.fish_audio_voice_id || '')
      setModalLockPrompt(pack.lock_prompt || '')
      setModalFaceInfluence(pack.face_influence ?? 0.90)
      setModalVoiceInfluence(pack.voice_influence ?? 0.80)
      setModalStyleInfluence(pack.style_influence ?? 0.50)
    } else {
      setEditingPack(null)
      setModalName(''); setModalAge(''); setModalGender('male'); setModalEthnicity('')
      setModalHair(''); setModalSkinTone(''); setModalDistinguishing('')
      setModalFaceFront(null); setModalFace3Quarter(null); setModalFaceProfile(null); setModalFaceAdditional([])
      setModalVoiceOption('default'); setModalVoiceId('')
      setModalLockPrompt(''); setModalFaceInfluence(0.90); setModalVoiceInfluence(0.80); setModalStyleInfluence(0.50)
    }
    setShowCharacterModal(true)
  }

  const handleModalUpload = async (file: File, slot: string) => {
    setIsUploadingModal(slot)
    try {
      const reader = new FileReader()
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/references?action=upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataUri, speaker: modalName || 'character', filename: `${slot}-${Date.now()}.${file.name.split('.').pop()}` }),
      })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()
      if (slot === 'front') setModalFaceFront(url)
      else if (slot === '3quarter') setModalFace3Quarter(url)
      else if (slot === 'profile') setModalFaceProfile(url)
      else if (slot === 'additional') setModalFaceAdditional(prev => [...prev, url])
    } catch (err: any) { setError(err.message) }
    finally { setIsUploadingModal(null) }
  }

  const handleSaveCharacter = async () => {
    if (!modalName.trim()) return
    setIsSavingCharacter(true)
    try {
      const payload = {
        name: modalName, age: modalAge || null, gender: modalGender, ethnicity: modalEthnicity || null,
        hair: modalHair || null, skin_tone: modalSkinTone || null, distinguishing: modalDistinguishing || null,
        face_front: modalFaceFront, face_3quarter: modalFace3Quarter, face_profile: modalFaceProfile,
        face_additional: modalFaceAdditional,
        fish_audio_voice_id: modalVoiceOption === 'custom' ? modalVoiceId : null,
        lock_prompt: modalLockPrompt || generateLockPrompt(modalName, modalGender, modalAge, modalEthnicity, modalHair, modalSkinTone, modalDistinguishing),
        face_influence: modalFaceInfluence, voice_influence: modalVoiceInfluence, style_influence: modalStyleInfluence,
      }
      if (editingPack) {
        const res = await fetch('/api/references?action=update', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPack.id, ...payload }),
        })
        if (!res.ok) throw new Error('Update failed')
      } else {
        const res = await fetch('/api/references?action=create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Create failed')
      }
      setShowCharacterModal(false)
      loadRefPacks()
    } catch (err: any) { setError(err.message) }
    finally { setIsSavingCharacter(false) }
  }

  const handleDuplicatePack = async (pack: ReferencePack) => {
    try {
      const res = await fetch('/api/references?action=duplicate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pack.id }),
      })
      if (!res.ok) throw new Error('Duplicate failed')
      loadRefPacks()
    } catch (err: any) { setError(err.message) }
  }

  const handleDeletePack = async (pack: ReferencePack) => {
    if (pack.is_default) { setError('Cannot delete the default character.'); return }
    if (!window.confirm(`Delete "${pack.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch('/api/references?action=delete', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pack.id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      if (selectedPack?.id === pack.id) setSelectedPack(null)
      loadRefPacks()
    } catch (err: any) { setError(err.message) }
  }

  // ── Formulate: Brain dump -> Claude -> parameters ────────────────────────────

  const handleFormulate = async () => {
    if (!selectedPath || !brainDump.trim()) return
    setIsFormulating(true)
    setError('')
    try {
      const interpretPath = selectedPath === 'custom' ? 'fal' : selectedPath
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: interpretPath, brainDump }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.error || `API error ${res.status}`)
      }
      const data = await res.json()
      setClaudeParams(data)

      if (selectedPath === 'seedance') {
        if (data.script?.dialogue) setScript(data.script.dialogue)
        if (data.character?.age) {
          const ageMatch = String(data.character.age).match(/\d+/)
          if (ageMatch) setAge(parseInt(ageMatch[0]))
        }
        if (data.character?.gender) setGender(data.character.gender.toLowerCase().includes('male') && !data.character.gender.toLowerCase().includes('female') ? 'male' : 'female')
        if (data.character?.hair) setHair(data.character.hair)
        if (data.character?.skinTone) setSkin(data.character.skinTone)
        if (data.character?.wardrobe) setWardrobe(data.character.wardrobe)
        if (data.setting?.location) {
          const match = SETTINGS.find(s => s.toLowerCase().includes(data.setting.location.toLowerCase().split(' ')[0]))
          if (match) setSetting(match)
        }
        if (data.camera?.movement) {
          const match = CAMERAS.find(c => c.toLowerCase().includes(data.camera.movement.toLowerCase().split(' ')[0]))
          if (match) setCamera(match)
        }
        if (data.lighting?.source) {
          const match = LIGHTING_OPTIONS.find(l => l.toLowerCase().includes(data.lighting.source.toLowerCase().split(' ')[0]))
          if (match) setLighting(match)
        }
        if (data.apiParams?.duration) setDuration(data.apiParams.duration)
        if (data.apiParams?.aspectRatio) setAspectRatio(data.apiParams.aspectRatio)
        if (data.influencer?.suggested) setInfluencer(data.influencer.suggested)
      } else {
        if (data.script?.dialogue) setScript(data.script.dialogue)
        else if (data.script?.dialogueTagged) setScript(data.script.dialogueTagged)
        if (data.voice?.emotionTags?.[0]) {
          const match = EMOTIONS.find(e => e.toLowerCase() === data.voice.emotionTags[0].toLowerCase())
          if (match) setEmotion(match)
        }
        if (data.voice?.temperature !== undefined) setVoiceTemp(data.voice.temperature)
        if (data.voice?.speed !== undefined) setVoiceSpeed(data.voice.speed)
      }
      // Scene (both paths)
      if (data.scene?.action) setSceneAction(data.scene.action)
      if (data.scene?.context) setSceneContext(data.scene.context)
    } catch (err: any) {
      setError(err.message || 'Failed to formulate parameters')
    } finally {
      setIsFormulating(false)
    }
  }

  // ── Build the nested params the API expects ────────────────────────────────

  const buildApiParams = useCallback((): Record<string, any> => {
    // Scene (shared across both paths)
    const sceneData = (sceneAction || sceneContext) ? { action: sceneAction, context: sceneContext } : undefined

    if (selectedPath === 'seedance') {
      return {
        script: { dialogue: script },
        scene: sceneData,
        character: { age: `${age}`, gender, hair, skinTone: skin, wardrobe },
        setting: { location: setting, timeOfDay: lighting.includes('Golden') ? 'golden hour' : 'day' },
        camera: { angle: camera.toLowerCase().includes('handheld') ? 'casual handheld selfie angle' : camera, movement: camera, device: 'smartphone' },
        lighting: { source: lighting, quality: 'soft' },
        realism: realism ? {
          skinCues: 'visible pores, slight unevenness in skin tone, faint undereye shadows, hint of natural oils',
          cameraFlaws: 'slight motion blur, minor lens distortion, micro-jitter, soft focus edges, subtle grain',
          motionCues: ['breaks eye contact briefly', 'subtle head tilt', 'shifts weight', 'natural hand gesture'],
        } : {},
        apiParams: { model: 'seedance-2.0', duration, aspectRatio, resolution: '720p', audioEnabled: true },
        influencer: { suggested: influencer === 'Auto-select' ? 'jayden' : influencer },
        ...(refImageUrl ? { referenceImageUrl: refImageUrl } : {}),
      }
    }
    // custom path
    return {
      packId: selectedPack?.id,
      script: { dialogue: script, dialogueTagged: `[${emotion.toLowerCase()}] ${script}` },
      scene: sceneData,
      voice: { emotionTags: [emotion.toLowerCase()], temperature: voiceTemp, speed: voiceSpeed },
      setting: { location: 'Casual indoor setting', timeOfDay: 'natural light' },
      apiParams: { duration: 15, aspectRatio: '9:16', resolution: '720p' },
    }
  }, [selectedPath, script, sceneAction, sceneContext, age, gender, hair, skin, wardrobe, setting, camera, lighting, duration, aspectRatio, influencer, realism, emotion, voiceTemp, voiceSpeed, selectedPack, refImageUrl])

  // ── Script duration estimation ─────────────────────────────────────────────

  const cleanScript = script.replace(/\[.*?\]\s*/g, '')
  const scriptWordCount = cleanScript.split(/\s+/).filter(Boolean).length
  const estDurationSec = Math.round((scriptWordCount / 150) * 60)
  const isLongForm = estDurationSec > 15 || scriptWordCount > 45

  // ── Segment long scripts ──────────────────────────────────────────────────

  const handleSegment = async () => {
    if (!script.trim() || !isLongForm) return
    setIsSegmenting(true)
    setError('')
    try {
      const res = await fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, path: selectedPath, parameters: buildApiParams() }),
      })
      if (!res.ok) throw new Error('Segmentation failed')
      const data = await res.json()
      setSegments(data)
      setMarkedScript(data.markedScript || '')
    } catch (err: any) { setError(err.message) }
    finally { setIsSegmenting(false) }
  }

  // ── Generate video (short-form or long-form) ──────────────────────────────

  const handleGenerate = async () => {
    if (!selectedPath || !script.trim()) return

    setIsGenerating(true)
    setError('')
    setVideoUrl(null)
    setChunkVideoUrls([])
    setIsFallback(false)

    // Long-form: auto-segment if not already done
    let activeSegments = segments
    if (isLongForm && !activeSegments) {
      const estChunks = Math.ceil(estDurationSec / 13)
      setStatusText(`Long script detected — splitting into ${estChunks} chunks...`)
      setProgress(2)
      try {
        const res = await fetch('/api/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script, path: selectedPath, parameters: buildApiParams() }),
        })
        if (!res.ok) throw new Error('Segmentation failed')
        const data = await res.json()
        setSegments(data)
        setMarkedScript(data.markedScript || '')
        activeSegments = data
      } catch (err: any) {
        setError(err.message)
        setIsGenerating(false)
        setStatusText('')
        return
      }
    }

    setStatusText('Submitting job...')
    setProgress(5)

    try {
      const params = buildApiParams()

      // Long-form: generate chunks sequentially with auto-retry on moderation failure
      if (isLongForm && activeSegments?.chunks?.length > 1) {
        const totalChunks = activeSegments.chunks.length
        const collectedUrls: string[] = []
        setStatusText(`Long script detected — splitting into ${totalChunks} chunks`)
        setChunkStatuses(Array(totalChunks).fill('pending'))

        // Helper: generate one chunk with up to 3 retries on moderation failure
        const generateOneChunk = async (chunkIdx: number, attempt = 1): Promise<string> => {
          const MAX_ATTEMPTS = 3
          const chunk = activeSegments!.chunks[chunkIdx]
          const dur = Math.max(4, Math.min(15, Math.round(chunk.durationSec || 10)))
          const chunkParams = {
            ...params,
            script: { dialogue: chunk.scriptText },
            continuityNote: chunk.continuityNote || '',
            apiParams: { ...params.apiParams, duration: dur },
          }

          const useCustom = attempt <= MAX_ATTEMPTS && selectedPath === 'custom'
          const genPath = useCustom ? 'custom' : 'seedance'
          const genParams = useCustom ? chunkParams : { ...chunkParams, packId: undefined }

          if (attempt > 1) setStatusText(`Generating clip ${chunkIdx + 1} of ${totalChunks} — retry ${attempt}...`)

          const res = await fetch('/api/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: genPath, parameters: genParams }),
          })
          if (!res.ok) throw new Error(`Chunk ${chunkIdx + 1} submit failed`)
          const { assetId } = await res.json()
          if (!assetId) throw new Error(`Chunk ${chunkIdx + 1} no assetId`)

          // Poll
          for (let poll = 0; poll < 120; poll++) {
            await new Promise(r => setTimeout(r, 5000))
            const elapsed = poll * 5
            setStatusText(`Generating clip ${chunkIdx + 1} of ${totalChunks}... (${elapsed}s)${attempt > 1 ? ` [retry ${attempt}]` : ''}`)
            try {
              const s = await fetch(`/api/status?assetId=${assetId}`).then(r => r.json())
              if (s.status === 'complete' && s.videoUrl) return s.videoUrl
              if (s.status === 'failed') {
                const err = s.error || ''
                if ((err.includes('likenesses') || err.includes('image_urls'))) {
                  if (attempt < MAX_ATTEMPTS + 1) {
                    setStatusText(`Clip ${chunkIdx + 1} blocked — retrying (${attempt}/${MAX_ATTEMPTS})...`)
                    return generateOneChunk(chunkIdx, attempt + 1)
                  }
                }
                throw new Error(`Chunk ${chunkIdx + 1}: ${err}`)
              }
            } catch (e: any) {
              if (e.message?.includes('Chunk')) throw e
            }
          }
          throw new Error(`Chunk ${chunkIdx + 1} timeout`)
        }

        for (let i = 0; i < totalChunks; i++) {
          setStatusText(`Generating clip ${i + 1} of ${totalChunks}...`)
          setProgress(10 + Math.round((i / totalChunks) * 70))
          setChunkStatuses(prev => prev.map((s, idx) => idx === i ? 'generating' : s))
          try {
            const url = await generateOneChunk(i, 1)
            collectedUrls.push(url)
            setChunkStatuses(prev => prev.map((s, idx) => idx === i ? 'done' : s))
          } catch (err) {
            setChunkStatuses(prev => prev.map((s, idx) => idx === i ? 'error' : s))
            throw err
          }
        }

        // Stitch all chunks together via API
        setStatusText(`Stitching ${totalChunks} clips together...`)
        setProgress(85)

        try {
          const stitchRes = await fetch('/api/stitch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrls: collectedUrls, chunks: activeSegments.chunks }),
          })
          if (stitchRes.ok) {
            const stitchData = await stitchRes.json()
            if (stitchData.videoUrl) {
              setVideoUrl(stitchData.videoUrl)
              if (stitchData.fallback) {
                setChunkVideoUrls(stitchData.allChunks || collectedUrls)
                setIsFallback(true)
                setStatusText(`${totalChunks} chunks ready (stitching unavailable)`)
              } else {
                setStatusText('Done — stitched!')
              }
              setProgress(100)
              setIsGenerating(false)
              return
            }
          }
        } catch (_stitchErr) {
          // Stitch failed — fall through to fallback
        }

        // Fallback: stitching unavailable, show all chunk videos
        setVideoUrl(collectedUrls[0])
        setChunkVideoUrls(collectedUrls)
        setIsFallback(true)
        setStatusText(`${totalChunks} chunks ready (stitching unavailable)`)
        setProgress(100)
        setIsGenerating(false)
        return
      }

      // Short-form: normal single clip flow
      setStatusText('Starting generation...')
      setProgress(10)

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, parameters: params }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.error || `Generate failed: ${res.status}`)
      }

      const genCt = res.headers.get('content-type') || ''
      if (!genCt.includes('application/json')) throw new Error(`Generate returned non-JSON response (${res.status})`)
      const genResult = await res.json()
      if (genResult.error) throw new Error(genResult.error)

      setStatusText('Generating with Seedance 2.0...')
      setProgress(20)

      const assetId = genResult.assetId
      if (!assetId) throw new Error('No assetId returned')

      const MAX_POLLS = 120 // 120 × 5s = 10 min max
      const getDynamicStatus = (count: number) => {
        if (count <= 6) return 'Starting generation...'
        if (count <= 18) return 'Generating with Seedance 2.0... (3-5 min)'
        if (count <= 36) return 'Still rendering... almost there'
        return 'Taking longer than usual...'
      }
      setStatusText('Starting generation...')
      // Mark polling active (non-null sentinel); handleReset sets this to null to cancel
      pollRef.current = 1 as unknown as ReturnType<typeof setInterval>

      for (let pollCount = 1; pollCount <= MAX_POLLS; pollCount++) {
        await new Promise(r => setTimeout(r, 5000))
        if (pollRef.current === null) return  // cancelled by reset
        try {
          const statusRes = await fetch(`/api/status?assetId=${assetId}`)
          if (!statusRes.ok) continue
          const statusCt = statusRes.headers.get('content-type') || ''
          if (!statusCt.includes('application/json')) continue
          const statusData = await statusRes.json()
          if (statusData.status === 'complete' && statusData.videoUrl) {
            pollRef.current = null
            setVideoUrl(statusData.videoUrl)
            setStatusText('Complete!')
            setProgress(100)
            setIsGenerating(false)
            return
          }
          if (statusData.status === 'failed' || statusData.status === 'error') {
            pollRef.current = null
            setError(statusData.error || 'Generation failed')
            setIsGenerating(false)
            return
          }
          const newProgress = Math.min(20 + pollCount * 3, 90)
          setProgress(newProgress)
          setStatusText(getDynamicStatus(pollCount))
        } catch {
          // Keep polling on network errors
        }
      }
      pollRef.current = null
      setError('Generation timed out after 10 minutes. Please try again.')
      setIsGenerating(false)
    } catch (err: any) {
      setError(err.message || 'Generation failed')
      setIsGenerating(false)
      setStatusText('')
    }
  }

  const handleReset = () => {
    setVideoUrl(null); setChunkVideoUrls([]); setIsFallback(false); setClaudeParams(null); setBrainDump(''); setScript(''); setError(''); setStatusText(''); setProgress(0); setIsGenerating(false); setSegments(null); setMarkedScript(''); setChunkStatuses([])
    pollRef.current = null
  }

  const creditEstimate = selectedPath === 'seedance' ? `~${Math.round(duration * 48)} credits` : '~$0.06 total'

  // ── Shared: Scene + Reference Photo (used by both paths) ─────────────────

  const handleRefImageUpload = async (file: File) => {
    setIsUploadingRef(true)
    try {
      const reader = new FileReader()
      const dataUri = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(file) })
      const res = await fetch('/api/references?action=upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataUri, filename: `ref-${Date.now()}.${file.name.split('.').pop()}` }) })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()
      setRefImageUrl(url)
    } catch (err: any) { setError(err.message) }
    finally { setIsUploadingRef(false) }
  }

  const renderSceneAndRefFields = () => (
    <>
      {/* Scene / Visual Context */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Scene / Visual Context</h4>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#9CA3AF]">What is the person doing? (separate from what they say)</label>
          <input type="text" value={sceneAction} onChange={(e) => setSceneAction(e.target.value)}
            placeholder="e.g. walks through a modern Airbnb apartment, sits on balcony overlooking city"
            className="bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#2A7B88]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#9CA3AF]">Visual context / story (optional)</label>
          <input type="text" value={sceneContext} onChange={(e) => setSceneContext(e.target.value)}
            placeholder="e.g. showing off their first Airbnb property, morning routine before day job"
            className="bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#2A7B88]" />
        </div>
      </div>

      {/* Reference Photo */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Reference Photo (optional)</h4>
        <p className="text-xs text-[#9CA3AF]/60">Upload a photo for Seedance to use as visual reference — face, style, or setting.</p>
        {refImageUrl ? (
          <div className="flex items-center gap-3">
            <img src={refImageUrl} alt="Reference" className="w-16 h-16 rounded-lg object-cover border border-[#2A7B88]/30" />
            <span className="text-xs text-[#10B981]">Uploaded</span>
            <button onClick={() => setRefImageUrl(null)} className="text-xs text-red-400/60 hover:text-red-400 ml-auto">Remove</button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[#D4A843]', 'bg-[#D4A843]/5') }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('border-[#D4A843]', 'bg-[#D4A843]/5') }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-[#D4A843]', 'bg-[#D4A843]/5'); const file = e.dataTransfer.files[0]; if (file?.type.startsWith('image/')) handleRefImageUpload(file) }}
            onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/heic'; i.onchange = () => { if (i.files?.[0]) handleRefImageUpload(i.files[0]) }; i.click() }}
            className="border-2 border-dashed border-[#2A7B88]/30 hover:border-[#D4A843] rounded-xl p-6 text-center cursor-pointer transition-all">
            {isUploadingRef ? (
              <div className="flex items-center justify-center gap-2 text-[#D4A843]"><Loader2 className="w-4 h-4 animate-spin" />Uploading...</div>
            ) : (
              <><UploadIcon className="w-5 h-5 text-[#9CA3AF]/60 mx-auto mb-1" /><p className="text-xs text-[#9CA3AF]">Drag & drop or click to upload</p><p className="text-[10px] text-[#9CA3AF]/40 mt-1">JPG, JPEG, PNG, WebP, HEIC</p></>
            )}
          </div>
        )}
      </div>
    </>
  )

  // ── Render: Seedance parameters ────────────────────────────────────────────

  const renderSeedanceParams = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#9CA3AF] font-medium">Script / Narration</label>
        <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={4}
          className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm resize-none focus:border-[#2A7B88]"
          placeholder="The narration or action description..." />
        {script && <p className="text-xs text-[#9CA3AF]/60">{script.split(/\s+/).length} words ~{Math.round(script.split(/\s+/).length / 2.5)}s at natural pace</p>}
      </div>
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Character</h4>
        <div className="grid grid-cols-2 gap-4">
          <SliderControl label="Age" min={18} max={65} step={1} value={age} onChange={setAge} suffix=" yrs" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#9CA3AF] font-medium">Gender</label>
            <div className="flex gap-2">
              {(['female', 'male'] as const).map((g) => (
                <button key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${gender === g ? 'bg-[#D4A843] text-[#111827]' : 'bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88]'}`}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[['Hair', hair, setHair, 'e.g. long brunette'], ['Skin', skin, setSkin, 'e.g. olive, tan'], ['Wardrobe', wardrobe, setWardrobe, 'e.g. casual hoodie']].map(([label, val, setter, ph]) => (
            <div key={label as string} className="flex flex-col gap-1.5">
              <label className="text-sm text-[#9CA3AF] font-medium">{label as string}</label>
              <input type="text" value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder={ph as string}
                className="bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#2A7B88]" />
            </div>
          ))}
        </div>
      </div>
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Scene</h4>
        <div className="grid grid-cols-3 gap-4">
          <Dropdown label="Setting" options={SETTINGS} value={setting} onChange={setSetting} />
          <Dropdown label="Camera" options={CAMERAS} value={camera} onChange={setCamera} />
          <Dropdown label="Lighting" options={LIGHTING_OPTIONS} value={lighting} onChange={setLighting} />
        </div>
      </div>
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Output</h4>
        <div className="grid grid-cols-3 gap-4">
          <SliderControl label="Duration" min={4} max={15} step={1} value={duration} onChange={setDuration} suffix="s" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#9CA3AF] font-medium">Aspect Ratio</label>
            <div className="flex gap-2">
              {(['9:16', '16:9'] as const).map((r) => (
                <button key={r} onClick={() => setAspectRatio(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${aspectRatio === r ? 'bg-[#D4A843] text-[#111827]' : 'bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Dropdown label="Influencer" options={INFLUENCERS} value={influencer} onChange={setInfluencer} />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[#9CA3AF] font-medium">High Realism</label>
          <button onClick={() => setRealism(!realism)}
            className={`relative w-11 h-6 rounded-full transition-all ${realism ? 'bg-[#D4A843]' : 'bg-[#1B2A4A] border border-[#2A7B88]/30'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${realism ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {renderSceneAndRefFields()}
    </div>
  )

  // ── Render: Custom params (after character selected + formulate) ──

  const renderCustomParams = () => (
    <div className="space-y-6">
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Voice</h4>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#9CA3AF] font-medium">Emotion</label>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
              <button key={e} onClick={() => setEmotion(e)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${emotion === e ? 'bg-[#D4A843] text-[#111827]' : 'bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88]'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <SliderControl label="Temperature" min={0} max={1} step={0.05} value={voiceTemp} onChange={setVoiceTemp} />
          <SliderControl label="Speed" min={0.5} max={2.0} step={0.05} value={voiceSpeed} onChange={setVoiceSpeed} suffix="x" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleVoicePreview()} disabled={!script.trim() || isPreviewingVoice}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${script.trim() && !isPreviewingVoice ? 'bg-[#2A7B88]/20 text-[#2A7B88] border border-[#2A7B88]/30 hover:bg-[#2A7B88]/30' : 'bg-[#111827] text-[#9CA3AF]/30 cursor-not-allowed'}`}>
            {isPreviewingVoice ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</> : <><Music className="w-3.5 h-3.5" />Preview Voice</>}
          </button>
          {voicePreviewAudio && <audio controls src={voicePreviewAudio} className="h-8 flex-1" style={{ maxWidth: '280px' }} />}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#9CA3AF] font-medium">Script</label>
        <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={5}
          className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm resize-none focus:border-[#2A7B88]"
          placeholder="Your ad script..." />
        {script && <p className="text-xs text-[#9CA3AF]/60">{script.replace(/\[.*?\]\s*/g, '').split(/\s+/).length} words</p>}
      </div>
      {script.trim() && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#9CA3AF] font-medium">Tagged Preview</label>
          <div className="bg-[#111827] border border-[#2A7B88]/15 rounded-lg p-3 text-sm text-[#E5E7EB] leading-relaxed">
            <span className="inline-block bg-[#2A7B88]/20 text-[#2A7B88] text-xs font-mono px-1.5 py-0.5 rounded mr-2">[{emotion.toLowerCase()}]</span>
            {script.replace(/\[.*?\]\s*/g, '')}
          </div>
        </div>
      )}

      {renderSceneAndRefFields()}
    </div>
  )

  // ── Character Library Grid ──────────────────────────────────────────────────

  const countFaces = (pack: ReferencePack) => {
    let count = 0
    if (pack.face_front) count++
    if (pack.face_3quarter) count++
    if (pack.face_profile) count++
    count += (pack.face_additional || []).length
    return count
  }

  const renderCharacterLibrary = () => (
    <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">Character Library</h2>
      </div>
      {isLoadingRefs ? (
        <div className="flex items-center justify-center py-8 text-[#9CA3AF]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading characters...
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {refPacks.map((pack) => {
            const isActive = selectedPack?.id === pack.id
            const faceCount = countFaces(pack)
            return (
              <button key={pack.id} onClick={() => setSelectedPack(isActive ? null : pack)}
                className={`relative flex flex-col items-center text-center rounded-xl p-4 border-2 transition-all ${isActive ? 'bg-[#1B2A4A] border-[#D4A843] shadow-lg shadow-[#D4A843]/10' : 'bg-[#1B2A4A] border-[#2A7B88]/20 hover:border-[#2A7B88]/50'}`}>
                <div className="w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-[#2A7B88]/20 bg-[#0D1117] flex items-center justify-center shrink-0">
                  {pack.face_front ? (
                    <img src={pack.face_front} alt={pack.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-[#9CA3AF]/30" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className={`text-sm font-bold truncate ${isActive ? 'text-[#D4A843]' : 'text-[#E5E7EB]'}`}>{pack.name}</p>
                  {pack.is_default && <Star className="w-3.5 h-3.5 text-[#D4A843] fill-[#D4A843] shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]/60">
                  <Mic className={`w-3 h-3 ${pack.fish_audio_voice_id ? 'text-[#10B981]' : 'text-[#9CA3AF]/30'}`} />
                  <span>{faceCount} photo{faceCount !== 1 ? 's' : ''}</span>
                </div>
              </button>
            )
          })}
          <button onClick={() => openCharacterModal()}
            className="flex flex-col items-center justify-center text-center rounded-xl p-4 border-2 border-dashed border-[#374151] hover:border-[#D4A843] transition-all group min-h-[160px]">
            <div className="w-20 h-20 rounded-full mb-3 border-2 border-dashed border-[#374151] group-hover:border-[#D4A843] flex items-center justify-center transition-all">
              <Plus className="w-8 h-8 text-[#374151] group-hover:text-[#D4A843] transition-colors" />
            </div>
            <p className="text-sm font-semibold text-[#374151] group-hover:text-[#D4A843] transition-colors">Create New</p>
          </button>
        </div>
      )}
      {selectedPack && (
        <div className="mt-4 bg-[#111827] rounded-xl p-4 border border-[#2A7B88]/20 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#9CA3AF] font-medium shrink-0">Face refs:</label>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              {[
                { url: selectedPack.face_front, label: 'Front' },
                { url: selectedPack.face_3quarter, label: '3/4' },
                { url: selectedPack.face_profile, label: 'Profile' },
              ].filter(f => f.url).map((face, idx) => (
                <div key={idx} className="shrink-0 text-center">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-[#2A7B88]/20">
                    <img src={face.url!} alt={face.label} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] text-[#9CA3AF]/50 mt-0.5">{face.label}</p>
                </div>
              ))}
              {!selectedPack.face_front && !selectedPack.face_3quarter && !selectedPack.face_profile && (
                <p className="text-xs text-[#9CA3AF]/40 italic">No face references uploaded</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
            {selectedPack.fish_audio_voice_id ? (
              <span className="flex items-center gap-1.5"><Mic className="w-3 h-3 text-[#10B981]" />Fish Audio &middot; {selectedPack.fish_audio_voice_id.slice(0, 8)}...</span>
            ) : (
              <span className="flex items-center gap-1.5"><Mic className="w-3 h-3 text-[#9CA3AF]/30" />No voice clone</span>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => openCharacterModal(selectedPack)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2A7B88]/20 text-[#2A7B88] border border-[#2A7B88]/30 hover:bg-[#2A7B88]/30 transition-all">
              <Camera className="w-3 h-3" />Edit
            </button>
            <button onClick={() => handleDuplicatePack(selectedPack)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/20 hover:border-[#2A7B88]/50 transition-all">
              <Copy className="w-3 h-3" />Duplicate
            </button>
            <button onClick={() => handleDeletePack(selectedPack)} disabled={selectedPack.is_default}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedPack.is_default ? 'bg-[#111827] text-[#9CA3AF]/20 cursor-not-allowed' : 'bg-[#111827] text-red-400/70 border border-red-500/20 hover:border-red-500/40 hover:text-red-400'}`}>
              <Trash2 className="w-3 h-3" />Delete
            </button>
          </div>
        </div>
      )}
    </section>
  )

  // ── Voice Only Path ─────────────────────────────────────────────────────────

  const insertEmotionTag = (tag: string) => {
    const ta = document.getElementById('voice-script') as HTMLTextAreaElement
    if (!ta) return
    const start = ta.selectionStart; const end = ta.selectionEnd
    const newText = script.slice(0, start) + `[${tag}] ` + script.slice(end)
    setScript(newText)
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + tag.length + 3; ta.focus() }, 0)
  }

  const renderVoicePath = () => (
    <div className="space-y-6">
      {/* Voice Model Selector */}
      <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">Voice Model</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {voiceModels.map((m: any) => (
            <button key={m.id} onClick={() => { setSelectedVoiceModel(m); setManualVoiceId('') }}
              className={`text-left rounded-xl p-4 border transition-all ${selectedVoiceModel?.id === m.id ? 'bg-[#1B2A4A] border-[#D4A843]/60' : 'bg-[#1B2A4A]/60 border-[#2A7B88]/20 hover:border-[#2A7B88]/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Music className={`w-4 h-4 ${selectedVoiceModel?.id === m.id ? 'text-[#D4A843]' : 'text-[#2A7B88]'}`} />
                <span className={`text-sm font-medium ${selectedVoiceModel?.id === m.id ? 'text-[#D4A843]' : 'text-[#E5E7EB]'}`}>{m.name}</span>
                {m.is_default && <span className="text-[8px] bg-[#D4A843]/20 text-[#D4A843] px-1.5 py-0.5 rounded-full">DEFAULT</span>}
              </div>
              <p className="text-[10px] text-[#9CA3AF]/60 font-mono">{m.fish_audio_id.slice(0, 16)}...</p>
            </button>
          ))}
          {/* Add New */}
          <button onClick={() => setShowAddVoice(!showAddVoice)}
            className="rounded-xl p-4 border border-dashed border-[#2A7B88]/30 hover:border-[#D4A843] flex flex-col items-center justify-center gap-1 text-[#9CA3AF] hover:text-[#D4A843] transition-all">
            <Plus className="w-5 h-5" /><span className="text-xs">Add New</span>
          </button>
          {/* Manual ID */}
          <div className="rounded-xl p-4 border border-[#2A7B88]/20 bg-[#1B2A4A]/40">
            <label className="text-[10px] text-[#9CA3AF] uppercase mb-1 block">Manual Voice ID</label>
            <input type="text" value={manualVoiceId} onChange={(e) => { setManualVoiceId(e.target.value); setSelectedVoiceModel(null) }}
              placeholder="Paste Fish Audio ID"
              className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded px-2 py-1.5 text-[#E5E7EB] text-xs focus:border-[#D4A843]" />
          </div>
        </div>
        {/* Add New form */}
        {showAddVoice && (
          <div className="bg-[#111827] rounded-lg p-4 border border-[#2A7B88]/20 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-[#9CA3AF]">Name</label>
                <input type="text" value={newVoiceName} onChange={(e) => setNewVoiceName(e.target.value)} placeholder="e.g. Stan"
                  className="w-full mt-1 bg-[#0D1117] border border-[#2A7B88]/30 rounded px-2.5 py-1.5 text-[#E5E7EB] text-sm focus:border-[#D4A843]" /></div>
              <div><label className="text-xs text-[#9CA3AF]">Fish Audio ID</label>
                <input type="text" value={newVoiceId} onChange={(e) => setNewVoiceId(e.target.value)} placeholder="Paste ID from Fish Audio"
                  className="w-full mt-1 bg-[#0D1117] border border-[#2A7B88]/30 rounded px-2.5 py-1.5 text-[#E5E7EB] text-sm focus:border-[#D4A843]" /></div>
            </div>
            <div><label className="text-xs text-[#9CA3AF]">Description (optional)</label>
              <input type="text" value={newVoiceDesc} onChange={(e) => setNewVoiceDesc(e.target.value)} placeholder="e.g. Cloned from Stan's recordings"
                className="w-full mt-1 bg-[#0D1117] border border-[#2A7B88]/30 rounded px-2.5 py-1.5 text-[#E5E7EB] text-sm focus:border-[#D4A843]" /></div>
            <div className="flex gap-2">
              <button onClick={handleSaveVoiceModel} disabled={!newVoiceName.trim() || !newVoiceId.trim()}
                className="px-4 py-1.5 rounded text-sm font-semibold bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 disabled:opacity-40">Save</button>
              <button onClick={() => { setShowAddVoice(false); setNewVoiceName(''); setNewVoiceId(''); setNewVoiceDesc('') }}
                className="px-4 py-1.5 rounded text-sm text-[#9CA3AF] border border-[#374151] hover:border-[#2A7B88]">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Script + Emotion Tags */}
      <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">Script</h2>
        <textarea id="voice-script" value={script} onChange={(e) => setScript(e.target.value)} rows={6}
          placeholder="[excited] I made twenty three thousand dollars last month. [casual] I work a normal job. [confident] My properties make more than my job."
          className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded-xl px-4 py-3 text-[#E5E7EB] text-sm resize-none focus:border-[#2A7B88] leading-relaxed" />
        {script && <p className="text-xs text-[#9CA3AF]/60">{script.replace(/\[.*?\]\s*/g, '').split(/\s+/).filter(Boolean).length} words · ~{Math.round(script.replace(/\[.*?\]\s*/g, '').split(/\s+/).filter(Boolean).length / 2.5)}s</p>}
        <div>
          <label className="text-xs text-[#9CA3AF] mb-2 block">Click to insert at cursor:</label>
          <div className="flex flex-wrap gap-1.5">
            {['excited', 'serious', 'warm', 'whisper', 'laugh', 'confident', 'casual', 'sigh', 'thoughtful'].map(tag => (
              <button key={tag} onClick={() => insertEmotionTag(tag)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[#D4A843]/30 text-[#D4A843]/80 hover:bg-[#D4A843]/10 hover:text-[#D4A843] transition-all">
                [{tag}]
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Settings */}
      <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">Voice Settings</h2>
        <div className="grid grid-cols-2 gap-6">
          <SliderControl label="Temperature" min={0} max={1} step={0.05} value={voiceTemp} onChange={setVoiceTemp} />
          <SliderControl label="Speed" min={0.5} max={2.0} step={0.05} value={voiceSpeed} onChange={setVoiceSpeed} suffix="x" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Dropdown label="Format" options={['mp3', 'wav']} value={ttsFormat} onChange={setTtsFormat} />
          <Dropdown label="Sample Rate" options={['22050', '44100', '48000']} value={String(ttsSampleRate)} onChange={(v) => setTtsSampleRate(Number(v))} />
          <Dropdown label="Bitrate" options={['64', '128', '192', '320']} value={String(ttsBitrate)} onChange={(v) => setTtsBitrate(Number(v))} />
        </div>
      </section>

      {/* Generate + Result */}
      <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6 space-y-4">
        <button onClick={handleGenerateTts} disabled={!script.trim() || isGeneratingTts || (!selectedVoiceModel && !manualVoiceId)}
          className={`w-full flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all ${script.trim() && !isGeneratingTts && (selectedVoiceModel || manualVoiceId) ? 'bg-gradient-to-r from-[#D4A843] to-[#D4A843]/80 text-[#111827] hover:shadow-lg hover:shadow-[#D4A843]/25' : 'bg-[#1B2A4A] text-[#9CA3AF]/40 cursor-not-allowed'}`}>
          {isGeneratingTts ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Music className="w-4 h-4" />Generate Audio</>}
        </button>

        {ttsAudio && (
          <div className="space-y-3">
            <audio controls src={ttsAudio} className="w-full" />
            <div className="flex gap-3 justify-center">
              <a href={ttsAudio} download={`bnb-voice-${Date.now()}.mp3`}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90">
                <Download className="w-4 h-4" />Download MP3
              </a>
              <button onClick={handleGenerateTts}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88]">
                <RotateCcw className="w-4 h-4" />Regenerate
              </button>
              <button onClick={() => { setSelectedPath('custom') }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#111827] text-[#2A7B88] border border-[#2A7B88]/30 hover:border-[#2A7B88] hover:text-[#D4A843]">
                Copy to Custom Path
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )

  // ── Character Creator/Editor Modal ──────────────────────────────────────────

  const renderFaceDropZone = (slot: string, label: string, currentUrl: string | null) => {
    const isUploading = isUploadingModal === slot
    const isDraggingThis = isDraggingSlot === slot
    return (
      <div className="flex flex-col items-center gap-1.5">
        <label className="text-xs text-[#9CA3AF] font-medium">{label}</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDraggingSlot(slot) }}
          onDragLeave={() => setIsDraggingSlot(null)}
          onDrop={(e) => { e.preventDefault(); setIsDraggingSlot(null); const file = e.dataTransfer.files[0]; if (file?.type.startsWith('image/')) handleModalUpload(file, slot) }}
          onClick={() => document.getElementById(`modal-upload-${slot}`)?.click()}
          className={`w-24 h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center justify-center overflow-hidden ${isDraggingThis ? 'border-[#D4A843] bg-[#D4A843]/10' : currentUrl ? 'border-[#2A7B88]/30' : 'border-[#374151] hover:border-[#D4A843]'}`}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#D4A843]" />
          ) : currentUrl ? (
            <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-[#374151]" />
          )}
          <input id={`modal-upload-${slot}`} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleModalUpload(file, slot) }} className="hidden" />
        </div>
      </div>
    )
  }

  const renderCharacterModal = () => {
    if (!showCharacterModal) return null
    const autoPrompt = generateLockPrompt(modalName, modalGender, modalAge, modalEthnicity, modalHair, modalSkinTone, modalDistinguishing)
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowCharacterModal(false)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#111827] rounded-2xl border border-[#2A7B88]/20 shadow-2xl"
          onClick={(e) => e.stopPropagation()} style={{ scrollbarWidth: 'thin' }}>
          <div className="sticky top-0 z-10 bg-[#111827] border-b border-[#2A7B88]/15 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h3 className="text-lg font-bold text-[#E5E7EB]">{editingPack ? 'Edit Character' : 'Create New Character'}</h3>
            <button onClick={() => setShowCharacterModal(false)} className="text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-6">
            {/* Basics */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Basics</h4>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#9CA3AF] font-medium">Name <span className="text-red-400">*</span></label>
                <input type="text" value={modalName} onChange={(e) => setModalName(e.target.value)} placeholder="e.g. Jordan, Sarah"
                  className="w-full bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm focus:border-[#D4A843] focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#9CA3AF] font-medium">Age</label>
                  <input type="text" value={modalAge} onChange={(e) => setModalAge(e.target.value)} placeholder="e.g. early 20s"
                    className="bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#D4A843] focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#9CA3AF] font-medium">Gender</label>
                  <div className="relative">
                    <select value={modalGender} onChange={(e) => setModalGender(e.target.value)}
                      className="w-full appearance-none bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#D4A843] cursor-pointer focus:outline-none">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#9CA3AF] font-medium">Ethnicity</label>
                  <input type="text" value={modalEthnicity} onChange={(e) => setModalEthnicity(e.target.value)} placeholder="e.g. Asian-Australian"
                    className="bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#D4A843] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#9CA3AF] font-medium">Hair</label>
                  <input type="text" value={modalHair} onChange={(e) => setModalHair(e.target.value)} placeholder="e.g. buzz cut"
                    className="bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#D4A843] focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#9CA3AF] font-medium">Skin Tone</label>
                  <input type="text" value={modalSkinTone} onChange={(e) => setModalSkinTone(e.target.value)} placeholder="e.g. light tan"
                    className="bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#D4A843] focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#9CA3AF] font-medium">Distinguishing Features</label>
                  <input type="text" value={modalDistinguishing} onChange={(e) => setModalDistinguishing(e.target.value)} placeholder="e.g. small earring"
                    className="bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#D4A843] focus:outline-none" />
                </div>
              </div>
            </div>
            {/* Face References */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Face References</h4>
              <div className="flex items-start gap-4">
                {renderFaceDropZone('front', 'Front-facing', modalFaceFront)}
                {renderFaceDropZone('3quarter', '3/4 Angle', modalFace3Quarter)}
                {renderFaceDropZone('profile', 'Profile', modalFaceProfile)}
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[#9CA3AF] font-medium">Additional Angles</label>
                <div className="flex flex-wrap gap-2">
                  {modalFaceAdditional.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#2A7B88]/20 group">
                      <img src={url} alt={`Extra ${idx + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => setModalFaceAdditional(prev => prev.filter((_item, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingSlot('additional') }}
                    onDragLeave={() => setIsDraggingSlot(null)}
                    onDrop={(e) => { e.preventDefault(); setIsDraggingSlot(null); const file = e.dataTransfer.files[0]; if (file?.type.startsWith('image/')) handleModalUpload(file, 'additional') }}
                    onClick={() => document.getElementById('modal-upload-additional')?.click()}
                    className={`w-16 h-16 rounded-lg border-2 border-dashed cursor-pointer flex items-center justify-center transition-all ${isDraggingSlot === 'additional' ? 'border-[#D4A843] bg-[#D4A843]/10' : 'border-[#374151] hover:border-[#D4A843]'}`}>
                    {isUploadingModal === 'additional' ? <Loader2 className="w-4 h-4 animate-spin text-[#D4A843]" /> : <Plus className="w-4 h-4 text-[#374151]" />}
                    <input id="modal-upload-additional" type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleModalUpload(file, 'additional') }} className="hidden" />
                  </div>
                </div>
              </div>
            </div>
            {/* Voice */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Voice</h4>
              <div className="space-y-3">
                {([
                  { value: 'custom' as VoiceOption, label: "Use character's voice clone" },
                  { value: 'default' as VoiceOption, label: 'Use default BNB voice (Jordan)' },
                  { value: 'none' as VoiceOption, label: 'No voice clone' },
                ]).map((opt) => (
                  <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${modalVoiceOption === opt.value ? 'border-[#D4A843]' : 'border-[#374151] group-hover:border-[#2A7B88]'}`}>
                      {modalVoiceOption === opt.value && <div className="w-2 h-2 rounded-full bg-[#D4A843]" />}
                    </div>
                    <div className="flex-1">
                      <input type="radio" name="voiceOption" value={opt.value} checked={modalVoiceOption === opt.value}
                        onChange={() => setModalVoiceOption(opt.value)} className="hidden" />
                      <span className={`text-sm ${modalVoiceOption === opt.value ? 'text-[#E5E7EB]' : 'text-[#9CA3AF]'}`}>{opt.label}</span>
                    </div>
                  </label>
                ))}
              </div>
              {modalVoiceOption === 'custom' && (
                <div className="flex items-end gap-3 pl-7">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs text-[#9CA3AF]">Fish Audio Voice ID</label>
                    <input type="text" value={modalVoiceId} onChange={(e) => setModalVoiceId(e.target.value)} placeholder="e.g. abc123def456"
                      className="bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm font-mono focus:border-[#D4A843] focus:outline-none" />
                  </div>
                  <button onClick={() => handleVoicePreview('Hello, this is a voice test for my character.', modalVoiceId)}
                    disabled={!modalVoiceId.trim() || isPreviewingVoice}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${modalVoiceId.trim() && !isPreviewingVoice ? 'bg-[#2A7B88]/20 text-[#2A7B88] border border-[#2A7B88]/30 hover:bg-[#2A7B88]/30' : 'bg-[#111827] text-[#9CA3AF]/30 cursor-not-allowed'}`}>
                    {isPreviewingVoice ? 'Testing...' : 'Test'}
                  </button>
                </div>
              )}
              {voicePreviewAudio && modalVoiceOption === 'custom' && (
                <div className="pl-7"><audio controls src={voicePreviewAudio} className="h-8 w-full max-w-sm" /></div>
              )}
            </div>
            {/* Identity Lock Prompt */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Identity Lock Prompt</h4>
              <textarea value={modalLockPrompt || autoPrompt} onChange={(e) => setModalLockPrompt(e.target.value)} rows={3}
                className="w-full bg-[#0D1117] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm resize-none focus:border-[#D4A843] focus:outline-none leading-relaxed" />
              <p className="text-xs text-[#9CA3AF]/50">Auto-generated from basics. Edit to fine-tune character consistency.</p>
            </div>
            {/* Influence Sliders */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Influence Sliders</h4>
              <div className="space-y-4">
                <SliderControl label="Face Influence" min={0} max={1} step={0.05} value={modalFaceInfluence} onChange={setModalFaceInfluence} />
                <SliderControl label="Voice Influence" min={0} max={1} step={0.05} value={modalVoiceInfluence} onChange={setModalVoiceInfluence} />
                <SliderControl label="Style Influence" min={0} max={1} step={0.05} value={modalStyleInfluence} onChange={setModalStyleInfluence} />
              </div>
            </div>
          </div>
          {/* Footer */}
          <div className="sticky bottom-0 bg-[#111827] border-t border-[#2A7B88]/15 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
            <button onClick={() => setShowCharacterModal(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#9CA3AF] border border-[#2A7B88]/20 hover:border-[#2A7B88]/50 transition-all">Cancel</button>
            <button onClick={handleSaveCharacter} disabled={!modalName.trim() || isSavingCharacter}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${modalName.trim() && !isSavingCharacter ? 'bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 shadow-lg shadow-[#D4A843]/20' : 'bg-[#1B2A4A] text-[#9CA3AF]/40 cursor-not-allowed'}`}>
              {isSavingCharacter ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : (editingPack ? 'Save Changes' : 'Create Character')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  const customCharacterSelected = selectedPath === 'custom' && selectedPack !== null

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="border-b border-[#2A7B88]/20 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4A843] to-[#2A7B88] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-[#E5E7EB]">
              BNB Success <span className="text-[#9CA3AF] font-normal mx-2">&middot;</span> <span className="text-[#D4A843]">UGC Content Studio</span>
            </h1>
          </div>
          {selectedPath && <button onClick={() => { setSelectedPath(null); handleReset() }} className="text-sm text-[#9CA3AF] hover:text-[#E5E7EB]">Switch Path</button>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Path Selector */}
        <section>
          <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4">Production Path</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PATHS.map((p) => {
              const Icon = p.icon
              const isActive = selectedPath === p.id
              return (
                <button key={p.id} onClick={() => setSelectedPath(p.id)}
                  className={`group relative text-left rounded-xl p-5 border transition-all duration-200 ${isActive ? 'bg-[#1B2A4A] border-[#D4A843]/60 shadow-lg shadow-[#D4A843]/5' : 'bg-[#1B2A4A]/60 border-[#2A7B88]/20 hover:border-[#2A7B88]/50 hover:bg-[#1B2A4A]'}`}>
                  {isActive && <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#D4A843] animate-pulse" />}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${isActive ? 'bg-[#D4A843]/20' : 'bg-[#2A7B88]/15'}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#D4A843]' : 'text-[#2A7B88]'}`} />
                  </div>
                  <h3 className={`font-semibold mb-0.5 ${isActive ? 'text-[#D4A843]' : 'text-[#E5E7EB]'}`}>{p.title}</h3>
                  <p className="text-xs text-[#9CA3AF] mb-2">{p.subtitle}</p>
                  <p className="text-sm text-[#9CA3AF]/80 mb-3">{p.description}</p>
                  <div className="flex gap-3 text-xs text-[#9CA3AF]/60"><span>{p.timing}</span><span>|</span><span>{p.cost}</span></div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
            <button onClick={handleReset} className="ml-2 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium text-xs border border-red-500/30">Try Again</button>
            <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Character Library (Custom path, step 1) */}
        {selectedPath === 'custom' && !claudeParams && !videoUrl && renderCharacterLibrary()}

        {/* Voice Only path (replaces brain dump + parameters) */}
        {selectedPath === 'voice' && renderVoicePath()}

        {/* Brain Dump (seedance + custom only, not voice) */}
        {selectedPath && selectedPath !== 'voice' && !claudeParams && !videoUrl && (selectedPath === 'seedance' || customCharacterSelected) && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4">
              Brain Dump{selectedPath === 'custom' && selectedPack ? ` \u2014 ${selectedPack.name}` : ''}
            </h2>
            <textarea value={brainDump} onChange={(e) => setBrainDump(e.target.value)} rows={6}
              placeholder={BRAIN_DUMP_PLACEHOLDERS[selectedPath]}
              className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded-xl px-4 py-3 text-[#E5E7EB] text-sm resize-none focus:border-[#2A7B88] placeholder:text-[#9CA3AF]/40 leading-relaxed" />
            <div className="flex justify-end mt-4">
              <button onClick={handleFormulate} disabled={!brainDump.trim() || isFormulating}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${brainDump.trim() && !isFormulating ? 'bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 shadow-lg shadow-[#D4A843]/20' : 'bg-[#1B2A4A] text-[#9CA3AF]/40 cursor-not-allowed'}`}>
                {isFormulating ? <><Loader2 className="w-4 h-4 animate-spin" />Formulating...</> : <><Sparkles className="w-4 h-4" />Formulate</>}
              </button>
            </div>
          </section>
        )}

        {/* Parameter Panel */}
        {claudeParams && !videoUrl && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">Parameters</h2>
              <button onClick={() => setClaudeParams(null)} className="text-xs text-[#9CA3AF] hover:text-[#D4A843]">Back to Brain Dump</button>
            </div>
            {selectedPath === 'seedance' ? renderSeedanceParams() : renderCustomParams()}
          </section>
        )}

        {/* Long-form indicator + segment preview */}
        {claudeParams && !videoUrl && isLongForm && script.trim() && (
          <section className="bg-[#1B2A4A]/60 border border-[#D4A843]/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold bg-[#D4A843]/20 text-[#D4A843] px-2.5 py-1 rounded-full">LONG-FORM</span>
              <span className="text-sm text-[#9CA3AF]">~{estDurationSec}s · {scriptWordCount} words · {segments ? segments.chunks.length : Math.ceil(estDurationSec / 13)} chunks</span>
            </div>

            {!segments && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#9CA3AF]/80">Script is longer than 15s. It will be split into chunks and stitched together.</p>
                <button onClick={handleSegment} disabled={isSegmenting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#2A7B88]/20 text-[#2A7B88] border border-[#2A7B88]/30 hover:bg-[#2A7B88]/30">
                  {isSegmenting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Segmenting...</> : 'Preview Cuts'}
                </button>
              </div>
            )}

            {segments && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#D4A843]">Segment Preview</h4>
                  <button onClick={() => { setSegments(null); setMarkedScript('') }} className="text-xs text-[#9CA3AF] hover:text-[#D4A843]">Re-segment</button>
                </div>

                {/* Timeline bar */}
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                  {segments.chunks.map((chunk: any, i: number) => {
                    const pct = (chunk.durationSec / segments.totalDurationSec) * 100
                    const colors = ['#2A7B88', '#D4A843', '#10B981', '#8B5CF6', '#F59E0B']
                    return <div key={i} style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} title={`Chunk ${i + 1}: ${chunk.durationSec}s`} />
                  })}
                </div>

                {/* Chunk list */}
                {segments.chunks.map((chunk: any, i: number) => (
                  <div key={i} className="bg-[#111827] rounded-lg p-3 border border-[#2A7B88]/15">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold bg-[#2A7B88]/20 text-[#2A7B88] px-1.5 py-0.5 rounded">CHUNK {i + 1}</span>
                      <span className="text-[10px] text-[#9CA3AF]">{chunk.startTimeSec}s–{chunk.endTimeSec}s ({chunk.durationSec}s)</span>
                      {i > 0 && <span className="text-[10px] bg-[#D4A843]/15 text-[#D4A843] px-1.5 py-0.5 rounded">{chunk.transitionIn}</span>}
                    </div>
                    <p className="text-xs text-[#E5E7EB]/80 leading-relaxed">{chunk.scriptText}</p>
                    {chunk.continuityNote && <p className="text-[10px] text-[#9CA3AF]/50 mt-1 italic">{chunk.continuityNote.slice(0, 100)}...</p>}
                    {chunk.editCues?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {chunk.editCues.map((cue: any, j: number) => (
                          <span key={j} className="text-[9px] bg-[#D4A843]/10 text-[#D4A843]/70 px-1.5 py-0.5 rounded">
                            {cue.type === 'zoom' ? `🔍 ${cue.zoomPercent || 106}%` : cue.type === 'text-overlay' ? `📝 "${cue.description?.slice(0, 20)}"` : cue.type === 'emphasis' ? '✨ emphasis' : cue.type === 'b-roll' ? `🎞️ ${cue.description?.slice(0, 15)}` : cue.type}
                            {' '}{cue.startSec}s
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="space-y-1.5 text-[10px] text-[#9CA3AF]/50">
                  <p className="font-medium text-[#9CA3AF]/70">Script tags you can use:</p>
                  <p><span className="text-[#D4A843]/60">Transitions:</span> [CUT] [CROSSFADE] [SLIDE] [FADE] — force a cut at that point</p>
                  <p><span className="text-[#D4A843]/60">Edits:</span> [ZOOM] [ZOOM IN] [ZOOM OUT] — zoom on the next line</p>
                  <p><span className="text-[#D4A843]/60">Effects:</span> [EMPHASIS] — brightness flash · [SLOW] — slow-mo feel</p>
                  <p><span className="text-[#D4A843]/60">Overlays:</span> [TEXT:$23K/month] — text card · [BROLL:booking dashboard] — b-roll insert</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Generate Button */}
        {claudeParams && !videoUrl && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6">
            {isGenerating && (
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[#9CA3AF]">{statusText}</span>
                  <span className="text-sm font-mono text-[#D4A843]">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-[#111827] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#2A7B88] to-[#D4A843] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                {chunkStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {chunkStatuses.map((status, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        status === 'done' ? 'bg-[#10B981]/20 text-[#10B981]' :
                        status === 'generating' ? 'bg-[#D4A843]/20 text-[#D4A843]' :
                        status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-[#111827] text-[#9CA3AF]/40 border border-[#2A7B88]/15'
                      }`}>
                        {status === 'generating' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        Clip {i + 1}{status === 'done' ? ' ✓' : status === 'error' ? ' ✗' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#9CA3AF]">
                {isLongForm
                  ? <>Est: <span className="text-[#D4A843] font-semibold">~{segments?.chunks?.length || Math.ceil(estDurationSec / 13)} chunks × 720 credits · ~{(segments?.chunks?.length || Math.ceil(estDurationSec / 13)) * 3} min</span></>
                  : <>Est. cost: <span className="text-[#D4A843] font-semibold">{creditEstimate}</span></>
                }
              </div>
              <button onClick={handleGenerate} disabled={isGenerating || !script.trim()}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all ${!isGenerating && script.trim() ? 'bg-gradient-to-r from-[#D4A843] to-[#D4A843]/80 text-[#111827] hover:shadow-lg hover:shadow-[#D4A843]/25' : 'bg-[#1B2A4A] text-[#9CA3AF]/40 cursor-not-allowed'}`}>
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                  : isLongForm ? `Generate ${segments?.chunks?.length || Math.ceil(estDurationSec / 13)} Chunks`
                  : 'Generate Video'}
              </button>
            </div>
          </section>
        )}

        {/* Result Viewer */}
        {videoUrl && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-[#10B981] uppercase tracking-wider">Result</h2>
            <div className="relative rounded-xl overflow-hidden bg-black max-w-lg mx-auto">
              <video ref={videoRef} src={videoUrl} className="w-full" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} controls={false} muted={isMuted} />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex items-center gap-3">
                <button onClick={() => { if (videoRef.current) { isPlaying ? videoRef.current.pause() : videoRef.current.play() } }} className="text-white hover:text-[#D4A843]">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-[#D4A843]">
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {isFallback && chunkVideoUrls.length > 1 && (
              <div className="space-y-3">
                <p className="text-xs text-[#9CA3AF]">Render server unavailable for stitching. All {chunkVideoUrls.length} clips below:</p>
                <div className="grid grid-cols-1 gap-3">
                  {chunkVideoUrls.map((url, i) => (
                    <div key={i} className="bg-[#111827] rounded-lg p-3 border border-[#2A7B88]/15 flex items-center gap-3">
                      <video src={url} className="w-32 h-auto rounded" controls />
                      <div className="flex-1">
                        <p className="text-sm text-[#E5E7EB]">Clip {i + 1} of {chunkVideoUrls.length}</p>
                      </div>
                      <a href={url} download={`clip-${i + 1}.mp4`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#D4A843]/20 text-[#D4A843] hover:bg-[#D4A843]/30">
                        <Download className="w-3 h-3" />Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <a href={videoUrl} download className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 shadow-lg shadow-[#D4A843]/20">
                <Download className="w-4 h-4" />{isFallback ? 'Download Clip 1' : 'Download'}
              </a>
              <button onClick={handleReset} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88]">
                <RotateCcw className="w-4 h-4" />Generate Another
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Character Creator/Editor Modal */}
      {renderCharacterModal()}

      <footer className="border-t border-[#2A7B88]/10 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center"><p className="text-xs text-[#9CA3AF]/40">BNB Success UGC Content Studio</p></div>
      </footer>
    </div>
  )
}

export default App
