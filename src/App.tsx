import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import {
  Drama, Target, Dna, Sparkles, Download, RotateCcw,
  ChevronDown, Upload, X, Loader2, Play, Pause, Volume2, VolumeX
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductionPath = 'seedance' | 'arcads' | 'fal' | null

interface GenerationStatus {
  status: string
  progress: number
}

interface GenerationResult {
  videoUrl: string
  videoPath: string
}

// ── Path definitions ───────────────────────────────────────────────────────────

const PATHS = [
  {
    id: 'seedance' as const,
    title: 'AI Influencer',
    subtitle: 'Seedance 2.0',
    description: '13 AI characters, bulk testing',
    timing: '~3min',
    cost: '~720 credits',
    icon: Drama,
  },
  {
    id: 'arcads' as const,
    title: "Jordan's Face",
    subtitle: 'Arcads OmniHuman + Fish Audio',
    description: "Jordan's clone, hero ads",
    timing: '~5min',
    cost: 'TBD credits',
    icon: Target,
  },
  {
    id: 'fal' as const,
    title: 'Custom Face',
    subtitle: 'fal.ai OmniHuman + Fish Audio',
    description: 'Any face photo, most flexible',
    timing: '~5min',
    cost: '~$0.05',
    icon: Dna,
  },
]

const BRAIN_DUMP_PLACEHOLDERS: Record<string, string> = {
  seedance:
    'Describe the video you want to create with an AI influencer...\n\nExample: "Young woman in activewear, walking through a modern apartment, talking excitedly about short-term rental income. Bright natural lighting, lifestyle feel. She should gesture with her hands and look directly at camera."',
  arcads:
    "Describe the ad you want Jordan to deliver...\n\nExample: \"Jordan speaking directly to camera about how our students are averaging $2,400/month from their first Airbnb listing. Confident, relaxed energy. Start with a hook about quitting the 9-5.\"",
  fal:
    'Describe the video and who should deliver it...\n\nExample: "Professional woman in her 30s, business casual, explaining the 3 biggest mistakes new Airbnb hosts make. Warm office background, soft lighting. Authoritative but approachable tone."',
}

const SETTINGS = [
  'Modern apartment', 'Office / workspace', 'Coffee shop', 'Beach / outdoor',
  'Studio (plain bg)', 'Luxury interior', 'Urban street', 'Gym / fitness',
]

const CAMERAS = [
  'Static medium shot', 'Slow zoom in', 'Slow zoom out', 'Pan left to right',
  'Handheld / organic', 'Close-up face', 'Full body static',
]

const LIGHTING = [
  'Natural daylight', 'Golden hour', 'Studio softbox', 'Ring light',
  'Moody / low key', 'Bright & clean', 'Neon accent',
]

const EMOTIONS = [
  'Neutral', 'Excited', 'Confident', 'Empathetic', 'Urgent',
  'Friendly', 'Professional', 'Inspirational', 'Casual', 'Serious',
]

// ── Reusable Components ────────────────────────────────────────────────────────

function Dropdown({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-[#9CA3AF] font-medium">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm focus:border-[#2A7B88] cursor-pointer"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
      </div>
    </div>
  )
}

function SliderControl({ label, min, max, step, value, onChange, suffix }: {
  label: string; min: number; max: number; step: number
  value: number; onChange: (v: number) => void; suffix?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label className="text-sm text-[#9CA3AF] font-medium">{label}</label>
        <span className="text-sm text-[#D4A843] font-mono">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #D4A843 0%, #D4A843 ${((value - min) / (max - min)) * 100}%, #1B2A4A ${((value - min) / (max - min)) * 100}%, #1B2A4A 100%)`,
        }}
      />
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────

function App() {
  // State
  const [selectedPath, setSelectedPath] = useState<ProductionPath>(null)
  const [brainDump, setBrainDump] = useState('')
  const [parameters, setParameters] = useState<Record<string, any> | null>(null)
  const [isFormulating, setIsFormulating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  // Parameter state - Seedance
  const [script, setScript] = useState('')
  const [age, setAge] = useState(28)
  const [gender, setGender] = useState<'female' | 'male'>('female')
  const [hair, setHair] = useState('')
  const [skin, setSkin] = useState('')
  const [wardrobe, setWardrobe] = useState('')
  const [setting, setSetting] = useState(SETTINGS[0])
  const [camera, setCamera] = useState(CAMERAS[0])
  const [lighting, setLighting] = useState(LIGHTING[0])
  const [duration, setDuration] = useState(8)
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16')
  const [influencer, setInfluencer] = useState('Auto-select')
  const [realism, setRealism] = useState(true)

  // Parameter state - Arcads / fal
  const [emotion, setEmotion] = useState('Confident')
  const [voiceTemp, setVoiceTemp] = useState(0.7)
  const [voiceSpeed, setVoiceSpeed] = useState(1.0)
  const [faceImage, setFaceImage] = useState<File | null>(null)
  const [faceImagePreview, setFaceImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Video player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset parameters when path changes
  useEffect(() => {
    setParameters(null)
    setBrainDump('')
    setScript('')
    setResult(null)
    setGenerationStatus(null)
    setIsGenerating(false)
  }, [selectedPath])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  // ── API Handlers ─────────────────────────────────────────────────────────────

  const handleFormulate = async () => {
    if (!selectedPath || !brainDump.trim()) return
    setIsFormulating(true)
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, brainDump }),
      })
      const data = await res.json()
      setParameters(data)

      // Populate fields from response
      if (data.script) setScript(data.script)
      if (data.age) setAge(data.age)
      if (data.gender) setGender(data.gender)
      if (data.hair) setHair(data.hair)
      if (data.skin) setSkin(data.skin)
      if (data.wardrobe) setWardrobe(data.wardrobe)
      if (data.setting) setSetting(data.setting)
      if (data.camera) setCamera(data.camera)
      if (data.lighting) setLighting(data.lighting)
      if (data.duration) setDuration(data.duration)
      if (data.emotion) setEmotion(data.emotion)
      if (data.voiceTemp) setVoiceTemp(data.voiceTemp)
      if (data.voiceSpeed) setVoiceSpeed(data.voiceSpeed)
    } catch (err) {
      console.error('Formulate failed:', err)
    } finally {
      setIsFormulating(false)
    }
  }

  const collectParameters = useCallback((): Record<string, any> => {
    const base = { script }
    if (selectedPath === 'seedance') {
      return {
        ...base, age, gender, hair, skin, wardrobe, setting, camera,
        lighting, duration, aspectRatio, influencer, realism,
      }
    }
    // arcads or fal
    const params: Record<string, any> = {
      ...base, emotion, voiceTemp, voiceSpeed,
    }
    if (selectedPath === 'fal' && faceImage) {
      params.faceImageName = faceImage.name
    }
    return params
  }, [
    script, selectedPath, age, gender, hair, skin, wardrobe, setting,
    camera, lighting, duration, aspectRatio, influencer, realism,
    emotion, voiceTemp, voiceSpeed, faceImage,
  ])

  const handleGenerate = async () => {
    if (!selectedPath) return
    setIsGenerating(true)
    setGenerationStatus({ status: 'Submitting job...', progress: 0 })
    setResult(null)

    try {
      const params = collectParameters()
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, parameters: params }),
      })
      const { jobId } = await res.json()

      // Start polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/status?jobId=${jobId}&path=${selectedPath}`
          )
          const statusData = await statusRes.json()
          setGenerationStatus({
            status: statusData.status,
            progress: statusData.progress ?? 0,
          })
          if (statusData.videoUrl) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            setResult({
              videoUrl: statusData.videoUrl,
              videoPath: statusData.videoPath ?? '',
            })
            setIsGenerating(false)
          }
          if (statusData.status === 'failed' || statusData.status === 'error') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            setIsGenerating(false)
          }
        } catch {
          // keep polling
        }
      }, 3000)
    } catch (err) {
      console.error('Generate failed:', err)
      setIsGenerating(false)
      setGenerationStatus({ status: 'Error - check console', progress: 0 })
    }
  }

  const handleReset = () => {
    setResult(null)
    setGenerationStatus(null)
    setIsGenerating(false)
    setParameters(null)
    setBrainDump('')
    setScript('')
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
  }

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) {
      setFaceImage(file)
      setFaceImagePreview(URL.createObjectURL(file))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFaceImage(file)
      setFaceImagePreview(URL.createObjectURL(file))
    }
  }

  // ── Credit estimate ──────────────────────────────────────────────────────────

  const creditEstimate =
    selectedPath === 'seedance'
      ? `~${Math.round(duration * 90)} credits (~${duration}s)`
      : selectedPath === 'arcads'
        ? 'TBD credits'
        : '~$0.05'

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderSeedanceParams = () => (
    <div className="space-y-6">
      {/* Script */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#9CA3AF] font-medium">Script</label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={4}
          className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm resize-none focus:border-[#2A7B88]"
          placeholder="The narration / action script..."
        />
      </div>

      {/* Character controls */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">
          Character
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <SliderControl label="Age" min={18} max={65} step={1} value={age} onChange={setAge} suffix=" yrs" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#9CA3AF] font-medium">Gender</label>
            <div className="flex gap-2">
              {(['female', 'male'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    gender === g
                      ? 'bg-[#D4A843] text-[#111827]'
                      : 'bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88]'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#9CA3AF] font-medium">Hair</label>
            <input
              type="text" value={hair} onChange={(e) => setHair(e.target.value)}
              placeholder="e.g. long brunette"
              className="bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#2A7B88]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#9CA3AF] font-medium">Skin</label>
            <input
              type="text" value={skin} onChange={(e) => setSkin(e.target.value)}
              placeholder="e.g. olive"
              className="bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#2A7B88]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#9CA3AF] font-medium">Wardrobe</label>
            <input
              type="text" value={wardrobe} onChange={(e) => setWardrobe(e.target.value)}
              placeholder="e.g. black blazer"
              className="bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2 text-[#E5E7EB] text-sm focus:border-[#2A7B88]"
            />
          </div>
        </div>
      </div>

      {/* Scene controls */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">
          Scene
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <Dropdown label="Setting" options={SETTINGS} value={setting} onChange={setSetting} />
          <Dropdown label="Camera" options={CAMERAS} value={camera} onChange={setCamera} />
          <Dropdown label="Lighting" options={LIGHTING} value={lighting} onChange={setLighting} />
        </div>
      </div>

      {/* Output controls */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">
          Output
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <SliderControl label="Duration" min={4} max={15} step={1} value={duration} onChange={setDuration} suffix="s" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#9CA3AF] font-medium">Aspect Ratio</label>
            <div className="flex gap-2">
              {(['9:16', '16:9'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    aspectRatio === r
                      ? 'bg-[#D4A843] text-[#111827]'
                      : 'bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Dropdown
            label="Influencer"
            options={['Auto-select', 'Luna', 'Maya', 'Zara', 'Kai', 'Leo', 'Nina', 'Aria', 'Jax', 'Mila', 'Sage', 'Nova', 'Rex', 'Ivy']}
            value={influencer}
            onChange={setInfluencer}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[#9CA3AF] font-medium">High Realism</label>
          <button
            onClick={() => setRealism(!realism)}
            className={`relative w-11 h-6 rounded-full transition-all ${
              realism ? 'bg-[#D4A843]' : 'bg-[#1B2A4A] border border-[#2A7B88]/30'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                realism ? 'left-5.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )

  const renderVoiceParams = () => (
    <div className="space-y-6">
      {/* Script */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#9CA3AF] font-medium">Script</label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={5}
          className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded-lg px-3 py-2.5 text-[#E5E7EB] text-sm resize-none focus:border-[#2A7B88]"
          placeholder="Your ad script..."
        />
      </div>

      {/* Tagged script preview */}
      {script.trim() && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#9CA3AF] font-medium">Script Preview</label>
          <div className="bg-[#111827] border border-[#2A7B88]/15 rounded-lg p-3 text-sm text-[#E5E7EB] leading-relaxed">
            <span className="inline-block bg-[#2A7B88]/20 text-[#2A7B88] text-xs font-mono px-1.5 py-0.5 rounded mr-2">
              {emotion}
            </span>
            {script}
          </div>
        </div>
      )}

      {/* Emotion tags */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#9CA3AF] font-medium">Emotion Tag</label>
        <div className="flex flex-wrap gap-2">
          {EMOTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setEmotion(e)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                emotion === e
                  ? 'bg-[#D4A843] text-[#111827]'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88] hover:text-[#E5E7EB]'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Voice controls */}
      <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">
          Voice
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <SliderControl
            label="Temperature" min={0} max={1} step={0.05}
            value={voiceTemp} onChange={setVoiceTemp}
          />
          <SliderControl
            label="Speed" min={0.5} max={2.0} step={0.05}
            value={voiceSpeed} onChange={setVoiceSpeed} suffix="x"
          />
        </div>
      </div>

      {/* Face upload for fal path */}
      {selectedPath === 'fal' && (
        <div className="border border-[#2A7B88]/15 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-[#D4A843] uppercase tracking-wider">
            Face Image
          </h4>
          {faceImagePreview ? (
            <div className="relative inline-block">
              <img
                src={faceImagePreview}
                alt="Face preview"
                className="w-32 h-32 object-cover rounded-xl border-2 border-[#2A7B88]/30"
              />
              <button
                onClick={() => { setFaceImage(null); setFaceImagePreview(null) }}
                className="absolute -top-2 -right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#D4A843] bg-[#D4A843]/5'
                  : 'border-[#2A7B88]/30 hover:border-[#2A7B88]'
              }`}
              onClick={() => document.getElementById('face-upload')?.click()}
            >
              <Upload className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
              <p className="text-sm text-[#9CA3AF]">
                Drop a face image here, or click to browse
              </p>
              <p className="text-xs text-[#9CA3AF]/60 mt-1">PNG, JPG up to 5MB</p>
              <input
                id="face-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── Main Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Header */}
      <header className="border-b border-[#2A7B88]/20 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4A843] to-[#2A7B88] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-[#E5E7EB]">
              BNB Success
              <span className="text-[#9CA3AF] font-normal mx-2">·</span>
              <span className="text-[#D4A843]">UGC Content Studio</span>
            </h1>
          </div>
          {selectedPath && (
            <button
              onClick={() => { setSelectedPath(null); handleReset() }}
              className="text-sm text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors"
            >
              Switch Path
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Path Selector ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4">
            Production Path
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PATHS.map((p) => {
              const Icon = p.icon
              const isActive = selectedPath === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPath(p.id)}
                  className={`group relative text-left rounded-xl p-5 border transition-all duration-200 ${
                    isActive
                      ? 'bg-[#1B2A4A] border-[#D4A843]/60 shadow-lg shadow-[#D4A843]/5'
                      : 'bg-[#1B2A4A]/60 border-[#2A7B88]/20 hover:border-[#2A7B88]/50 hover:bg-[#1B2A4A]'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#D4A843] animate-pulse" />
                  )}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all ${
                    isActive ? 'bg-[#D4A843]/20' : 'bg-[#2A7B88]/15 group-hover:bg-[#2A7B88]/25'
                  }`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#D4A843]' : 'text-[#2A7B88]'}`} />
                  </div>
                  <h3 className={`font-semibold mb-0.5 ${isActive ? 'text-[#D4A843]' : 'text-[#E5E7EB]'}`}>
                    {p.title}
                  </h3>
                  <p className="text-xs text-[#9CA3AF] mb-2">{p.subtitle}</p>
                  <p className="text-sm text-[#9CA3AF]/80 mb-3">{p.description}</p>
                  <div className="flex gap-3 text-xs text-[#9CA3AF]/60">
                    <span>{p.timing}</span>
                    <span className="text-[#2A7B88]/40">|</span>
                    <span>{p.cost}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Brain Dump ────────────────────────────────────────────────── */}
        {selectedPath && !parameters && !result && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4">
              Brain Dump
            </h2>
            <textarea
              value={brainDump}
              onChange={(e) => setBrainDump(e.target.value)}
              rows={6}
              placeholder={BRAIN_DUMP_PLACEHOLDERS[selectedPath]}
              className="w-full bg-[#111827] border border-[#2A7B88]/30 rounded-xl px-4 py-3 text-[#E5E7EB] text-sm resize-none focus:border-[#2A7B88] placeholder:text-[#9CA3AF]/40 leading-relaxed"
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={handleFormulate}
                disabled={!brainDump.trim() || isFormulating}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  brainDump.trim() && !isFormulating
                    ? 'bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 shadow-lg shadow-[#D4A843]/20'
                    : 'bg-[#1B2A4A] text-[#9CA3AF]/40 cursor-not-allowed'
                }`}
              >
                {isFormulating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Formulating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Formulate
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* ── Parameter Panel ───────────────────────────────────────────── */}
        {parameters && !result && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Parameters
              </h2>
              <button
                onClick={() => setParameters(null)}
                className="text-xs text-[#9CA3AF] hover:text-[#D4A843] transition-colors"
              >
                Back to Brain Dump
              </button>
            </div>

            {selectedPath === 'seedance' ? renderSeedanceParams() : renderVoiceParams()}
          </section>
        )}

        {/* ── Generate Button ───────────────────────────────────────────── */}
        {parameters && !result && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6">
            {/* Status bar */}
            {generationStatus && isGenerating && (
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[#9CA3AF]">
                    {generationStatus.status}
                  </span>
                  <span className="text-sm font-mono text-[#D4A843]">
                    {Math.round(generationStatus.progress)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#111827] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2A7B88] to-[#D4A843] rounded-full transition-all duration-500"
                    style={{ width: `${generationStatus.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error state */}
            {generationStatus && !isGenerating && !result && generationStatus.status.toLowerCase().includes('error') && (
              <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {generationStatus.status}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-[#9CA3AF]">
                Estimated cost:{' '}
                <span className="text-[#D4A843] font-semibold">{creditEstimate}</span>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !script.trim()}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all ${
                  !isGenerating && script.trim()
                    ? 'bg-gradient-to-r from-[#D4A843] to-[#D4A843]/80 text-[#111827] hover:shadow-lg hover:shadow-[#D4A843]/25'
                    : 'bg-[#1B2A4A] text-[#9CA3AF]/40 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Video'
                )}
              </button>
            </div>
          </section>
        )}

        {/* ── Result Viewer ─────────────────────────────────────────────── */}
        {result && (
          <section className="bg-[#1B2A4A]/60 border border-[#2A7B88]/20 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">
              Result
            </h2>

            {/* Video player */}
            <div className="relative rounded-xl overflow-hidden bg-black max-w-lg mx-auto">
              <video
                ref={videoRef}
                src={result.videoUrl}
                className="w-full"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                controls={false}
                muted={isMuted}
              />
              {/* Custom overlay controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      isPlaying ? videoRef.current.pause() : videoRef.current.play()
                    }
                  }}
                  className="text-white hover:text-[#D4A843] transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-white hover:text-[#D4A843] transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <a
                href={result.videoUrl}
                download
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#D4A843] text-[#111827] hover:bg-[#D4A843]/90 transition-all shadow-lg shadow-[#D4A843]/20"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#111827] text-[#9CA3AF] border border-[#2A7B88]/30 hover:border-[#2A7B88] hover:text-[#E5E7EB] transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Generate Another
              </button>
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A7B88]/10 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center">
          <p className="text-xs text-[#9CA3AF]/40">
            BNB Success UGC Content Studio
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
