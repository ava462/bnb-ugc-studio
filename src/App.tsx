import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import {
  Drama, Target, Sparkles, Download, RotateCcw,
  ChevronDown, Upload, X, Loader2, Play, Pause, Volume2, VolumeX, AlertCircle, Plus, Music
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductionPath = 'seedance' | 'custom' | null

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

  // Seedance params
  const [script, setScript] = useState('')
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
  const [isUploadingFace, setIsUploadingFace] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Reference library state
  const [refPacks, setRefPacks] = useState<any[]>([])
  const [selectedPack, setSelectedPack] = useState<any>(null)
  const [selectedFaceUrl, setSelectedFaceUrl] = useState<string | null>(null)
  const [isLoadingRefs, setIsLoadingRefs] = useState(false)
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<string | null>(null)
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [newPackSpeaker, setNewPackSpeaker] = useState('')
  const [showNewPackForm, setShowNewPackForm] = useState(false)
  // Influence weights
  const [faceWeight, setFaceWeight] = useState(0.8)
  const [styleWeight, setStyleWeight] = useState(0.5)

  // Video player
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setClaudeParams(null); setBrainDump(''); setScript(''); setVideoUrl(null); setError(''); setStatusText(''); setProgress(0); setIsGenerating(false)
  }, [selectedPath])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // ── Load reference packs ────────────────────────────────────────────────────

  const loadRefPacks = useCallback(async () => {
    setIsLoadingRefs(true)
    try {
      const res = await fetch('/api/references?action=list')
      if (!res.ok) throw new Error('Failed to load reference packs')
      const data = await res.json()
      setRefPacks(data.packs || [])
      // Auto-select jordan pack if it exists and nothing is selected
      if (!selectedPack) {
        const jordan = (data.packs || []).find((p: any) => p.speaker?.toLowerCase() === 'jordan')
        if (jordan) setSelectedPack(jordan)
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

  // ── Voice preview ───────────────────────────────────────────────────────────

  const handleVoicePreview = async () => {
    if (!script.trim()) return
    setIsPreviewingVoice(true)
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script.slice(0, 200), voiceId: selectedPack?.voiceId, emotion: emotion.toLowerCase(), speed: voiceSpeed, temperature: voiceTemp }),
      })
      if (!res.ok) throw new Error('Preview failed')
      const data = await res.json()
      setVoicePreviewAudio(data.audio)
    } catch (err: any) { setError(err.message) }
    finally { setIsPreviewingVoice(false) }
  }

  // ── Create character pack ───────────────────────────────────────────────────

  const handleCreatePack = async () => {
    if (!newPackName.trim() || !newPackSpeaker.trim()) return
    try {
      const res = await fetch('/api/references?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPackName, speaker: newPackSpeaker }),
      })
      if (!res.ok) throw new Error('Create failed')
      setShowNewPackForm(false)
      setNewPackName(''); setNewPackSpeaker('')
      loadRefPacks()
    } catch (err: any) { setError(err.message) }
  }

  // ── Upload face to selected pack ────────────────────────────────────────────

  const handleUploadToPack = async (file: File) => {
    if (!selectedPack) return
    setIsUploadingFace(true)
    try {
      const reader = new FileReader()
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/references?action=upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataUri, speaker: selectedPack.speaker, filename: `${selectedPack.speaker}-${Date.now()}.${file.name.split('.').pop()}` }),
      })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()
      setSelectedFaceUrl(url)
      loadRefPacks()
    } catch (err: any) { setError(err.message) }
    finally { setIsUploadingFace(false) }
  }

  // ── Formulate: Brain dump → Claude → parameters ────────────────────────────

  const handleFormulate = async () => {
    if (!selectedPath || !brainDump.trim()) return
    setIsFormulating(true)
    setError('')
    try {
      // For interpret API, 'custom' maps to 'fal' so Claude generates the right parameter shape
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

      // Map Claude's nested response → flat UI state
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
        // custom path
        if (data.script?.dialogue) setScript(data.script.dialogue)
        else if (data.script?.dialogueTagged) setScript(data.script.dialogueTagged)
        if (data.voice?.emotionTags?.[0]) {
          const match = EMOTIONS.find(e => e.toLowerCase() === data.voice.emotionTags[0].toLowerCase())
          if (match) setEmotion(match)
        }
        if (data.voice?.temperature !== undefined) setVoiceTemp(data.voice.temperature)
        if (data.voice?.speed !== undefined) setVoiceSpeed(data.voice.speed)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to formulate parameters')
    } finally {
      setIsFormulating(false)
    }
  }

  // ── Build the nested params the API expects ────────────────────────────────

  const buildApiParams = useCallback((): Record<string, any> => {
    if (selectedPath === 'seedance') {
      return {
        script: { dialogue: script },
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
      }
    }
    // custom path
    const resolvedFaceUrl = selectedFaceUrl || 'https://bnb-ugc-assets.s3.ap-southeast-2.amazonaws.com/references/jordan/jordan-default.jpg'
    return {
      script: { dialogue: script, dialogueTagged: `[${emotion.toLowerCase()}] ${script}` },
      voice: { emotionTags: [emotion.toLowerCase()], temperature: voiceTemp, speed: voiceSpeed },
      faceImageUrl: resolvedFaceUrl,
      influenceWeights: { face: faceWeight, style: styleWeight },
    }
  }, [selectedPath, script, age, gender, hair, skin, wardrobe, setting, camera, lighting, duration, aspectRatio, influencer, realism, emotion, voiceTemp, voiceSpeed, selectedFaceUrl, faceWeight, styleWeight])

  // ── Generate video ─────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!selectedPath || !script.trim()) return
    setIsGenerating(true)
    setError('')
    setStatusText('Submitting job...')
    setProgress(5)
    setVideoUrl(null)

    try {
      const params = buildApiParams()

      setStatusText('Starting generation...')
      setProgress(10)

      // For 'custom' path, resolve to 'arcads' if Jordan pack is selected, otherwise 'fal'
      const apiPath = selectedPath === 'custom'
        ? (selectedPack?.speaker?.toLowerCase() === 'jordan' && !selectedFaceUrl ? 'arcads' : 'fal')
        : selectedPath

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: apiPath, parameters: params }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.error || `Generate failed: ${res.status}`)
      }

      const genResult = await res.json()

      if (genResult.error) throw new Error(genResult.error)

      setStatusText('Generating video...')
      setProgress(20)

      // Build the correct polling query string based on what generate returned
      const pollQuery = new URLSearchParams()
      pollQuery.set('pollType', genResult.pollType)
      if (genResult.assetId) pollQuery.set('assetId', genResult.assetId)
      if (genResult.requestId) pollQuery.set('requestId', genResult.requestId)
      if (genResult.statusUrl) pollQuery.set('statusUrl', genResult.statusUrl)
      if (genResult.responseUrl) pollQuery.set('responseUrl', genResult.responseUrl)

      // Poll for status
      let pollCount = 0
      pollRef.current = setInterval(async () => {
        pollCount++
        try {
          const statusRes = await fetch(`/api/status?${pollQuery.toString()}`)
          if (!statusRes.ok) return // keep polling

          const statusData = await statusRes.json()

          if (statusData.status === 'complete' && statusData.videoUrl) {
            if (pollRef.current) clearInterval(pollRef.current)
            setVideoUrl(statusData.videoUrl)
            setStatusText('Complete!')
            setProgress(100)
            setIsGenerating(false)
            return
          }

          if (statusData.status === 'failed' || statusData.status === 'error') {
            if (pollRef.current) clearInterval(pollRef.current)
            setError(statusData.error || 'Generation failed')
            setIsGenerating(false)
            return
          }

          // Increment progress gradually
          const newProgress = Math.min(20 + pollCount * 3, 90)
          setProgress(newProgress)
          setStatusText(statusData.statusText || `Processing... (${Math.round(pollCount * 5)}s)`)
        } catch {
          // Keep polling on network errors
        }
      }, 5000)

    } catch (err: any) {
      setError(err.message || 'Generation failed')
      setIsGenerating(false)
      setStatusText('')
    }
  }

  const handleReset = () => {
    setVideoUrl(null); setClaudeParams(null); setBrainDump(''); setScript(''); setError(''); setStatusText(''); setProgress(0); setIsGenerating(false)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const creditEstimate = selectedPath === 'seedance' ? `~${Math.round(duration * 48)} credits` : '~$0.06 total'

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
    </div>
  )

  // ── Render: Custom Character parameters ──────────────────────────────────

  const renderCustomParams = () => (
    <div className="space-y-6">

      {/* Reference Library */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Reference Library</h4>
          <button onClick={() => setShowNewPackForm(!showNewPackForm)}
            className="flex items-center gap-1.5 text-xs text-[#2A7B88] hover:text-[#D4A843] transition-colors">
            <Plus className="w-3.5 h-3.5" />New Character
          </button>
        </div>

        {/* New pack inline form */}
        {showNewPackForm && (
          <div className="flex items-end gap-3 bg-[#111827] rounded-lg p-3 border border-[#2A7B88]/20">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-[#9CA3AF]">Pack Name</label>
              <input type="text" value={newPackName} onChange={(e) => setNewPackName(e.target.value)} placeholder="e.g. Sarah Testimonials"
                className="bg-[#0D1117] border border-[#2A7B88]/30 rounded px-2.5 py-1.5 text-[#E5E7EB] text-sm focus:border-[#2A7B88]" />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-[#9CA3AF]">Speaker ID</label>
              <input type="text" value={newPackSpeaker} onChange={(e) => setNewPackSpeaker(e.target.value)} placeholder="e.g. sarah"
                className="bg-[#0D1117] border border-[#2A7B88]/30 rounded px-2.5 py-1.5 text-[#E5E7EB] text-sm focus:border-[#2A7B88]" />
            </div>
            <button onClick={handleCreatePack} disabled={!newPackName.trim() || !newPackSpeaker.trim()}
              className="px-4 py-1.5 rounded text-sm font-semibold bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              Create
            </button>
            <button onClick={() => { setShowNewPackForm(false); setNewPackName(''); setNewPackSpeaker('') }}
              className="p-1.5 text-[#9CA3AF] hover:text-red-400"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Pack grid */}
        {isLoadingRefs ? (
          <div className="flex items-center justify-center py-6 text-[#9CA3AF]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading packs...
          </div>
        ) : refPacks.length === 0 ? (
          <div className="text-center py-6 text-sm text-[#9CA3AF]/60">
            No reference packs found. Create one above or the API will use Jordan by default.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {refPacks.map((pack) => {
              const isActive = selectedPack?.speaker === pack.speaker
              const thumb = pack.faces?.[0]?.url
              return (
                <button key={pack.speaker} onClick={() => { setSelectedPack(pack); setSelectedFaceUrl(pack.faces?.[0]?.url || null) }}
                  className={`relative text-left rounded-lg p-3 border transition-all ${isActive ? 'bg-[#1B2A4A] border-[#D4A843]/60 shadow-md shadow-[#D4A843]/10' : 'bg-[#111827] border-[#2A7B88]/20 hover:border-[#2A7B88]/50'}`}>
                  {thumb ? (
                    <img src={thumb} alt={pack.speaker} className="w-full h-20 object-cover rounded mb-2" />
                  ) : (
                    <div className="w-full h-20 bg-[#0D1117] rounded mb-2 flex items-center justify-center text-[#9CA3AF]/30">
                      <Target className="w-8 h-8" />
                    </div>
                  )}
                  <p className={`text-sm font-semibold truncate ${isActive ? 'text-[#D4A843]' : 'text-[#E5E7EB]'}`}>{pack.name || pack.speaker}</p>
                  <p className="text-xs text-[#9CA3AF]/60">{pack.faces?.length || 0} face{pack.faces?.length !== 1 ? 's' : ''}</p>
                  {isActive && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D4A843]" />}
                </button>
              )
            })}
          </div>
        )}

        {/* Selected pack face thumbnails */}
        {selectedPack && selectedPack.faces?.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs text-[#9CA3AF] font-medium">Select Reference Face</label>
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {selectedPack.faces.map((face: any, idx: number) => {
                const isSelected = selectedFaceUrl === face.url
                return (
                  <button key={idx} onClick={() => setSelectedFaceUrl(face.url)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-[#D4A843] shadow-md shadow-[#D4A843]/20' : 'border-[#2A7B88]/20 hover:border-[#2A7B88]/50'}`}>
                    <img src={face.url} alt={face.filename || `Face ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Face Upload */}
      {selectedPack && (
        <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Upload New Face</h4>
          <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file?.type.startsWith('image/')) handleUploadToPack(file) }}
            onClick={() => document.getElementById('pack-face-upload')?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-[#D4A843] bg-[#D4A843]/5' : 'border-[#2A7B88]/30 hover:border-[#2A7B88]'}`}>
            {isUploadingFace ? (
              <div className="flex items-center justify-center gap-2 text-[#D4A843]"><Loader2 className="w-5 h-5 animate-spin" />Uploading to {selectedPack.speaker}...</div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-[#9CA3AF] mx-auto mb-1.5" />
                <p className="text-sm text-[#9CA3AF]">Drop a face image or click to browse</p>
                <p className="text-xs text-[#9CA3AF]/60 mt-1">JPG, PNG, WebP -- added to {selectedPack.speaker}'s pack</p>
              </>
            )}
            <input id="pack-face-upload" type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadToPack(file) }} className="hidden" />
          </div>
          {!selectedFaceUrl && <p className="text-xs text-[#9CA3AF]/60">No face selected -- Jordan's default face will be used.</p>}
        </div>
      )}

      {/* Voice */}
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
          <button onClick={handleVoicePreview} disabled={!script.trim() || isPreviewingVoice}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${script.trim() && !isPreviewingVoice ? 'bg-[#2A7B88]/20 text-[#2A7B88] border border-[#2A7B88]/30 hover:bg-[#2A7B88]/30' : 'bg-[#111827] text-[#9CA3AF]/30 cursor-not-allowed'}`}>
            {isPreviewingVoice ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</> : <><Music className="w-3.5 h-3.5" />Preview Voice</>}
          </button>
          {voicePreviewAudio && (
            <audio controls src={voicePreviewAudio} className="h-8 flex-1" style={{ maxWidth: '280px' }} />
          )}
        </div>
      </div>

      {/* Influence Weights */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">Influence Weights</h4>
        <div className="grid grid-cols-2 gap-6">
          <SliderControl label="Face Influence" min={0} max={1} step={0.05} value={faceWeight} onChange={setFaceWeight} />
          <SliderControl label="Style Influence" min={0} max={1} step={0.05} value={styleWeight} onChange={setStyleWeight} />
        </div>
        <p className="text-xs text-[#9CA3AF]/50">Face: how strongly the reference face is matched. Style: how much the reference style affects the output.</p>
      </div>

      {/* Script */}
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
    </div>
  )

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="border-b border-[#2A7B88]/20 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4A843] to-[#2A7B88] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-[#E5E7EB]">
              BNB Success <span className="text-[#9CA3AF] font-normal mx-2">·</span> <span className="text-[#D4A843]">UGC Content Studio</span>
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
            <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Brain Dump */}
        {selectedPath && !claudeParams && !videoUrl && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4">Brain Dump</h2>
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
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#9CA3AF]">Est. cost: <span className="text-[#D4A843] font-semibold">{creditEstimate}</span></div>
              <button onClick={handleGenerate} disabled={isGenerating || !script.trim()}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all ${!isGenerating && script.trim() ? 'bg-gradient-to-r from-[#D4A843] to-[#D4A843]/80 text-[#111827] hover:shadow-lg hover:shadow-[#D4A843]/25' : 'bg-[#1B2A4A] text-[#9CA3AF]/40 cursor-not-allowed'}`}>
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : 'Generate Video'}
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
            <div className="flex justify-center gap-4">
              <a href={videoUrl} download className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 shadow-lg shadow-[#D4A843]/20">
                <Download className="w-4 h-4" />Download
              </a>
              <button onClick={handleReset} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88]">
                <RotateCcw className="w-4 h-4" />Generate Another
              </button>
            </div>
          </section>
        )}

      </main>
      <footer className="border-t border-[#2A7B88]/10 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center"><p className="text-xs text-[#9CA3AF]/40">BNB Success UGC Content Studio</p></div>
      </footer>
    </div>
  )
}

export default App
