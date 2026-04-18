import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import {
  CheckCircle2,
  Calendar,
  ShieldCheck,
  Zap,
  ArrowRight,
  Play,
  RotateCcw,
  Check,
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  Baby,
  User,
  GraduationCap,
  Users,
  Plus,
  Church,
  MapPin,
  Shirt,
  ChevronDown,
  CreditCard,
  DollarSign,
  SkipBack,
  SkipForward,
  Utensils,
  Info,
  Lock,
  Mail,
  Phone,
  Minimize2,
  Maximize2,
} from 'lucide-react'
import { askGeminiChat, generateTtsWavObjectUrl, hasGeminiApiKey } from './api/gemini'
import {
  PHASES,
  FINAL_STEP,
  CHURCH_LIST,
  AGE_RANGES,
  GRADE_LEVELS_YOUTH,
  GRADE_LEVELS_ADULT,
  CHILD_GROUPS,
  ATTENDANCE_TYPES,
  CONFERENCE_DAYS,
  MEAL_SLOTS,
  MEAL_PRICE_ADULT,
  MEAL_PRICE_CHILD,
  ADULT_DAILY_PRICE,
  KOTE_PRICE_PER_DAY,
  FULL_CONFERENCE_PRICE_ADULT,
  FULL_CONFERENCE_PRICE_CHILD,
  FULL_CONFERENCE_MEAL_COUNT,
  FULL_CONFERENCE_DAYS,
  CAMPUS_INSURANCE_PER_DAY,
  FULL_CONFERENCE_INSURANCE_TOTAL,
  PROCESSING_FEE_RATE,
  PROCESSING_FEE_FIXED,
} from './data/tutorialConstants'

// The church the tutorial picks at step 17 (demonstrates city auto-fill)
const PICKED_CHURCH = 'Ethiopian Evangelical Christian Church in Austin'
const PICKED_CITY = 'Austin, TX'

const EVENT_IMAGE =
  'https://fellowflow.online/_next/image?url=https%3A%2F%2Fcjvbvdzfijqhnrrbzuhl.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fevent-images%2F20bad896-a715-4519-a533-62dd64f7233c%2F1772832661085-enssjb.jpg&w=1920&q=75'

export default function FellowFlowTutorial() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [, setCurrentTime] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [subtitle, setSubtitle] = useState('Click Play to begin presentation')
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0)
  const phaseSourcesRef = useRef({}) // { [phaseId]: blobUrl | localUrl }
  const phaseTimelineRef = useRef({}) // { [phaseId]: { duration, events: [{step, text, pct}] } }
  const requestRef = useRef()
  const audioRef = useRef(null)

  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [voiceError, setVoiceError] = useState(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I am the FellowFlow AI. Any questions about the dynamic form UI?',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [viewMode, setViewMode] = useState('container') // 'container' | 'fullscreen'
  const [hasStarted, setHasStarted] = useState(false) // Splash/thumbnail dismissed
  const ENABLE_CHAT = false // Feature flag — hide AI chat until ready for production

  const geminiConfigured = hasGeminiApiKey()

  useEffect(() => {
    const sources = phaseSourcesRef.current
    return () => {
      cancelAnimationFrame(requestRef.current)
      // Revoke any blob URLs created for TTS fallback
      Object.values(sources).forEach((url) => {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
    }
  }, [])

  const formState = useMemo(() => {
    const r1 = {
      active: false,
      firstName: '',
      lastName: '',
      service: '',
      ageRange: '',
      group: '',
      grade: '',
      gender: '',
      church: '',
      city: '',
      cityAutoFilled: false,
      shirt: 'No preference',
      attendanceType: '',
      days: [],
      meals: {},
    }
    let focus = null
    let openDropdown = null

    if (currentStep >= 7) {
      r1.active = true
      r1.service = 'english'
      focus = 'service'
    }
    if (currentStep >= 8) {
      r1.service = 'amharic'
      focus = 'age_ranges'
    }
    if (currentStep >= 9) {
      r1.service = 'english'
      focus = 'service_group_container'
    }

    // Demonstrate service groups for each age range under English
    if (currentStep === 10) {
      r1.ageRange = 'child'
      focus = 'service_group_container'
    }
    if (currentStep === 11) {
      r1.ageRange = 'youth'
      focus = 'service_group_container'
      openDropdown = 'grade_youth'
    }
    if (currentStep === 12) {
      r1.ageRange = 'adult'
      focus = 'service_group_container'
      openDropdown = 'grade_adult'
    }

    // Enter primary attendee data
    if (currentStep >= 13) {
      r1.firstName = 'Test'
      r1.lastName = 'User'
      focus = 'names'
      openDropdown = null
    }
    if (currentStep >= 14) {
      r1.service = 'amharic'
      r1.ageRange = 'adult'
      r1.grade = ''
      focus = 'amharic_adult'
    }
    if (currentStep === 15) {
      focus = 'gender'
      openDropdown = 'gender'
    }
    if (currentStep >= 16) {
      r1.gender = 'Male'
      focus = 'gender'
      openDropdown = null
    }
    if (currentStep === 17) {
      focus = 'church'
      openDropdown = 'church'
    }
    if (currentStep >= 18) {
      r1.church = PICKED_CHURCH
      r1.city = PICKED_CITY
      r1.cityAutoFilled = true
      focus = 'city'
      openDropdown = null
    }
    if (currentStep >= 19) {
      r1.shirt = 'L'
      focus = 'shirt'
    }

    // ===== Part 3: Full & Partial =====
    if (currentStep >= 20) {
      r1.attendanceType = ''
      r1.days = []
      r1.meals = {}
      focus = 'attendance'
      openDropdown = null
    }
    if (currentStep >= 21) {
      r1.attendanceType = 'full'
    }
    if (currentStep >= 23) {
      r1.attendanceType = 'partial'
      r1.days = []
      r1.meals = {}
      focus = 'attendance'
    }
    if (currentStep >= 24) {
      r1.days = ['fri', 'sat', 'sun']
      // Auto-select all meals for all picked days (Partial behavior)
      r1.meals = {
        fri: ['breakfast', 'lunch', 'dinner'],
        sat: ['breakfast', 'lunch', 'dinner'],
        sun: ['breakfast', 'lunch'],
      }
      focus = 'days'
    }
    if (currentStep >= 25) {
      focus = 'meals'
    }
    if (currentStep >= 26) {
      // Unselect Friday Breakfast
      r1.meals = { ...r1.meals, fri: ['lunch', 'dinner'] }
    }
    if (currentStep >= 27) {
      // Unselect Friday Lunch too
      r1.meals = { ...r1.meals, fri: ['dinner'] }
    }

    // ===== Part 4: Kote =====
    if (currentStep >= 28) {
      r1.attendanceType = 'kote'
      r1.days = []
      r1.meals = {} // Kote does NOT auto-select meals
      focus = 'attendance'
    }
    if (currentStep >= 29) {
      r1.days = ['sat', 'sun']
      focus = 'days'
    }
    if (currentStep >= 30) {
      focus = 'meals'
    }
    if (currentStep >= 31) {
      r1.meals = { ...r1.meals, sat: ['breakfast', 'lunch', 'dinner'] }
    }
    if (currentStep >= 32) {
      r1.meals = { ...r1.meals, sun: ['breakfast', 'lunch'] }
    }

    // ===== Part 5: Child registration (r2) =====
    if (currentStep >= 34 && currentStep < 35) {
      focus = 'add_person'
    }
    const r2 = {
      visible: currentStep >= 34,
      firstName: '',
      lastName: '',
      service: '',
      ageRange: '',
      group: '',
      gender: '',
      church: '',
      city: '',
      cityAutoFilled: false,
      shirt: 'No preference',
      attendanceType: 'full',
      sharesBedWithParent: false,
    }

    if (currentStep >= 35) {
      r2.firstName = 'Child'
      r2.lastName = 'Child'
      r2.service = 'english'
      focus = 'r2_names'
    }
    if (currentStep >= 36) {
      r2.ageRange = 'child'
      r2.group = 'children'
      focus = 'r2_age'
    }
    if (currentStep >= 37) {
      r2.gender = 'Male'
      r2.shirt = 'L'
      r2.church = 'Ethiopian Evangelical Christian Church in Austin'
      r2.city = 'Austin, TX'
      r2.cityAutoFilled = true
      focus = 'r2_gender'
    }
    if (currentStep >= 38) {
      focus = 'r2_share_bed'
    }
    if (currentStep >= 39) {
      r2.sharesBedWithParent = true
      focus = 'price_summary'
    }

    // ===== Part 6: Infant registration (r3) =====
    if (currentStep >= 40 && currentStep < 41) {
      focus = 'add_person'
    }
    const r3 = {
      visible: currentStep >= 40,
      firstName: '',
      lastName: '',
      service: 'english',
      ageRange: '',
      gender: 'Female',
      church: 'Ethiopian Evangelical Christian Church in Austin',
      city: 'Austin, TX',
      cityAutoFilled: true,
      shirt: 'No preference',
      attendanceType: 'full',
    }

    if (currentStep >= 41) {
      r3.firstName = 'Infant'
      r3.lastName = 'Infant'
      r3.ageRange = 'infant'
      focus = 'r3_names'
    }
    if (currentStep >= 42) {
      focus = 'r3_age'
    }
    if (currentStep >= 43) {
      focus = 'price_summary'
    }

    // ===== Part 7: Contact / Review / Checkout =====
    let view = 'registrants'
    const contact = { email: '', phone: '' }
    let paymentMethod = 'card'

    if (currentStep >= 45) {
      focus = 'next_button'
    }
    if (currentStep >= 46) {
      view = 'contact'
      contact.email = 'test@fellowflow.com'
      contact.phone = '1234567890'
      focus = 'contact_fields'
    }
    if (currentStep >= 47) {
      view = 'review'
      focus = 'proceed_payment'
    }
    if (currentStep >= 48) {
      view = 'checkout'
      focus = 'stripe_methods'
    }
    if (currentStep >= 49) {
      view = 'success'
      focus = null
    }
    // ===== Part 8: Digital Badges & Mobile Wallet =====
    if (currentStep >= 50) {
      view = 'receipt'
    }
    if (currentStep >= 51) {
      view = 'receipt'
      focus = 'apple_wallet_btn'
    }
    if (currentStep >= 52) {
      view = 'wallet_back'
    }
    if (currentStep >= 53) {
      view = 'wallet_back'
      focus = 'buy_meals_link'
    }
    if (currentStep >= 54) {
      view = 'email'
    }
    if (currentStep >= 55) {
      view = 'email'
      focus = 'printed_badge'
    }
    // ===== Part 9: Meal Ticket Top-ups =====
    // Drive mealSelected count + mealPurchased count based on step
    let mealSelected = 0
    let mealPurchased = 6
    if (currentStep >= 56) {
      view = 'meal_access'
      focus = 'meal_access_points'
    }
    if (currentStep >= 57) {
      view = 'meal_tickets'
      focus = 'meal_stats'
    }
    if (currentStep >= 58) {
      view = 'meal_tickets'
      focus = 'meal_select'
      mealSelected = 3
    }
    if (currentStep >= 59) {
      view = 'meal_checkout'
      focus = 'meal_stripe'
      mealSelected = 3
    }
    if (currentStep >= 60) {
      view = 'meal_tickets'
      focus = 'meal_updated'
      mealSelected = 0
      mealPurchased = 9 // newly-purchased meals integrated
    }

    if (currentStep >= FINAL_STEP) {
      openDropdown = null
    }

    return { r1, r2, r3, focus, openDropdown, view, contact, paymentMethod, mealSelected, mealPurchased }
  }, [currentStep])

  const getFocusClass = (targetFocus) => {
    if (
      formState.focus === targetFocus ||
      (Array.isArray(targetFocus) && targetFocus.includes(formState.focus))
    ) {
      return 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-slate-50 scale-[1.02] z-50 shadow-[0_10px_30px_rgba(16,185,129,0.25)] rounded-xl bg-white transition-all duration-[400ms] relative'
    }
    return 'transition-all duration-[400ms] relative z-10'
  }

  // Auto-scroll the currently highlighted element to the visual center of its
  // scrollable container, accounting for the fixed control bar at the bottom.
  // Focus highlights use ring-emerald-* utilities, so we query for them after a
  // short delay (to let the DOM apply the new classes).
  useEffect(() => {
    if (!formState.focus) return
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior = prefersReducedMotion ? 'auto' : 'smooth'

    // Reserve space at the bottom for the compact control bar and a little breathing room.
    const BOTTOM_SAFE_AREA = 90
    const TOP_SAFE_AREA = 24

    // Walk up the DOM to find the nearest scrollable ancestor.
    const findScrollContainer = (el) => {
      let node = el?.parentElement
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node)
        const oy = style.overflowY
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
          return node
        }
        node = node.parentElement
      }
      return null // falls through to window
    }

    const centerTarget = (target) => {
      const container = findScrollContainer(target)
      const targetRect = target.getBoundingClientRect()

      if (container) {
        // Center the target within the visible (safe) area of the internal scroll container.
        const containerRect = container.getBoundingClientRect()
        const visibleHeight = containerRect.height - BOTTOM_SAFE_AREA - TOP_SAFE_AREA
        const targetCenter = targetRect.top - containerRect.top + targetRect.height / 2
        const desiredCenter = TOP_SAFE_AREA + visibleHeight / 2
        const delta = targetCenter - desiredCenter
        if (Math.abs(delta) > 4) {
          container.scrollBy({ top: delta, left: 0, behavior })
        }
      } else {
        // No internal scroll container — center in the viewport.
        const vh = window.innerHeight
        const visibleHeight = vh - BOTTOM_SAFE_AREA - TOP_SAFE_AREA
        const targetCenter = targetRect.top + targetRect.height / 2
        const desiredCenter = TOP_SAFE_AREA + visibleHeight / 2
        const delta = targetCenter - desiredCenter
        if (Math.abs(delta) > 4) {
          window.scrollBy({ top: delta, left: 0, behavior })
        }
      }
    }

    const t = setTimeout(() => {
      // Match any element whose class list contains a `ring-emerald-` focus highlight.
      const candidates = document.querySelectorAll(
        '[class*="ring-emerald-400"], [class*="ring-emerald-500"]'
      )
      // Prefer the last match (most nested/specific) which tends to be the inner focused field.
      const target = candidates[candidates.length - 1]
      if (!target) return
      centerTarget(target)
    }, 200)
    return () => clearTimeout(t)
  }, [formState.focus, formState.view, currentStep])

  const askGemini = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setChatInput('')
    setIsTyping(true)

    try {
      const { text } = await askGeminiChat(userMsg)
      setChatMessages((prev) => [...prev, { role: 'assistant', content: text }])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error answering your question.' },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  // ===== Multi-phase audio playback =====

  // Try cached /voiceover-<id>.wav; else call Gemini TTS. Caches by phase id.
  const resolvePhaseAudio = async (phase) => {
    const cached = phaseSourcesRef.current[phase.id]
    if (cached) return cached

    // 1. Check for a pre-generated local file
    try {
      const res = await fetch(phase.audioFile, { method: 'HEAD' })
      if (res.ok) {
        phaseSourcesRef.current[phase.id] = phase.audioFile
        return phase.audioFile
      }
    } catch {
      /* file not available, fall through to TTS */
    }

    // 2. Fall back to live TTS generation
    if (!hasGeminiApiKey()) return null
    const { blobUrl, error } = await generateTtsWavObjectUrl(phase.script)
    if (error || !blobUrl) {
      setVoiceError(error || 'Voice generation failed')
      return null
    }
    phaseSourcesRef.current[phase.id] = blobUrl
    return blobUrl
  }

  // Try to load the sidecar timeline (voiceover-<id>.json) produced by the
  // generator's Gemini audio-understanding pass. If present it provides real
  // per-sentence timestamps; otherwise we fall back to the hand-tuned pcts
  // defined on the phase itself.
  const loadPhaseTimeline = async (phase) => {
    if (phaseTimelineRef.current[phase.id]) return phaseTimelineRef.current[phase.id]
    const jsonPath = phase.audioFile.replace(/\.wav$/, '.json')
    try {
      const res = await fetch(jsonPath, { cache: 'force-cache' })
      if (!res.ok) return null
      const data = await res.json()
      if (Array.isArray(data?.events) && data.events.length > 0) {
        phaseTimelineRef.current[phase.id] = data
        return data
      }
    } catch {
      // ignore — fall back to hardcoded
    }
    return null
  }

  // Compute step (visual) + subtitle (text) based on elapsed time. When the
  // generator produced a sidecar, each event may carry TWO timestamps:
  //   pct         → when the visual/CSS transform should fire (may be earlier)
  //   subtitlePct → when the subtitle text should appear (tied to voice)
  // This split keeps slide transitions crisp (pre-starting to account for
  // their 1200ms CSS duration) while subtitles stay locked to the voice.
  const tickAnimation = (phaseIdx, elapsedPct) => {
    const phase = PHASES[phaseIdx]
    const timeline = phaseTimelineRef.current[phase.id]
    const events = timeline?.events?.length ? timeline.events : phase.events

    // Visual step uses `pct` (possibly lead-adjusted)
    let visualEvt = events[0]
    for (let i = events.length - 1; i >= 0; i--) {
      if (elapsedPct >= events[i].pct) {
        visualEvt = events[i]
        break
      }
    }

    // Subtitle uses `subtitlePct` when available, else falls back to `pct`
    let subtitleEvt = events[0]
    for (let i = events.length - 1; i >= 0; i--) {
      const cue = events[i].subtitlePct ?? events[i].pct
      if (elapsedPct >= cue) {
        subtitleEvt = events[i]
        break
      }
    }

    setCurrentStep(visualEvt.step)
    setSubtitle(subtitleEvt.text)
  }

  const animate = (phaseIdx) => {
    const el = audioRef.current
    if (!el) return
    const phase = PHASES[phaseIdx]
    const duration = el.duration && isFinite(el.duration) ? el.duration : phase.fallbackMs / 1000
    const elapsedPct = Math.min(1, el.currentTime / duration)
    setCurrentTime(el.currentTime * 1000)
    tickAnimation(phaseIdx, elapsedPct)
    if (!el.paused && !el.ended) {
      requestRef.current = requestAnimationFrame(() => animate(phaseIdx))
    }
  }

  const fallbackAnimate = (phaseIdx) => {
    const phase = PHASES[phaseIdx]
    let startTs = null
    const loop = (time) => {
      if (startTs === null) startTs = time
      const elapsed = time - startTs
      const elapsedPct = Math.min(1, elapsed / phase.fallbackMs)
      setCurrentTime(elapsed)
      tickAnimation(phaseIdx, elapsedPct)
      if (elapsedPct < 1) {
        requestRef.current = requestAnimationFrame(loop)
      } else {
        advanceOrFinish(phaseIdx)
      }
    }
    requestRef.current = requestAnimationFrame(loop)
  }

  // Play a specific phase (0..PHASES.length-1). Handles audio load + play.
  const playPhase = async (phaseIdx) => {
    const phase = PHASES[phaseIdx]
    if (!phase) return
    setCurrentPhaseIdx(phaseIdx)
    setVoiceError(null)

    // Kick off sidecar timeline load in parallel with audio resolution.
    // First-time request caches into phaseTimelineRef for subsequent ticks.
    const timelinePromise = loadPhaseTimeline(phase)
    setIsGeneratingAudio(!phaseSourcesRef.current[phase.id])
    const [sourceUrl] = await Promise.all([
      resolvePhaseAudio(phase).catch((err) => {
        console.error('TTS phase load failed:', err)
        setVoiceError(err?.message || 'Voice generation failed')
        return null
      }),
      timelinePromise,
    ])
    setIsGeneratingAudio(false)

    if (sourceUrl && audioRef.current) {
      audioRef.current.src = sourceUrl
      audioRef.current.currentTime = 0
      try {
        await audioRef.current.play()
        setIsPlaying(true)
        requestRef.current = requestAnimationFrame(() => animate(phaseIdx))
      } catch (err) {
        console.error('Playback error:', err)
        // Fall through to timed fallback
        setIsPlaying(true)
        fallbackAnimate(phaseIdx)
      }
    } else {
      // No audio available — use timed fallback
      setIsPlaying(true)
      fallbackAnimate(phaseIdx)
    }
  }

  // When a phase finishes, auto-advance to next phase or mark presentation complete.
  const advanceOrFinish = (finishedIdx) => {
    cancelAnimationFrame(requestRef.current)
    const next = finishedIdx + 1
    if (next < PHASES.length) {
      playPhase(next)
    } else {
      setIsPlaying(false)
      setCurrentStep(FINAL_STEP)
      const lastPhase = PHASES[PHASES.length - 1]
      setSubtitle(lastPhase.events[lastPhase.events.length - 1].text)
    }
  }

  // Jump to a specific phase index — stops current playback and starts the target
  const skipToPhase = async (phaseIdx) => {
    if (phaseIdx < 0 || phaseIdx >= PHASES.length) return
    audioRef.current?.pause()
    cancelAnimationFrame(requestRef.current)
    setIsPlaying(false)
    // Reset visual state to the first step of the target phase
    const firstStep = PHASES[phaseIdx].events[0]?.step ?? 0
    setCurrentStep(firstStep)
    setSubtitle(PHASES[phaseIdx].events[0]?.text ?? '')
    await playPhase(phaseIdx)
  }

  const togglePlay = async () => {
    if (!hasStarted) setHasStarted(true)
    if (isPlaying) {
      audioRef.current?.pause()
      cancelAnimationFrame(requestRef.current)
      setIsPlaying(false)
      return
    }

    // Replay from the beginning if presentation completed
    const finished = currentStep >= FINAL_STEP
    if (finished) {
      setCurrentTime(0)
      setCurrentStep(0)
      setSubtitle('Click Play to begin presentation')
      await playPhase(0)
      return
    }

    // Resume current phase if paused mid-way
    if (audioRef.current?.src && audioRef.current.currentTime > 0 && !audioRef.current.ended) {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
        const resumeIdx = currentPhaseIdx
        requestRef.current = requestAnimationFrame(() => animate(resumeIdx))
      } catch (err) {
        console.error('Resume error:', err)
      }
      return
    }

    // Fresh start
    await playPhase(0)
  }

  return (
    <div
      className={
        viewMode === 'fullscreen'
          ? 'h-screen w-screen bg-[#f8fafc] font-sans text-slate-900'
          : 'min-h-screen w-full font-sans text-slate-900 bg-[radial-gradient(1200px_800px_at_10%_-10%,rgba(99,102,241,0.08),transparent),radial-gradient(1000px_700px_at_110%_110%,rgba(16,185,129,0.08),transparent),linear-gradient(135deg,#e2e8f0,#cbd5e1)] p-3 md:p-5 flex items-center justify-center'
      }
    >
      <div
        className={
          viewMode === 'fullscreen'
            ? 'relative h-full w-full bg-[#f8fafc] overflow-hidden'
            : 'relative w-full max-w-[1480px] h-[calc(100vh-1.5rem)] md:h-[calc(100vh-2.5rem)] bg-[#f8fafc] overflow-hidden rounded-[28px] shadow-[0_30px_90px_-20px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] ring-1 ring-black/5'
        }
      >
      <audio ref={audioRef} onEnded={() => advanceOrFinish(currentPhaseIdx)} />

      <div
        className="h-[300vh] w-full transition-transform duration-[1200ms] ease-[cubic-bezier(0.65,0,0.35,1)] flex flex-col"
        style={{
          transform:
            currentStep >= 7 ? 'translateY(-200vh)' : currentStep >= 5 ? 'translateY(-100vh)' : 'translateY(0)',
        }}
      >
        {/* SLIDE 1: Hero */}
        <div className="h-screen w-full flex-shrink-0 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-white to-slate-50">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
          <div className="max-w-7xl w-full px-8 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
            <div className="z-10 relative">
              <div
                className={`transition-all duration-1000 delay-100 ${currentStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              >
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase mb-6 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Registration Open
                </div>
                <h1 className="text-5xl md:text-[64px] font-extrabold text-[#0a2540] leading-[1.05] tracking-tight">
                  Conference <br />
                  Registration <br />
                  <span
                    className={`inline-block transition-all duration-1000 text-[#21a560] ${currentStep >= 4 ? 'drop-shadow-sm scale-[1.02] origin-left' : ''}`}
                  >
                    Made Effortless
                  </span>
                </h1>
              </div>
              <div
                className={`transition-all duration-1000 delay-300 ${currentStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              >
                <p className="mt-6 text-[17px] text-slate-500 max-w-md leading-relaxed font-medium">
                  From sign-up to confirmation in{' '}
                  <strong className="text-slate-800 border-b-2 border-emerald-200">under 2 minutes</strong>. Smart
                  pricing, secure payments, and instant receipts — all in one seamless flow.
                </p>
                <div className="mt-10 flex flex-wrap gap-6 text-xs text-slate-500 font-bold uppercase tracking-wide">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#21a560]" />
                    256-bit SSL
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Instant Confirmation
                  </div>
                </div>
              </div>
            </div>

            <div className="relative h-[600px] hidden lg:flex items-center justify-center w-full [perspective:1000px]">
              <div
                className={`absolute w-80 h-80 bg-gradient-to-tr from-emerald-300/40 to-teal-100/40 rounded-full blur-[80px] -top-10 -right-10 transition-all duration-[1500ms] ${currentStep >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
              />
              <div
                className={`absolute w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-300/20 rounded-full blur-[80px] bottom-0 -left-10 transition-all duration-[1500ms] delay-500 ${currentStep >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
              />

              <div
                className={`relative z-10 w-full max-w-[450px] bg-white border border-slate-200 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-2xl overflow-hidden transform transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentStep >= 3 ? 'translate-y-0 opacity-100 [transform:rotateY(-5deg)_rotateX(2deg)]' : 'translate-y-20 opacity-0'}`}
              >
                <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mx-auto bg-white border border-slate-200 rounded-md text-[10px] text-slate-400 px-8 py-1 font-mono flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> fellowflow.online/register
                  </div>
                </div>

                <div className="p-6 bg-slate-50 h-[400px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#0a2540] rounded flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                      FellowFlow
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-200" />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-10 bg-slate-50 border border-slate-200 rounded-md" />
                      <div className="h-10 bg-slate-50 border border-slate-200 rounded-md" />
                    </div>
                    <div className="h-10 bg-slate-50 border border-slate-200 rounded-md w-full" />
                    <div className="h-10 bg-[#0a2540] rounded-md w-full mt-4 flex items-center justify-center text-white text-xs font-bold shadow-md">
                      Complete Registration
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`absolute z-20 top-32 -left-12 bg-white px-5 py-3 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 transform transition-all duration-1000 delay-[600ms] ${currentStep >= 4 ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 tracking-tight">Verified</span>
                  <span className="text-xs font-medium text-slate-400">All data secured</span>
                </div>
              </div>

              <div
                className={`absolute z-20 bottom-32 -right-8 bg-white px-5 py-3 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 transform transition-all duration-1000 delay-[900ms] ${currentStep >= 4 ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 tracking-tight">Fast Checkout</span>
                  <span className="text-xs font-medium text-slate-400">Stripe Integration</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 2: Event */}
        <div className="h-screen w-full flex-shrink-0 flex flex-col items-center justify-center bg-white relative">
          <div
            className={`transition-all duration-1000 w-full max-w-4xl px-6 ${currentStep >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl font-extrabold text-[#0a2540] tracking-tight">Upcoming Event</h2>
              <div className="w-16 h-1 bg-[#21a560] rounded-full mx-auto mt-4" />
            </div>

            <div
              className={`bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-full transition-all duration-1000 delay-300 ${currentStep >= 6 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            >
              <div className="h-[320px] w-full relative overflow-hidden group">
                <img
                  src={EVENT_IMAGE}
                  alt="Midwest Conference 2026"
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                <div className="absolute top-5 left-5">
                  <div className="bg-white/95 backdrop-blur-md text-[#0a2540] px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#21a560] animate-pulse" /> Registration Open
                  </div>
                </div>
                <div className="absolute bottom-5 left-8">
                  <h3 className="text-4xl font-black text-white drop-shadow-md tracking-tight">Midwest Conference 2026</h3>
                </div>
              </div>

              <div className="p-8 md:p-10 bg-white">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                  <div className="flex-1">
                    <p className="text-slate-500 text-lg leading-relaxed">
                      Join us for the annual Midwest Fellowship Conference. A time of deep worship, profound teaching,
                      and renewing community bonds.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-4">
                      <div className="flex items-center gap-2.5 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <Calendar className="w-4 h-4 text-[#21a560]" /> Jul 30 - Aug 2, 2026
                      </div>
                      <div className="flex items-center gap-2.5 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <MapPin className="w-4 h-4 text-blue-500" /> Kansas City, MO
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`flex-shrink-0 w-full md:w-auto bg-[#0a2540] text-white px-10 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${currentStep >= 7 ? 'shadow-[0_0_0_4px_rgba(33,165,96,0.2)] scale-105 bg-[#113155]' : 'hover:bg-[#153b61] hover:shadow-xl'}`}
                  >
                    Register Now
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 3: Form */}
        <div className="h-screen w-full flex-shrink-0 bg-[#fafafa] overflow-y-auto">
          {(formState.view === 'registrants' || formState.view === 'contact' || formState.view === 'review') && (<>
          {/* Event banner strip */}
          <div className="relative h-40 w-full overflow-hidden">
            <img src={EVENT_IMAGE} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-slate-50/60 to-[#fafafa]" />
            <div className="absolute bottom-4 left-0 right-0 text-center px-6">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight drop-shadow-sm">
                Midwest Conference 2026
              </h2>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                Annual fellowship conference — join us for worship, teaching, and community.
              </p>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row gap-8 items-start pt-6 pb-32">
            <div className="flex-1 w-full max-w-3xl">
              {/* Stepper (dynamic) */}
              {(() => {
                const v = formState.view
                const stepperStages = [
                  { id: 'registrants', label: 'Registrants', activeOn: ['registrants'] },
                  { id: 'contact', label: 'Contact Info', activeOn: ['contact'] },
                  { id: 'review', label: 'Review', activeOn: ['review'] },
                ]
                const order = ['registrants', 'contact', 'review']
                const currentIdx = order.indexOf(v)
                return (
                  <div className="flex items-center justify-between mb-6 px-2 select-none">
                    {stepperStages.map((stage, i) => {
                      const isActive = stage.activeOn.includes(v)
                      const isDone = currentIdx > i
                      return (
                        <Fragment key={stage.id}>
                          <div className={`flex items-center gap-2.5 font-bold text-sm tracking-wide ${isActive ? 'text-[#0a2540]' : isDone ? 'text-[#21a560]' : 'text-slate-400 font-semibold'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                              isActive ? 'bg-[#0a2540] text-white shadow-md'
                              : isDone ? 'bg-[#21a560] text-white'
                              : 'bg-white border border-slate-200 text-slate-400'
                            }`}>
                              {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                            </div>
                            {stage.label}
                          </div>
                          {i < stepperStages.length - 1 && (
                            <div className={`h-px flex-1 mx-4 transition-colors ${isDone ? 'bg-[#21a560]' : 'bg-slate-200'}`} />
                          )}
                        </Fragment>
                      )
                    })}
                  </div>
                )
              })()}

              {formState.view === 'registrants' && (
              <div className="mb-5 px-2 flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Who is attending?</h1>
                  <p className="text-slate-500 mt-1 text-sm font-medium">
                    Add everyone you&apos;d like to register for Midwest Conference 2026
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold">
                  <Users className="w-3.5 h-3.5" /> {formState.r2.visible && formState.r3.visible ? 3 : formState.r2.visible ? 2 : 1}
                </div>
              </div>
              )}

              {formState.view === 'registrants' && formState.r1.active && (
                <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-200 mb-4">
                  {/* Simple person header */}
                  <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <span className="font-semibold text-slate-700 text-sm">
                      {formState.r1.firstName ? `${formState.r1.firstName} ${formState.r1.lastName}`.trim() : 'Person 1'}
                    </span>
                  </div>

                  <div className="p-6 md:p-7 space-y-5">
                    {/* Names */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                      <div className={`p-1 -m-1 ${getFocusClass('names')}`}>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={formState.r1.firstName}
                          placeholder="John"
                          className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 font-medium"
                        />
                      </div>
                      <div className={`p-1 -m-1 ${getFocusClass('names')}`}>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={formState.r1.lastName}
                          placeholder="Doe"
                          className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    {/* Service toggle (pill cards) */}
                    <div className={`p-1 -m-1 relative z-20 ${getFocusClass(['service', 'amharic_adult'])}`}>
                      <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                        Service <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {['amharic', 'english'].map((s) => {
                          const isActive = formState.r1.service === s
                          return (
                            <div
                              key={s}
                              className={`relative h-11 rounded-lg border bg-white flex items-center justify-center text-sm font-bold transition-all ${isActive ? 'border-[#0a2540] text-slate-900 shadow-sm' : 'border-slate-200 text-slate-500'}`}
                            >
                              {s === 'amharic' ? 'Amharic' : 'English'}
                              {isActive && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0a2540]" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Age Range — shown after service picked */}
                    {formState.r1.service && (
                      <div className={`p-1 -m-1 ${getFocusClass(['age_ranges', 'amharic_adult'])}`}>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                          Age Range <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {AGE_RANGES.map(({ id, label, age }) => {
                            const isActive = formState.r1.ageRange === id
                            const Icon =
                              id === 'infant' ? Baby : id === 'child' ? User : id === 'youth' ? GraduationCap : Users
                            return (
                              <div
                                key={id}
                                className={`relative flex flex-col items-center justify-center p-3 rounded-lg border bg-white transition-all ${isActive ? 'border-[#0a2540] shadow-[0_2px_10px_rgba(10,37,64,0.08)]' : 'border-slate-200'}`}
                              >
                                {isActive && (
                                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#0a2540]" />
                                )}
                                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-[#0a2540]' : 'text-slate-400'}`} />
                                <span className={`text-sm font-bold ${isActive ? 'text-[#0a2540]' : 'text-slate-700'}`}>
                                  {label}
                                </span>
                                <span className="text-[11px] text-slate-500 mt-0.5">{age}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Service Group / Grade-Level (English only) */}
                    {formState.r1.service === 'english' && formState.r1.ageRange === 'child' && (
                      <div className={`p-1 -m-1 ${getFocusClass('service_group_container')}`}>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                          Service Group <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {CHILD_GROUPS.map((g) => (
                            <div
                              key={g.id}
                              className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-200 bg-white"
                            >
                              <span className="text-sm font-bold text-slate-700">{g.label}</span>
                              <span className="text-[11px] text-slate-500 mt-0.5">{g.age}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {formState.r1.service === 'english' &&
                      (formState.r1.ageRange === 'youth' || formState.r1.ageRange === 'adult') && (
                        <div className={`p-1 -m-1 relative z-20 ${getFocusClass('service_group_container')}`}>
                          <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                            Grade / Level <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div
                              className={`w-full h-10 bg-white border rounded-lg px-3 flex items-center justify-between text-sm shadow-sm ${['grade_youth', 'grade_adult'].includes(formState.openDropdown) ? 'border-[#0a2540] ring-2 ring-[#0a2540]/10' : 'border-slate-300'}`}
                            >
                              <span className="font-medium text-slate-500">
                                {formState.r1.grade || 'Select grade...'}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-slate-400 transition-transform ${['grade_youth', 'grade_adult'].includes(formState.openDropdown) ? 'rotate-180' : ''}`}
                              />
                            </div>
                            <div
                              className={`absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] py-2 transition-all duration-200 origin-top ${['grade_youth', 'grade_adult'].includes(formState.openDropdown) ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 pointer-events-none'}`}
                            >
                              {(formState.r1.ageRange === 'adult' ? GRADE_LEVELS_ADULT : GRADE_LEVELS_YOUTH).map((g) => (
                                <div
                                  key={g}
                                  className="px-4 py-2 text-sm text-slate-700 font-medium cursor-pointer hover:bg-slate-50"
                                >
                                  {g}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Gender */}
                    <div className={`p-1 -m-1 relative z-20 ${getFocusClass('gender')}`}>
                      <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <div className="relative w-full sm:w-[200px]">
                        <div
                          className={`w-full h-10 bg-white border rounded-lg px-3 flex items-center justify-between text-sm shadow-sm ${formState.openDropdown === 'gender' ? 'border-[#0a2540] ring-2 ring-[#0a2540]/10' : 'border-slate-300'}`}
                        >
                          <span className={`font-medium ${formState.r1.gender ? 'text-slate-900' : 'text-slate-500'}`}>
                            {formState.r1.gender || 'Select gender'}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform ${formState.openDropdown === 'gender' ? 'rotate-180' : ''}`}
                          />
                        </div>
                        <div
                          className={`absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] py-2 transition-all duration-200 origin-top ${formState.openDropdown === 'gender' ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 pointer-events-none'}`}
                        >
                          <div className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                            Male <Check className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                            Female
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Church */}
                    <div className={`p-1 -m-1 relative z-10 ${getFocusClass('church')}`}>
                      <label className="text-sm font-bold text-slate-800 mb-1.5 block">Church</label>
                      <div className="relative">
                        <div
                          className={`w-full h-10 bg-white border rounded-lg px-3 flex items-center justify-between text-sm shadow-sm ${formState.openDropdown === 'church' ? 'border-[#0a2540] ring-2 ring-[#0a2540]/10' : 'border-slate-300'}`}
                        >
                          <span className="font-medium text-slate-900 truncate pr-2">
                            {formState.r1.church || 'Other (specify below)'}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${formState.openDropdown === 'church' ? 'rotate-180' : ''}`}
                          />
                        </div>
                        <div
                          className={`absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] py-1 transition-all duration-200 origin-top max-h-72 overflow-y-auto custom-scrollbar ${formState.openDropdown === 'church' ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 pointer-events-none'}`}
                        >
                          {CHURCH_LIST.map(({ name }) => {
                            const isPicked = formState.r1.church === name
                            return (
                              <div
                                key={name}
                                className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between ${isPicked ? 'bg-slate-50 text-[#0a2540] font-semibold' : 'text-slate-700 font-medium hover:bg-slate-50'}`}
                              >
                                <span className="truncate">{name}</span>
                                {isPicked && <Check className="w-4 h-4 shrink-0 text-[#0a2540]" />}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* City */}
                    <div className={`p-1 -m-1 ${getFocusClass('city')}`}>
                      <label className="text-sm font-bold text-slate-800 mb-1.5 block">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formState.r1.city}
                        placeholder="Dallas, TX"
                        className={`w-full h-10 bg-white border rounded-lg px-3 text-sm shadow-sm outline-none font-medium placeholder:text-slate-400 transition-colors ${
                          formState.r1.cityAutoFilled
                            ? 'border-[#0a2540] text-[#0a2540] bg-slate-50'
                            : 'border-slate-300 text-slate-900'
                        }`}
                      />
                      {formState.r1.cityAutoFilled && (
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Auto-filled from church</p>
                      )}
                    </div>

                    {/* T-Shirt Size */}
                    <div className={`p-1 -m-1 ${getFocusClass('shirt')}`}>
                      <label className="text-sm font-bold text-slate-800 mb-1.5 flex items-baseline gap-2">
                        T-Shirt Size
                        <span className="text-xs text-slate-500 font-medium">(optional — for planning purposes only)</span>
                      </label>
                      <div className="relative w-full sm:w-[140px]">
                        <div className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 flex items-center justify-between text-sm shadow-sm">
                          <span
                            className={`font-medium ${formState.r1.shirt === 'No preference' ? 'text-slate-500' : 'text-slate-900'}`}
                          >
                            {formState.r1.shirt}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>

                    {/* Attendance Type */}
                    <div className={`p-1 -m-1 ${getFocusClass('attendance')}`}>
                      <label className="text-sm font-bold text-slate-800 mb-2 block">
                        Attendance Type <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {ATTENDANCE_TYPES.map(({ id, label, detail }) => {
                          const isPicked = formState.r1.attendanceType === id
                          return (
                            <div
                              key={id}
                              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isPicked ? 'border-[#0a2540] bg-slate-50' : 'border-slate-200 bg-white'}`}
                            >
                              <div
                                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isPicked ? 'border-[#0a2540]' : 'border-slate-300'}`}
                              >
                                {isPicked && <div className="w-2 h-2 rounded-full bg-[#0a2540]" />}
                              </div>
                              <div className="text-sm">
                                <span className="font-bold text-slate-900">{label}</span>
                                <span className="text-slate-500 font-medium"> {detail}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Day picker — Partial & Kote only */}
                    {(formState.r1.attendanceType === 'partial' || formState.r1.attendanceType === 'kote') && (
                      <div className={`p-1 -m-1 ${getFocusClass('days')}`}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-bold text-slate-800">Number of days</label>
                          {formState.r1.days.length > 0 && (
                            <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {formState.r1.days.length} day{formState.r1.days.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {CONFERENCE_DAYS.map((d) => {
                            const picked = formState.r1.days.includes(d.id)
                            return (
                              <div
                                key={d.id}
                                className={`relative flex flex-col items-center justify-center py-3 rounded-lg border transition-all ${picked ? 'border-[#0a2540] bg-white shadow-[0_2px_10px_rgba(10,37,64,0.08)]' : 'border-slate-200 bg-white'}`}
                              >
                                {picked && (
                                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#0a2540] flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                  </div>
                                )}
                                <span className="text-[10px] font-bold text-slate-500 tracking-wide">{d.dow}</span>
                                <span className="text-lg font-extrabold text-slate-900 leading-tight">{d.day}</span>
                                <span className="text-[10px] font-semibold text-slate-500">{d.month}</span>
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 font-medium">Tap each day you plan to attend</p>
                      </div>
                    )}

                    {/* Meals picker — when days are selected */}
                    {(formState.r1.attendanceType === 'partial' || formState.r1.attendanceType === 'kote') &&
                      formState.r1.days.length > 0 && (() => {
                        const mealCount = Object.values(formState.r1.meals).reduce((a, m) => a + m.length, 0)
                        // Meal price is flat $12 for adult/youth regardless of attendance type.
                        // Kote's $10/day is a daily-commuter lodging-equivalent fee, not a meal discount.
                        const perMeal = MEAL_PRICE_ADULT
                        return (
                          <div className={`p-1 -m-1 ${getFocusClass('meals')}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-sm font-bold text-amber-700">
                                <span>🍽️</span> Add Meals (Optional)
                              </div>
                              {mealCount > 0 && (
                                <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                  {mealCount} Meal{mealCount === 1 ? '' : 's'} · ${mealCount * perMeal}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3 font-medium">
                              ${perMeal}/meal · Select meals you&apos;d like to purchase
                            </p>
                            <div className="space-y-3">
                              {formState.r1.days.map((dayId) => {
                                const day = CONFERENCE_DAYS.find((c) => c.id === dayId)
                                const slots = MEAL_SLOTS[dayId] || []
                                const picked = formState.r1.meals[dayId] || []
                                return (
                                  <div key={dayId}>
                                    <div className="text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">
                                      {day.label}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      {slots.map((slot) => {
                                        const on = picked.includes(slot.id)
                                        return (
                                          <div
                                            key={slot.id}
                                            className={`relative flex flex-col items-center justify-center py-2 rounded-lg border text-xs font-semibold transition-all ${on ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500'}`}
                                          >
                                            {on && (
                                              <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-500 flex items-center justify-center">
                                                <Check className="w-2 h-2 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                            <span className={on ? 'font-bold' : ''}>{slot.label}</span>
                                            <span className="text-[10px] text-slate-400">{slot.time}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                  </div>
                </div>
              )}

              {/* ===== Person 2: Child ===== */}
              {formState.view === 'registrants' && formState.r2.visible && (() => {
                const r2 = formState.r2
                const isComplete = r2.firstName && r2.ageRange && r2.gender
                // Pricing: child full conference — lodging is $50 normally,
                // or completely waived (Free) when sharing bed with parent.
                const r2Total = r2.sharesBedWithParent ? 0 : FULL_CONFERENCE_PRICE_CHILD
                return (
                  <div className={`bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-200 mb-4 transition-all duration-500 ${formState.focus?.startsWith('r2') ? 'ring-2 ring-emerald-400' : ''}`}>
                    <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-slate-100">
                      {isComplete ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">2</div>
                      )}
                      <div className="flex-1">
                        <span className="font-semibold text-slate-700 text-sm">
                          {r2.firstName ? `${r2.firstName} ${r2.lastName}`.trim() : 'Person 2'}
                        </span>
                        {r2.ageRange && (
                          <span className="ml-2 text-xs font-medium">
                            <span className="text-slate-500">{r2.ageRange} — </span>
                            {r2.sharesBedWithParent
                              ? <span className="text-emerald-600 font-bold">Free</span>
                              : <span className="text-slate-500">${r2Total.toFixed(2)}</span>}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`p-6 md:p-7 space-y-5 ${getFocusClass('r2_names')}`}>
                      {/* Names */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="text-sm font-bold text-slate-800 mb-1.5 block">First Name <span className="text-red-500">*</span></label>
                          <input type="text" readOnly value={r2.firstName} placeholder="John"
                            className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 font-medium" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-800 mb-1.5 block">Last Name <span className="text-red-500">*</span></label>
                          <input type="text" readOnly value={r2.lastName} placeholder="Doe"
                            className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 font-medium" />
                        </div>
                      </div>

                      {/* Service */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Service <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 gap-3">
                          {['amharic', 'english'].map((s) => (
                            <div key={s} className={`relative h-11 rounded-lg border bg-white flex items-center justify-center text-sm font-bold transition-all ${r2.service === s ? 'border-[#0a2540] text-slate-900 shadow-sm' : 'border-slate-200 text-slate-500'}`}>
                              {s === 'amharic' ? 'Amharic' : 'English'}
                              {r2.service === s && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0a2540]" />}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Age Range */}
                      <div className={getFocusClass('r2_age')}>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Age Range <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {AGE_RANGES.map(({ id, label, age }) => {
                            const isActive = r2.ageRange === id
                            const Icon = id === 'infant' ? Baby : id === 'child' ? User : id === 'youth' ? GraduationCap : Users
                            return (
                              <div key={id} className={`relative flex flex-col items-center justify-center p-3 rounded-lg border bg-white transition-all ${isActive ? 'border-[#0a2540] shadow-[0_2px_10px_rgba(10,37,64,0.08)]' : 'border-slate-200'}`}>
                                {isActive && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#0a2540]" />}
                                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-[#0a2540]' : 'text-slate-400'}`} />
                                <span className={`text-sm font-bold ${isActive ? 'text-[#0a2540]' : 'text-slate-700'}`}>{label}</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">{age}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Service Group for child/English */}
                      {r2.service === 'english' && r2.ageRange === 'child' && (
                        <div>
                          <label className="text-sm font-bold text-slate-800 mb-1.5 block">Service Group <span className="text-red-500">*</span></label>
                          <div className="grid grid-cols-2 gap-3">
                            {CHILD_GROUPS.map((g) => (
                              <div key={g.id} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${r2.group === g.id ? 'border-[#0a2540] bg-slate-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                                {r2.group === g.id && <Check className="w-3.5 h-3.5 text-[#0a2540] mb-1" />}
                                <span className="text-sm font-bold text-slate-700">{g.label}</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">{g.age}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gender */}
                      <div className={getFocusClass('r2_gender')}>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Gender <span className="text-red-500">*</span></label>
                        <div className="relative w-full sm:w-[200px]">
                          <div className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 flex items-center justify-between text-sm shadow-sm">
                            <span className={`font-medium ${r2.gender ? 'text-slate-900' : 'text-slate-500'}`}>{r2.gender || 'Select gender'}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>

                      {/* Church */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Church</label>
                        <div className="relative">
                          <div className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 flex items-center justify-between text-sm shadow-sm">
                            <span className="font-medium text-slate-900 truncate pr-2">
                              {r2.church || 'Other (specify below)'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          </div>
                        </div>
                      </div>

                      {/* City */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">City <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          readOnly
                          value={r2.city}
                          placeholder="Dallas, TX"
                          className={`w-full h-10 bg-white border rounded-lg px-3 text-sm shadow-sm outline-none font-medium placeholder:text-slate-400 transition-colors ${
                            r2.cityAutoFilled ? 'border-[#0a2540] text-[#0a2540] bg-slate-50' : 'border-slate-300 text-slate-900'
                          }`}
                        />
                        {r2.cityAutoFilled && (
                          <p className="text-[11px] text-slate-500 mt-1 font-medium">Auto-filled from church</p>
                        )}
                      </div>

                      {/* T-Shirt */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 flex items-baseline gap-2">T-Shirt Size <span className="text-xs text-slate-500 font-medium">(optional — for planning purposes only)</span></label>
                        <div className="relative w-full sm:w-[140px]">
                          <div className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 flex items-center justify-between text-sm shadow-sm">
                            <span className={`font-medium ${r2.shirt === 'No preference' ? 'text-slate-500' : 'text-slate-900'}`}>{r2.shirt}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>

                      {/* Attendance Type */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-2 block">Attendance Type <span className="text-red-500">*</span></label>
                        <div className="space-y-2">
                          {ATTENDANCE_TYPES.map(({ id, label, detail }) => (
                            <div key={id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${r2.attendanceType === id ? 'border-[#0a2540] bg-slate-50' : 'border-slate-200 bg-white'}`}>
                              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${r2.attendanceType === id ? 'border-[#0a2540]' : 'border-slate-300'}`}>
                                {r2.attendanceType === id && <div className="w-2 h-2 rounded-full bg-[#0a2540]" />}
                              </div>
                              <div className="text-sm">
                                <span className="font-bold text-slate-900">{label}</span>
                                <span className="text-slate-500 font-medium"> {detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Share bed with parent toggle — child only */}
                      {r2.ageRange === 'child' && (
                        <div className={`p-1 -m-1 ${getFocusClass('r2_share_bed')}`}>
                          <div className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                            r2.sharesBedWithParent ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
                          }`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                              r2.sharesBedWithParent ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
                            }`}>
                              {r2.sharesBedWithParent && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-bold text-slate-800">Child will share bed with parent</span>
                              <p className="text-xs text-slate-500 mt-0.5">(no lodging fee)</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* ===== Person 3: Infant ===== */}
              {formState.view === 'registrants' && formState.r3.visible && (() => {
                const r3 = formState.r3
                const isComplete = r3.firstName && r3.ageRange
                // Infant: dormitory + meals free, but $10/day campus insurance applies (4 days × $10 = $40)
                const r3Total = FULL_CONFERENCE_INSURANCE_TOTAL
                return (
                  <div className={`bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-200 mb-4 transition-all duration-500 ${formState.focus?.startsWith('r3') ? 'ring-2 ring-emerald-400' : ''}`}>
                    <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-slate-100">
                      {isComplete ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">3</div>
                      )}
                      <div className="flex-1">
                        <span className="font-semibold text-slate-700 text-sm">
                          {r3.firstName ? `${r3.firstName} ${r3.lastName}`.trim() : 'Person 3'}
                        </span>
                        {r3.ageRange && (
                          <span className="ml-2 text-xs text-slate-500 font-medium">
                            {r3.ageRange} — ${r3Total.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-6 md:p-7 space-y-5">
                      {/* Names */}
                      <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${getFocusClass('r3_names')}`}>
                        <div>
                          <label className="text-sm font-bold text-slate-800 mb-1.5 block">First Name <span className="text-red-500">*</span></label>
                          <input type="text" readOnly value={r3.firstName} placeholder="John"
                            className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 font-medium" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-800 mb-1.5 block">Last Name <span className="text-red-500">*</span></label>
                          <input type="text" readOnly value={r3.lastName} placeholder="Doe"
                            className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 font-medium" />
                        </div>
                      </div>

                      {/* Service */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Service <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 gap-3">
                          {['amharic', 'english'].map((s) => (
                            <div key={s} className={`relative h-11 rounded-lg border bg-white flex items-center justify-center text-sm font-bold transition-all ${r3.service === s ? 'border-[#0a2540] text-slate-900 shadow-sm' : 'border-slate-200 text-slate-500'}`}>
                              {s === 'amharic' ? 'Amharic' : 'English'}
                              {r3.service === s && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0a2540]" />}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Age Range */}
                      <div className={getFocusClass('r3_age')}>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Age Range <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {AGE_RANGES.map(({ id, label, age }) => {
                            const isActive = r3.ageRange === id
                            const Icon = id === 'infant' ? Baby : id === 'child' ? User : id === 'youth' ? GraduationCap : Users
                            return (
                              <div key={id} className={`relative flex flex-col items-center justify-center p-3 rounded-lg border bg-white transition-all ${isActive ? 'border-[#0a2540] shadow-[0_2px_10px_rgba(10,37,64,0.08)]' : 'border-slate-200'}`}>
                                {isActive && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#0a2540]" />}
                                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-[#0a2540]' : 'text-slate-400'}`} />
                                <span className={`text-sm font-bold ${isActive ? 'text-[#0a2540]' : 'text-slate-700'}`}>{label}</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">{age}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Gender */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Gender <span className="text-red-500">*</span></label>
                        <div className="relative w-full sm:w-[200px]">
                          <div className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 flex items-center justify-between text-sm shadow-sm">
                            <span className={`font-medium ${r3.gender ? 'text-slate-900' : 'text-slate-500'}`}>{r3.gender || 'Select gender'}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>

                      {/* Church */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">Church</label>
                        <div className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 flex items-center justify-between text-sm shadow-sm">
                          <span className="font-medium text-slate-900 truncate pr-2">
                            {r3.church || 'Other (specify below)'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                      </div>

                      {/* City */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-1.5 block">City <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          readOnly
                          value={r3.city}
                          placeholder="Dallas, TX"
                          className={`w-full h-10 bg-white border rounded-lg px-3 text-sm shadow-sm outline-none font-medium placeholder:text-slate-400 transition-colors ${
                            r3.cityAutoFilled ? 'border-[#0a2540] text-[#0a2540] bg-slate-50' : 'border-slate-300 text-slate-900'
                          }`}
                        />
                        {r3.cityAutoFilled && (
                          <p className="text-[11px] text-slate-500 mt-1 font-medium">Auto-filled from church</p>
                        )}
                      </div>

                      {/* Attendance Type */}
                      <div>
                        <label className="text-sm font-bold text-slate-800 mb-2 block">Attendance Type <span className="text-red-500">*</span></label>
                        <div className="space-y-2">
                          {ATTENDANCE_TYPES.map(({ id, label, detail }) => (
                            <div key={id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${r3.attendanceType === id ? 'border-[#0a2540] bg-slate-50' : 'border-slate-200 bg-white'}`}>
                              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${r3.attendanceType === id ? 'border-[#0a2540]' : 'border-slate-300'}`}>
                                {r3.attendanceType === id && <div className="w-2 h-2 rounded-full bg-[#0a2540]" />}
                              </div>
                              <div className="text-sm">
                                <span className="font-bold text-slate-900">{label}</span>
                                <span className="text-slate-500 font-medium"> {detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Infant campus insurance notice */}
                      {r3.ageRange === 'infant' && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-amber-800">Campus Insurance — $10/day</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              Dormitory &amp; meals are complimentary for infants. A small ${CAMPUS_INSURANCE_PER_DAY}/day campus insurance fee applies ({FULL_CONFERENCE_DAYS} days × ${CAMPUS_INSURANCE_PER_DAY} = ${FULL_CONFERENCE_INSURANCE_TOTAL}).
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {formState.view === 'registrants' && (
                <button
                  type="button"
                  className={`w-full py-3.5 border-2 border-dashed rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 text-sm ${
                    formState.focus === 'add_person'
                      ? 'border-[#0a2540] bg-[#0a2540] text-white shadow-lg scale-[1.02]'
                      : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Plus className="w-4 h-4" /> Add Another Person
                </button>
              )}

              {/* ===== Contact Info view ===== */}
              {formState.view === 'contact' && (
                <div className={`bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-200 mb-4 transition-all duration-500 ${formState.focus === 'contact_fields' ? 'ring-2 ring-emerald-400' : ''}`}>
                  <div className="p-6 md:p-7 space-y-5">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Contact Information</h2>
                      <p className="text-slate-500 mt-1 text-sm font-medium">Provide the email and phone for registration confirmations and receipts</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-800 mb-1.5 block">Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        readOnly
                        value={formState.contact.email}
                        placeholder="john@example.com"
                        className={`w-full h-11 bg-white border rounded-lg px-3.5 text-sm shadow-sm outline-none font-medium placeholder:text-slate-400 transition-colors ${
                          formState.contact.email ? 'border-[#0a2540] text-slate-900 bg-slate-50' : 'border-slate-300 text-slate-900'
                        }`}
                      />
                      <p className="text-[11px] text-slate-500 mt-1.5 font-medium">Confirmation emails and receipts will be sent to this address</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-800 mb-1.5 block">Phone <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        readOnly
                        value={formState.contact.phone}
                        placeholder="(555) 123-4567"
                        className={`w-full h-11 bg-white border rounded-lg px-3.5 text-sm shadow-sm outline-none font-medium placeholder:text-slate-400 transition-colors ${
                          formState.contact.phone ? 'border-[#0a2540] text-slate-900 bg-slate-50' : 'border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ===== Review & Submit view ===== */}
              {formState.view === 'review' && (() => {
                const r = formState.r1
                const r2 = formState.r2
                const r3 = formState.r3
                // Recompute pricing (mirror of sidebar logic)
                let r1Base = 0
                if (r.attendanceType === 'full') r1Base = FULL_CONFERENCE_PRICE_ADULT
                else if (r.attendanceType === 'partial') r1Base = r.days.filter((d) => d !== 'sun').length * ADULT_DAILY_PRICE
                else if (r.attendanceType === 'kote') r1Base = r.days.length * KOTE_PRICE_PER_DAY
                const r1MealCount = r.attendanceType === 'full'
                  ? FULL_CONFERENCE_MEAL_COUNT
                  : Object.values(r.meals || {}).reduce((a, m) => a + m.length, 0)
                const r1MealTotal = r1MealCount * MEAL_PRICE_ADULT
                const r2Lodging = r2.sharesBedWithParent ? 0 : FULL_CONFERENCE_PRICE_CHILD
                const r2MealTotal = FULL_CONFERENCE_MEAL_COUNT * MEAL_PRICE_CHILD
                const r3Fee = FULL_CONFERENCE_INSURANCE_TOTAL
                const registrationSubtotal = r1Base + r2Lodging + r3Fee
                const mealSubtotal = r1MealTotal + r2MealTotal
                const subtotal = registrationSubtotal + mealSubtotal
                const fee = +(subtotal * PROCESSING_FEE_RATE + PROCESSING_FEE_FIXED).toFixed(2)
                const total = +(subtotal + fee).toFixed(2)
                // Day labels (e.g., "Sat, Aug 1, Sun, Aug 2")
                const dayLabelMap = { thu: 'Thu, Jul 30', fri: 'Fri, Jul 31', sat: 'Sat, Aug 1', sun: 'Sun, Aug 2' }
                const r1DaysLabel = (r.days || []).map((d) => dayLabelMap[d] || d).join(', ')
                const attendanceLabel = r.attendanceType === 'full' ? 'Full Conference'
                  : r.attendanceType === 'partial' ? 'Partial Attendance'
                  : r.attendanceType === 'kote' ? 'Kote (Daily commuters)' : ''
                return (
                  <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-200 mb-4 overflow-hidden">
                    <div className="p-6 md:p-7 border-b border-slate-100">
                      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Review &amp; Submit</h2>
                      <p className="text-slate-500 mt-1 text-sm font-medium">Verify all details before submitting</p>
                    </div>

                    {/* CONTACT */}
                    <div className="mx-6 md:mx-7 mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">Contact</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1.5">{formState.contact.email}</p>
                      <p className="text-sm text-slate-600 font-medium">{formState.contact.phone}</p>
                    </div>

                    {/* REGISTRANTS */}
                    <div className="px-6 md:px-7 mt-5 pb-2">
                      <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase mb-3">Registrants (3)</p>
                      <div className="space-y-2.5">
                        {/* Test (Adult, Kote) */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="font-bold text-slate-900 text-sm">{r.firstName || 'Test'} {r.lastName || 'Test'}</span>
                              <span className="inline-flex items-center bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">Adult</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-medium">{attendanceLabel} — {r1DaysLabel}</p>
                            <p className="text-xs text-amber-700 mt-1 font-semibold flex items-center gap-1">
                              <Utensils className="w-3 h-3" /> {r1MealCount} Meal (+${r1MealTotal.toFixed(2)})
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-slate-900 text-sm">${r1Base.toFixed(2)}</p>
                            <p className="text-[11px] text-amber-700 font-bold mt-0.5">+${r1MealTotal.toFixed(2)} Meal</p>
                          </div>
                        </div>

                        {/* Child */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="font-bold text-slate-900 text-sm">Child Child</span>
                              <span className="inline-flex items-center bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">Child</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-medium">Full Conference</p>
                            {r2.sharesBedWithParent && (
                              <p className="text-xs text-emerald-600 mt-0.5 font-semibold">Sharing bed with parent — lodging free</p>
                            )}
                            <p className="text-xs text-amber-700 mt-1 font-semibold flex items-center gap-1">
                              <Utensils className="w-3 h-3" /> {FULL_CONFERENCE_MEAL_COUNT} Meal (+${r2MealTotal.toFixed(2)})
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {r2.sharesBedWithParent ? (
                              <p className="font-extrabold text-emerald-600 text-sm">FREE</p>
                            ) : (
                              <p className="font-bold text-slate-900 text-sm">${r2Lodging.toFixed(2)}</p>
                            )}
                            <p className="text-[11px] text-amber-700 font-bold mt-0.5">+${r2MealTotal.toFixed(2)} Meal</p>
                          </div>
                        </div>

                        {/* Infant */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="font-bold text-slate-900 text-sm">Infant Infant</span>
                              <span className="inline-flex items-center bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">Child</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-medium">Full Conference</p>
                            <p className="text-xs text-amber-700 mt-1 font-semibold flex items-center gap-1">
                              <Utensils className="w-3 h-3" /> {FULL_CONFERENCE_MEAL_COUNT} Meal (+$0.00)
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-slate-900 text-sm">${r3Fee.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* TOTALS */}
                    <div className="mx-6 md:mx-7 my-5 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-medium">Subtotal</span>
                        <span className="font-bold text-slate-900">${registrationSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-700 font-medium flex items-center gap-1">🍽️ Meal</span>
                        <span className="font-bold text-amber-700">+${mealSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium flex items-center gap-1">Processing Fee <Info className="w-3 h-3" /></span>
                        <span className="font-semibold text-slate-500">+${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2.5 border-t border-slate-200">
                        <span className="text-slate-900 font-extrabold">Total</span>
                        <span className="text-xl font-black text-slate-900">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="flex items-center justify-between mt-6 px-1">
                <button
                  type="button"
                  className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-slate-600 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" /> Back
                </button>
                <button
                  type="button"
                  className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-all duration-300 ${
                    formState.focus === 'next_button' || formState.focus === 'proceed_payment'
                      ? 'bg-[#0a2540] text-white shadow-[0_0_0_4px_rgba(33,165,96,0.35)] scale-[1.04]'
                      : 'bg-[#0a2540] text-white hover:bg-[#153b61]'
                  }`}
                >
                  {formState.view === 'review' ? 'Proceed to Payment' : 'Next'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Price Summary Sidebar (live breakdown) */}
            <div className={`w-[280px] shrink-0 sticky top-6 hidden lg:block z-0 space-y-3 transition-all duration-500 ${formState.focus === 'price_summary' ? 'ring-4 ring-emerald-400 ring-offset-4 rounded-2xl' : ''}`}>
              {(() => {
                const r = formState.r1
                const r2 = formState.r2
                const r3 = formState.r3
                const hasAttendance = !!r.attendanceType

                // ---- r1 pricing (adult) ----
                let r1Base = 0
                if (r.attendanceType === 'full') {
                  r1Base = FULL_CONFERENCE_PRICE_ADULT
                } else if (r.attendanceType === 'partial') {
                  r1Base = r.days.filter((d) => d !== 'sun').length * ADULT_DAILY_PRICE
                } else if (r.attendanceType === 'kote') {
                  r1Base = r.days.length * KOTE_PRICE_PER_DAY
                }
                const r1MealCount = r.attendanceType === 'full'
                  ? FULL_CONFERENCE_MEAL_COUNT
                  : Object.values(r.meals).reduce((a, m) => a + m.length, 0)
                const r1MealTotal = r1MealCount * MEAL_PRICE_ADULT

                // ---- r2 pricing (child, full conference) ----
                // Lodging is $50 normally, $0 (Free) when sharing bed with parent.
                // Child meals are $8 each and added to the combined meal line.
                const r2HasData = r2.visible && !!r2.ageRange
                const r2Lodging = r2HasData
                  ? (r2.sharesBedWithParent ? 0 : FULL_CONFERENCE_PRICE_CHILD)
                  : 0
                const r2ChildMealTotal = r2HasData ? FULL_CONFERENCE_MEAL_COUNT * MEAL_PRICE_CHILD : 0

                // ---- r3 pricing (infant) ----
                // Dorm + meals free; infant_daily_fee ($10/day × 4 = $40) applies to infants only.
                const r3HasData = r3.visible && !!r3.ageRange
                const r3Fee = r3HasData ? FULL_CONFERENCE_INSURANCE_TOTAL : 0

                // Per-person lodging rows (meals aggregated in one line below)
                const registrationSubtotal = r1Base
                  + (r2HasData ? r2Lodging : 0)
                  + (r3HasData ? r3Fee : 0)

                const mealSubtotal = r1MealTotal
                  + (r2HasData ? r2ChildMealTotal : 0)

                const subtotal = registrationSubtotal + mealSubtotal
                const fee = subtotal > 0
                  ? +(subtotal * PROCESSING_FEE_RATE + PROCESSING_FEE_FIXED).toFixed(2)
                  : 0
                const total = +(subtotal + fee).toFixed(2)

                const showBreakdown = hasAttendance && (r.attendanceType === 'full'
                  || (r.attendanceType !== '' && (r.attendanceType === 'partial' || r.attendanceType === 'kote') && r.days.length > 0))

                return (
                  <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border-2 border-emerald-200 p-5">
                    <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm mb-3">
                      <Users className="w-4 h-4 text-[#21a560]" /> Price Summary
                    </div>
                    <div className="text-sm font-semibold text-slate-700 mb-3">Midwest Conference 2026</div>
                    {!showBreakdown ? (
                      <div className="text-xs text-slate-500 font-medium">
                        {r.firstName ? 'Select an Attendance Type to see pricing' : 'Add registrant details to see pricing'}
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-sm">
                        {/* r1 row */}
                        <div className="flex justify-between">
                          <span className="text-slate-700 font-medium">{r.firstName || 'Person 1'}</span>
                          <span className="font-bold text-slate-900">${r1Base.toFixed(2)}</span>
                        </div>

                        {/* r2 row — child (shows "Free" when sharing bed) */}
                        {r2HasData && (
                          <div className="flex justify-between">
                            <span className="text-slate-700 font-medium">{r2.firstName || 'Child'}</span>
                            {r2.sharesBedWithParent ? (
                              <span className="text-emerald-600 font-bold">Free</span>
                            ) : (
                              <span className="font-bold text-slate-900">${r2Lodging.toFixed(2)}</span>
                            )}
                          </div>
                        )}

                        {/* r3 row — infant */}
                        {r3HasData && (
                          <div className="flex justify-between">
                            <span className="text-slate-700 font-medium">{r3.firstName || 'Infant'}</span>
                            <span className="font-bold text-slate-900">${r3Fee.toFixed(2)}</span>
                          </div>
                        )}

                        <div className="flex justify-between pt-2 border-t border-slate-100">
                          <span className="text-slate-600 font-semibold">Subtotal</span>
                          <span className="font-bold text-slate-900">${registrationSubtotal.toFixed(2)}</span>
                        </div>

                        {mealSubtotal > 0 && (
                          <div className="flex justify-between">
                            <span className="text-amber-700 font-medium">🍽️ Meal</span>
                            <span className="font-bold text-amber-700">+${mealSubtotal.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium text-xs">Processing Fee</span>
                          <span className="font-semibold text-slate-500 text-xs">+${fee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-slate-100">
                          <span className="text-slate-900 font-extrabold">Total</span>
                          <span className="text-xl font-black text-slate-900">${total.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 hover:bg-slate-50"
                >
                  <DollarSign className="w-3.5 h-3.5" /> View Pricing
                </button>
                <button
                  type="button"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 hover:bg-slate-50"
                >
                  <CreditCard className="w-3.5 h-3.5" /> Processing Fees
                </button>
              </div>
            </div>
          </div>
          </>)}

          {/* ===== Stripe Checkout view ===== */}
          {formState.view === 'checkout' && (
            <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white pb-32">
              {/* Left: Order summary */}
              <div className="w-full lg:w-[46%] bg-slate-50 border-r border-slate-200 px-8 md:px-14 py-10 md:py-14">
                <button type="button" className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-8 hover:text-slate-700">
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500 tracking-wide">Pay FellowFlow</p>
                <p className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mt-1">$197.87</p>
                <div className="mt-10 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">Midwest Conference 2026 — Registration (KOTE, per day)</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">KOTE program registration. Specialized track for KOTE participants. Includes: KOTE-specific sessions and materials…</p>
                    </div>
                    <p className="font-bold text-slate-900 shrink-0">$20.00</p>
                  </div>
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">Midwest Conference 2026 - Infant Infant</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Infant fee (age 0): 4 day(s) × $10.00/day: $40.00 - Infant Infant (child)</p>
                    </div>
                    <p className="font-bold text-slate-900 shrink-0">$40.00</p>
                  </div>
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">Breakfast — Sat Aug 1 (Midwest Conference 2026)</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">Conference breakfast service. Date: Saturday, August 1, 2026. Time: Morning meal service. Options: Adult/Youth ($12) or Chi…</p>
                    </div>
                    <p className="font-bold text-slate-900 shrink-0">$12.00</p>
                  </div>
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">Lunch — Sat Aug 1 (Midwest Conference 2026)</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">Conference lunch service. Date: Saturday, August 1, 2026. Time: Midday meal service. Options: Adult/Youth ($12) or Chil…</p>
                    </div>
                    <p className="font-bold text-slate-900 shrink-0">$12.00</p>
                  </div>
                  <button type="button" className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-2">
                    Show all 17 items <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Right: Payment form */}
              <div className="w-full lg:w-[54%] px-8 md:px-14 py-10 md:py-14">
                <div className={`w-full rounded-lg bg-[#00D66F] text-black font-bold py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all ${formState.focus === 'stripe_methods' ? 'ring-4 ring-[#00D66F]/40 scale-[1.02]' : ''}`}>
                  Pay with <span className="bg-black text-white px-1.5 py-0.5 rounded text-[11px] ml-1">▶ link</span>
                </div>
                <div className="flex items-center gap-3 my-5">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[11px] text-slate-400 font-semibold tracking-wide">OR</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                <p className="text-sm font-bold text-slate-900 mb-2">Contact information</p>
                <div className="w-full h-11 bg-slate-50 border border-slate-200 rounded-md px-3 flex items-center text-sm text-slate-700 font-medium mb-6">
                  <span className="text-slate-400 mr-2 w-14 shrink-0">Email</span>
                  <span className="font-semibold">{formState.contact.email}</span>
                </div>

                <p className="text-sm font-bold text-slate-900 mb-3">Payment method</p>
                <div className={`rounded-lg border ${formState.focus === 'stripe_methods' ? 'border-[#635BFF] ring-2 ring-[#635BFF]/30' : 'border-slate-300'} transition-all`}>
                  <div className="flex items-center gap-3 px-3.5 py-3 border-b border-slate-200">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-900" />
                    </div>
                    <CreditCard className="w-4 h-4 text-slate-700" />
                    <span className="text-sm font-semibold text-slate-900">Card</span>
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">Card information</p>
                      <div className="h-10 border border-slate-300 rounded-md px-3 flex items-center text-sm text-slate-400">1234 1234 1234 1234
                        <span className="ml-auto flex items-center gap-1">
                          <span className="text-[10px] font-bold text-[#1a1f71]">VISA</span>
                          <span className="text-[10px] font-bold text-[#eb001b]">●●</span>
                          <span className="text-[10px] font-bold text-[#0079be]">AE</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-0 mt-0 -mt-px">
                        <div className="h-10 border border-slate-300 rounded-bl-md px-3 flex items-center text-sm text-slate-400">MM / YY</div>
                        <div className="h-10 border border-slate-300 border-l-0 rounded-br-md px-3 flex items-center text-sm text-slate-400 justify-between">CVC <span className="text-slate-300">💳</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">Cardholder name</p>
                      <div className="h-10 border border-slate-300 rounded-md px-3 flex items-center text-sm text-slate-400">Full name on card</div>
                    </div>
                  </div>
                </div>

                {/* Bank / Klarna */}
                <div className={`rounded-lg border mt-2 ${formState.focus === 'stripe_methods' ? 'border-[#635BFF]/60' : 'border-slate-300'}`}>
                  <div className="flex items-center gap-3 px-3.5 py-3 border-b border-slate-200">
                    <div className="w-4 h-4 rounded-full border border-slate-400" />
                    <span className="text-lg">🏦</span>
                    <span className="text-sm font-semibold text-slate-900">Bank</span>
                    <span className="ml-auto bg-[#00D66F] text-black text-[10px] font-bold px-2 py-0.5 rounded">$5 back</span>
                  </div>
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <div className="w-4 h-4 rounded-full border border-slate-400" />
                    <span className="w-5 h-5 bg-[#FFA8CD] rounded-sm flex items-center justify-center text-[10px] font-black">K</span>
                    <span className="text-sm font-semibold text-slate-900">Klarna</span>
                  </div>
                </div>

                <button type="button" className="w-full mt-6 py-3 rounded-md bg-[#635BFF] text-white font-bold text-sm hover:bg-[#5048d3] transition-colors shadow-md">
                  Pay
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-3 font-medium">Powered by <span className="font-bold text-slate-600">stripe</span> · Terms · Privacy</p>
              </div>
            </div>
          )}

          {/* ===== Success view (simple card, matches live site) ===== */}
          {formState.view === 'success' && (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-6 py-20 pb-40">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-slate-100 p-8 md:p-10 text-center">
                <div className="w-14 h-14 rounded-full border-[3px] border-emerald-500 mx-auto flex items-center justify-center">
                  <Check className="w-7 h-7 text-emerald-500" strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 mt-5 tracking-tight">Registration Confirmed!</h2>
                <p className="text-slate-500 mt-3 text-sm font-medium leading-relaxed">
                  Your payment was successful and your registration is confirmed.
                </p>
                <p className="text-slate-500 mt-2 text-xs font-medium">
                  A confirmation email will be sent to your registered email address.
                </p>
                <button type="button" className="mt-6 w-full py-3 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50">
                  <DollarSign className="w-4 h-4" /> View Receipt
                </button>
                <button type="button" className="mt-2 w-full py-3 rounded-lg bg-[#0a2540] text-white font-bold text-sm hover:bg-[#153b61]">
                  Back to Home
                </button>
              </div>
            </div>
          )}

          {/* ===== Receipt view (Image 2) ===== */}
          {formState.view === 'receipt' && (
            <div className="min-h-screen w-full flex items-start justify-center bg-slate-50 px-6 py-10 md:py-14 pb-40">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-slate-100 p-6 md:p-8">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight text-center">Registration Receipt</h2>
                <p className="text-center text-slate-500 mt-1 text-sm font-medium">Midwest Conference 2026</p>
                <div className="flex justify-center mt-3">
                  <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">Confirmed</span>
                </div>
                <div className="flex justify-center gap-2 mt-3 flex-wrap">
                  <span className="inline-flex items-center bg-sky-50 text-sky-700 px-2.5 py-1 rounded-md text-[11px] font-bold">Full Access</span>
                  <span className="inline-flex items-center bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-[11px] font-bold">Adult</span>
                  <span className="inline-flex items-center bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md text-[11px] font-bold">Full Conference</span>
                </div>

                <div className="flex items-start justify-between mt-5 gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">Confirmation ID</p>
                    <p className="font-extrabold text-slate-900 text-base mt-0.5">MW26-TU-58170</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-tight truncate">3167bb1f-6fa2-467a-95c5-d98b6be36869</p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    {/* Mock QR code */}
                    <div className="w-[88px] h-[88px] bg-white border border-slate-300 p-1.5 grid grid-cols-8 gap-0">
                      {Array.from({ length: 64 }).map((_, i) => (
                        <div key={i} className={`w-full h-full ${(i * 7 + 3) % 3 === 0 ? 'bg-slate-900' : 'bg-white'}`} />
                      ))}
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 tracking-wide">CHECK-IN</span>
                    <button
                      type="button"
                      className={`mt-1 inline-flex items-center gap-1.5 bg-white border rounded-full px-3 py-1.5 text-xs font-bold text-slate-900 transition-all ${
                        formState.focus === 'apple_wallet_btn'
                          ? 'border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)] scale-[1.06]'
                          : 'border-slate-300'
                      }`}
                    >
                      <span className="text-base leading-none"></span> Apple Wallet
                    </button>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 text-sm">
                  <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">Contact</p>
                  <p className="text-slate-700 mt-1 font-medium">{formState.contact.email || 'support@fellowflow.online'}</p>
                  <p className="text-slate-700 font-medium">{formState.contact.phone || '1234567890'}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                  <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">Event</p>
                  <p className="font-bold text-slate-900 mt-1">Midwest Conference 2026</p>
                  <p className="text-slate-500 text-xs font-medium mt-0.5">Jul 30, 2026 — Aug 2, 2026</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                  <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">Attendee</p>
                  <p className="font-extrabold text-slate-900 mt-1">Test User</p>
                  <p className="text-slate-500 text-xs font-medium">Category: Adult</p>
                  <p className="text-slate-500 text-xs font-medium">Full Conference (4 days)</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                  <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">Pricing</p>
                  <p className="font-bold text-slate-900 mt-1">Full Conference — Adult</p>
                  <p className="text-slate-500 text-xs font-medium mt-0.5 leading-relaxed">Full conference (adult): 3 night(s) × $40.00/night (3 chargeable night(s), Sunday excluded): $120.00</p>
                  <p className="text-emerald-600 text-xs font-semibold mt-2">Sharing bed with parent — lodging free</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                  <p className="text-[10px] font-bold text-amber-700 tracking-[0.12em] uppercase flex items-center gap-1">
                    <Utensils className="w-3 h-3" /> Purchased Meals
                  </p>
                  <p className="text-amber-700 font-bold mt-1">9 meal(s) purchased — $108.00</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-sm flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">T-Shirt Size</p>
                    <p className="font-bold text-slate-900 mt-0.5">L</p>
                  </div>
                </div>

                <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 font-medium">Amount Paid</p>
                  <p className="text-3xl font-black text-amber-700 mt-1 tracking-tight">$234.91</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Includes $6.91 processing fee</p>
                  <p className="text-[10px] text-slate-500 font-medium">Payment: completed via Stripe</p>
                </div>

                <p className="text-center text-[11px] text-slate-400 font-medium mt-4">Registered on Apr 12, 2026 at 12:05 AM</p>

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button type="button" className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <CreditCard className="w-3.5 h-3.5" /> Print / Download
                  </button>
                  <button type="button" className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Mail className="w-3.5 h-3.5" /> Email Receipt
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== Apple Wallet back view (Image 3) ===== */}
          {formState.view === 'wallet_back' && (
            <div className="min-h-screen w-full flex items-start justify-center bg-black px-4 py-10 pb-40">
              <div className="w-full max-w-[400px] text-white">
                <div className="flex items-center justify-between">
                  <button type="button" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 rotate-180 text-white" />
                  </button>
                  <button type="button" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 -rotate-90 text-white" />
                  </button>
                </div>

                {/* Small pass preview */}
                <div className="flex justify-center mt-6">
                  <div className="w-[180px] rounded-t-2xl bg-[#2d9aa8] p-3 text-[8px] font-medium shadow-xl relative">
                    <div className="flex justify-between items-start text-[7px] text-white/80">
                      <div>
                        <p className="font-bold text-white text-[9px]">Midwest 2026</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[6px] opacity-70">EVENT</p>
                        <p className="font-semibold text-[7px]">Jul 30 - Aug 2</p>
                      </div>
                    </div>
                    <div className="mt-2 text-white">
                      <p className="text-[6px] opacity-70">REGISTRANT</p>
                      <p className="font-bold text-[9px]">Test-02 User-02</p>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1 text-white text-[6px]">
                      <div>
                        <p className="opacity-70">CONFIRMATION</p>
                        <p className="font-semibold text-[7px]">MW26-TU-15382</p>
                      </div>
                      <div>
                        <p className="opacity-70">VALID FOR</p>
                        <p className="font-semibold text-[7px]">Jul 31 - Aug 2, 2026</p>
                      </div>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1 text-white text-[6px]">
                      <div>
                        <p className="opacity-70">TYPE</p>
                        <p className="font-semibold text-[7px]">PARTIAL</p>
                      </div>
                      <div>
                        <p className="opacity-70">LODGING</p>
                        <p className="font-semibold text-[7px]">Heavenly Sunshine HSD-Main</p>
                      </div>
                      <div>
                        <p className="opacity-70">MEALS</p>
                        <p className="font-semibold text-[7px]">8 Purchased</p>
                      </div>
                    </div>
                    {/* perforation notch */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-black" />
                  </div>
                </div>

                <h2 className="text-3xl font-bold text-white mt-7 text-center">Midwest 2026 Check-in Badge</h2>

                <button type="button" className="mt-6 w-full bg-white/10 text-[#ff453a] font-semibold py-4 rounded-xl text-base">
                  Remove Pass
                </button>

                {/* Details section */}
                <div className="mt-4 bg-white/10 rounded-2xl overflow-hidden">
                  <div className={`p-4 transition-all ${formState.focus === 'buy_meals_link' ? 'bg-emerald-500/10 ring-2 ring-emerald-400 rounded-2xl' : ''}`}>
                    <p className="text-xs font-bold text-white/80 tracking-wide flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5" /> BUY MEALS — TAP LINK BELOW
                    </p>
                    <a className={`block text-[#0a84ff] font-semibold text-base mt-1 ${formState.focus === 'buy_meals_link' ? 'underline' : ''}`}>
                      Tap here to purchase meals
                    </a>
                  </div>
                  <div className="border-t border-white/10 p-4 flex justify-between items-center">
                    <p className="text-xs font-bold text-white/80 tracking-wide">CONFIRMATION CODE</p>
                    <p className="text-white/60 font-semibold text-sm">MW26-TU-15382</p>
                  </div>
                  <div className="border-t border-white/10 p-4 flex justify-between items-center">
                    <p className="text-xs font-bold text-white/80 tracking-wide">TICKET TYPE</p>
                    <p className="text-white/60 font-semibold text-sm">PARTIAL</p>
                  </div>
                  <div className="border-t border-white/10 p-4 flex justify-between items-center">
                    <p className="text-xs font-bold text-white/80 tracking-wide">YOUR DATES</p>
                    <p className="text-white/60 font-semibold text-sm underline">Jul 31 - Aug 2, 2026</p>
                  </div>
                  <div className="border-t border-white/10 p-4">
                    <p className="text-xs font-bold text-white/80 tracking-wide">NOTICE</p>
                    <p className="text-white/60 text-sm mt-1 leading-relaxed">Present your QR code at check-in and meal service stations.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Email confirmation + PDF badge view ===== */}
          {formState.view === 'email' && (
            <div className="min-h-screen w-full bg-slate-100 px-6 py-10 md:py-14 pb-40">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left: Email preview */}
                <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-600">Inbox</span>
                    <span className="ml-auto text-[10px] text-slate-400 font-medium">Apr 12, 2026</span>
                  </div>
                  <div className="p-6">
                    <p className="text-xs text-slate-500 font-semibold">From: <span className="text-slate-700">no-reply@fellowflow.online</span></p>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">To: <span className="text-slate-700">{formState.contact.email || 'test@fellowflow.com'}</span></p>
                    <h2 className="text-xl font-extrabold text-slate-900 mt-3 tracking-tight">
                      Your Midwest Conference 2026 Registration Confirmation
                    </h2>
                    <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                        <Check className="w-4 h-4" strokeWidth={3} /> Registration Confirmed
                      </p>
                      <p className="text-xs text-emerald-700 mt-1 font-medium">Confirmation ID: <span className="font-bold">MW26-TU-58170</span></p>
                    </div>
                    <p className="text-sm text-slate-700 mt-5 font-medium leading-relaxed">
                      Hi Test User, thank you for registering! Your confirmation details and <span className="font-bold">3 PDF Registration Badges</span> are attached below — one for each registrant in your group.
                    </p>

                    <div className="mt-5 space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 tracking-[0.12em] uppercase">Payment Summary</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 font-medium">Subtotal (3 registrants)</span>
                        <span className="font-bold text-slate-900">$60.00</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-700 font-medium">Meals</span>
                        <span className="font-bold text-amber-700">+$132.00</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Processing Fee</span>
                        <span className="font-semibold text-slate-500">+$5.87</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                        <span className="font-extrabold text-slate-900">Total</span>
                        <span className="font-black text-slate-900">$197.87</span>
                      </div>
                    </div>

                    <p className="text-[11px] font-bold text-slate-500 tracking-[0.12em] uppercase mt-6 mb-2">Attachments (3)</p>
                    <div className="space-y-2">
                      {['Test Test', 'Child Child', 'Infant Infant'].map((name, i) => (
                        <div key={name} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                          <div className="w-9 h-11 rounded bg-white border border-slate-300 flex items-center justify-center text-[9px] font-black text-red-600">PDF</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">Badge-{name.replace(' ', '-')}.pdf</p>
                            <p className="text-[11px] text-slate-500 font-medium">Registration badge · 128 KB</p>
                          </div>
                          <button type="button" className="text-[#0a2540] text-xs font-bold">Download</button>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-slate-500 mt-6 font-medium leading-relaxed">
                      Print these badges out or keep them on your phone. Have them ready at the campus upon check-in to easily access all your services.
                    </p>
                  </div>
                </div>

                {/* Right: PDF badge preview + printed badge photo */}
                <div className="space-y-6 lg:sticky lg:top-10">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 tracking-[0.12em] uppercase mb-2">PDF Registration Badge</p>
                    <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
                      <img src="/Email-Badg-and-Other/confirmation.png" alt="PDF Badge — Test User" className="w-full h-auto block" />
                    </div>
                  </div>

                  <div className={`transition-all duration-500 ${formState.focus === 'printed_badge' ? 'scale-[1.02]' : ''}`}>
                    <p className="text-[11px] font-bold text-slate-500 tracking-[0.12em] uppercase mb-2">
                      Printed & ready at check-in
                    </p>
                    <div className={`grid grid-cols-2 gap-3 p-3 rounded-2xl transition-all ${formState.focus === 'printed_badge' ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-white border border-slate-200'}`}>
                      <div className="rounded-xl overflow-hidden shadow-lg">
                        <img src="/Email-Badg-and-Other/email-2.jpeg" alt="Printed lanyard badge — Full Conference" className="w-full h-auto block" />
                      </div>
                      <div className="rounded-xl overflow-hidden shadow-lg">
                        <img src="/Email-Badg-and-Other/email-3.jpeg" alt="Printed lanyard badge — Partial with Buy Meals QR" className="w-full h-auto block" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium text-center mt-3 leading-relaxed">
                      Print the PDF or keep it on your phone — show the QR at check-in and meal stations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Meal Access (two entry points) ===== */}
          {formState.view === 'meal_access' && (
            <div className="min-h-screen w-full bg-slate-50 px-6 py-10 md:py-16 pb-40">
              <div className="max-w-5xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">
                  <Utensils className="w-3.5 h-3.5" /> Need meals during the conference?
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-4">Two ways to reach your Meal Tickets page</h2>
                <p className="text-slate-500 mt-2 text-sm md:text-base font-medium max-w-xl mx-auto">Both paths take you to the same personal page where you can purchase additional meals anytime.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10 items-start">
                  {/* Option 1: Badge QR */}
                  <div className={`bg-white rounded-2xl border p-5 transition-all duration-500 ${formState.focus === 'meal_access_points' ? 'ring-2 ring-emerald-400 border-emerald-200 shadow-xl' : 'border-slate-200 shadow'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-black">1</span>
                      <span className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">On your badge</span>
                    </div>
                    <div className="rounded-xl overflow-hidden shadow-lg relative">
                      <img src="/Email-Badg-and-Other/email-3.jpeg" alt="Printed badge with Buy Meals QR" className="w-full h-auto block" />
                      {/* Emerald pulse ring overlaid on the Buy Meals QR location (bottom-right ~15% from edges) */}
                      {formState.focus === 'meal_access_points' && (
                        <div className="absolute right-[6%] bottom-[10%] w-[22%] aspect-square rounded-lg ring-4 ring-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.25)] animate-pulse pointer-events-none" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-3">Scan the <span className="text-emerald-600">Buy Meals</span> QR</p>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Point your phone camera at the small QR on the lower-right of your printed badge.</p>
                  </div>

                  {/* Option 2: Receipt page */}
                  <div className={`bg-white rounded-2xl border p-5 transition-all duration-500 ${formState.focus === 'meal_access_points' ? 'ring-2 ring-emerald-400 border-emerald-200 shadow-xl' : 'border-slate-200 shadow'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-black">2</span>
                      <span className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase">From your receipt</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-left">
                      <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                        <span>T-Shirt Size</span>
                        <span className="font-bold text-slate-900">XL</span>
                      </div>
                      <button type="button" className="mt-5 w-full py-3 rounded-full bg-gradient-to-r from-[#3c82f6] to-[#6366f1] text-white font-bold text-sm flex items-center justify-center gap-2">
                        View Full Receipt <ArrowRight className="w-4 h-4" />
                      </button>
                      <p className="text-xs text-amber-700 font-bold mt-6 flex items-center justify-center gap-1.5">
                        <Utensils className="w-3.5 h-3.5" /> Need meals during the conference?
                      </p>
                      <button
                        type="button"
                        className={`mt-2 w-full py-3 rounded-full bg-[#e58a2e] text-white font-bold text-sm transition-all ${formState.focus === 'meal_access_points' ? 'shadow-[0_0_0_4px_rgba(16,185,129,0.45)] scale-[1.03]' : ''}`}
                      >
                        Purchase Meal Tickets
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-4">Tap <span className="text-amber-700">Purchase Meal Tickets</span></p>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Scroll to the bottom of your registration receipt and tap the orange button.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Meal Tickets page (selection) ===== */}
          {formState.view === 'meal_tickets' && (() => {
            const isPostPurchase = formState.focus === 'meal_updated'
            const selected = formState.mealSelected
            const purchased = formState.mealPurchased
            const pricePerMeal = 12
            const total = selected * pricePerMeal
            const available = 3 - (isPostPurchase ? 3 : 0)
            // Meal list — 3 available slots that animate to selected at step 58
            const newlyPurchasedIds = new Set(['fri-breakfast', 'fri-lunch', 'thu-dinner'])
            const days = [
              {
                label: 'THU, JUL 30',
                meals: [
                  { id: 'thu-dinner', icon: '🌙', name: 'Dinner', time: '5:30 PM', state: 'available' },
                ],
              },
              {
                label: 'FRI, JUL 31',
                meals: [
                  { id: 'fri-breakfast', icon: '☕', name: 'Breakfast', time: '8:30 AM', state: 'available' },
                  { id: 'fri-lunch', icon: '☀️', name: 'Lunch', time: '12:00 PM', state: 'available' },
                  { id: 'fri-dinner', icon: '🌙', name: 'Dinner', time: '5:30 PM', state: 'purchased' },
                ],
              },
              {
                label: 'SAT, AUG 1',
                meals: [
                  { id: 'sat-breakfast', icon: '☕', name: 'Breakfast', time: '8:30 AM', state: 'purchased' },
                  { id: 'sat-lunch', icon: '☀️', name: 'Lunch', time: '12:00 PM', state: 'purchased' },
                  { id: 'sat-dinner', icon: '🌙', name: 'Dinner', time: '5:30 PM', state: 'purchased' },
                ],
              },
              {
                label: 'SUN, AUG 2',
                meals: [
                  { id: 'sun-breakfast', icon: '☕', name: 'Breakfast', time: '8:30 AM', state: 'purchased' },
                  { id: 'sun-lunch', icon: '☀️', name: 'Lunch', time: '12:00 PM', state: 'purchased' },
                ],
              },
            ]
            return (
              <div className="min-h-screen w-full bg-[#faf7f2] px-4 py-8 md:py-12 pb-40">
                {isPostPurchase && (
                  <div className="max-w-xl mx-auto mb-4 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-center gap-3 shadow-lg animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-extrabold text-emerald-800 text-sm">Payment successful — badge updated!</p>
                      <p className="text-xs text-emerald-700 font-medium">3 new meals are now active on your QR.</p>
                    </div>
                  </div>
                )}

                <div className="max-w-xl mx-auto">
                  {/* Header */}
                  <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 mx-auto flex items-center justify-center">
                      <Utensils className="w-6 h-6 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-3">Meal Tickets</h2>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">Midwest Conference 2026</p>
                  </div>

                  {/* User card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Test-02 User-02</p>
                      <p className="text-xs text-slate-500 font-medium">Partial · Adult</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-mono">MW26-TU-15382</p>
                      <p className="text-sm font-extrabold text-slate-900">${pricePerMeal.toFixed(2)}<span className="text-xs font-semibold text-slate-500">/meal</span></p>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className={`grid grid-cols-3 gap-2 mt-3 transition-all duration-500 ${formState.focus === 'meal_stats' ? 'ring-4 ring-emerald-400 ring-offset-2 rounded-xl' : ''}`}>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <p className="text-2xl font-black text-emerald-600">{purchased}</p>
                      <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase mt-0.5">Purchased</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <p className="text-2xl font-black text-amber-600">{available}</p>
                      <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase mt-0.5">Available</p>
                    </div>
                    <div className={`bg-white rounded-xl border p-4 text-center transition-all duration-500 ${selected > 0 ? 'border-slate-400 shadow-md' : 'border-slate-200'}`}>
                      <p className={`text-2xl font-black transition-all duration-500 ${selected > 0 ? 'text-slate-900 scale-110' : 'text-slate-400'}`}>{selected}</p>
                      <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase mt-0.5">Selected</p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 mt-4">
                    <button type="button" className="px-3 py-1.5 border border-slate-300 bg-white rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Select All Available ({available})
                    </button>
                    {selected > 0 && (
                      <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-700">Clear</button>
                    )}
                  </div>

                  {/* Meal list */}
                  <div className="mt-4 space-y-4">
                    {days.map((day) => (
                      <div key={day.label}>
                        <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] mb-2">{day.label}</p>
                        <div className="space-y-2">
                          {day.meals.map((meal) => {
                            const becamePurchased = isPostPurchase && newlyPurchasedIds.has(meal.id)
                            const isPurchased = meal.state === 'purchased' || becamePurchased
                            const isSelected = !isPurchased && selected > 0 && newlyPurchasedIds.has(meal.id)
                            return (
                              <div
                                key={meal.id}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-500 ${
                                  isPurchased
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : isSelected
                                    ? 'bg-slate-200 border-slate-300 shadow-sm'
                                    : 'bg-white border-slate-200'
                                } ${becamePurchased ? 'ring-2 ring-emerald-400' : ''}`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                                  isPurchased ? 'bg-emerald-100' : 'bg-slate-100'
                                }`}>
                                  {isPurchased ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} /> : meal.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900">{meal.name}</p>
                                  <p className="text-[11px] text-slate-500 font-medium">{meal.time}</p>
                                </div>
                                {isPurchased ? (
                                  <span className="text-xs font-bold text-emerald-600">Purchased</span>
                                ) : (
                                  <>
                                    <span className="text-sm font-bold text-slate-900">${pricePerMeal.toFixed(2)}</span>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-500 ${
                                      isSelected ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                                    }`}>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pay bar */}
                  {selected > 0 && (
                    <div className={`mt-6 bg-white border rounded-2xl p-4 transition-all duration-500 ${formState.focus === 'meal_select' ? 'border-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.25)] ring-2 ring-emerald-400' : 'border-slate-200 shadow'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{selected} meals selected</p>
                          <p className="text-[11px] text-slate-500 font-medium">${pricePerMeal.toFixed(2)} × {selected}</p>
                        </div>
                        <p className="text-2xl font-black text-slate-900">${total.toFixed(2)}</p>
                      </div>
                      <button type="button" className="w-full mt-3 py-3 rounded-xl bg-[#0a2540] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#153b61]">
                        <CreditCard className="w-4 h-4" /> Pay ${total.toFixed(2)} with Card
                      </button>
                    </div>
                  )}

                  {/* Purchase history */}
                  <div className="mt-6">
                    <p className="text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase mb-2">Purchase History</p>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{isPostPurchase ? '3 meals' : '2 meals'}</p>
                        <p className="text-[11px] text-slate-500 font-medium">Card (online) · {isPostPurchase ? 'Just now' : 'Jul 15, 2:30 PM'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">${(isPostPurchase ? 36 : 30).toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-emerald-600">COMPLETED</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-5">
                    <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
                      <RotateCcw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ===== Meal Stripe Checkout ===== */}
          {formState.view === 'meal_checkout' && (
            <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white pb-32">
              {/* Left: teal order summary */}
              <div className="w-full lg:w-[46%] bg-[#2d9aa8] text-white px-8 md:px-14 py-10 md:py-14">
                <div className="flex items-center gap-3 mb-8">
                  <button type="button" className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 rotate-180 text-white" />
                  </button>
                  <span className="bg-slate-900 text-white px-2.5 py-1 rounded text-[10px] font-bold">Sandbox</span>
                </div>
                <p className="text-sm font-semibold text-white/80">Pay FellowFlow sandbox</p>
                <p className="text-4xl md:text-5xl font-black text-white tracking-tight mt-1">US$37.00</p>
                <div className="mt-10 space-y-5 text-sm">
                  <div className="flex justify-between items-start gap-4 border-t border-white/20 pt-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">Meal: breakfast · Breakfast — Fri Jul 31</p>
                      <p className="text-[11px] text-white/70 mt-0.5">Fri, Jul 31 · Midwest Conference 2026</p>
                    </div>
                    <p className="font-semibold text-white shrink-0">US$12.00</p>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">Meal: lunch · Lunch — Fri Jul 31</p>
                      <p className="text-[11px] text-white/70 mt-0.5">Fri, Jul 31 · Midwest Conference 2026</p>
                    </div>
                    <p className="font-semibold text-white shrink-0">US$12.00</p>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">Meal: dinner · Dinner — Thu Jul 30</p>
                      <p className="text-[11px] text-white/70 mt-0.5">Thu, Jul 30 · Midwest Conference 2026</p>
                    </div>
                    <p className="font-semibold text-white shrink-0">US$12.00</p>
                  </div>
                  <div className="flex justify-between items-start gap-4 border-t border-white/20 pt-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">Processing Fee</p>
                      <p className="text-[11px] text-white/70 mt-0.5">Card processing fee</p>
                    </div>
                    <p className="font-semibold text-white shrink-0">US$1.00</p>
                  </div>
                </div>
              </div>

              {/* Right: payment form */}
              <div className="w-full lg:w-[54%] px-8 md:px-14 py-10 md:py-14">
                <p className="text-sm font-bold text-slate-900 mb-2">Contact information</p>
                <div className="w-full h-11 bg-slate-50 border border-slate-200 rounded-md px-3 flex items-center text-sm text-slate-700 font-medium mb-6">
                  <span className="text-slate-400 mr-2 w-14 shrink-0">Email</span>
                  <span className="font-semibold">support@fellowflow.online</span>
                </div>
                <p className="text-sm font-bold text-slate-900 mb-3">Payment method</p>
                <div className={`rounded-lg border ${formState.focus === 'meal_stripe' ? 'border-[#635BFF] ring-2 ring-[#635BFF]/30' : 'border-slate-300'} transition-all`}>
                  <div className="flex items-center gap-3 px-3.5 py-3 border-b border-slate-200">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-900" />
                    </div>
                    <CreditCard className="w-4 h-4 text-slate-700" />
                    <span className="text-sm font-semibold text-slate-900">Card</span>
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">Card information</p>
                      <div className="h-10 border border-slate-300 rounded-md px-3 flex items-center text-sm text-slate-400">1234 1234 1234 1234
                        <span className="ml-auto flex items-center gap-1">
                          <span className="text-[10px] font-bold text-[#1a1f71]">VISA</span>
                          <span className="text-[10px] font-bold text-[#eb001b]">●●</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-0 -mt-px">
                        <div className="h-10 border border-slate-300 rounded-bl-md px-3 flex items-center text-sm text-slate-400">MM / YY</div>
                        <div className="h-10 border border-slate-300 border-l-0 rounded-br-md px-3 flex items-center text-sm text-slate-400 justify-between">CVC <span className="text-slate-300">💳</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">Cardholder name</p>
                      <div className="h-10 border border-slate-300 rounded-md px-3 flex items-center text-sm text-slate-400">Full name on card</div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">Country or region</p>
                      <div className="h-10 border border-slate-300 rounded-md px-3 flex items-center justify-between text-sm text-slate-700 font-medium">
                        United States <ChevronDown className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-300 mt-2 flex items-center gap-3 px-3.5 py-3">
                  <div className="w-4 h-4 rounded-full border border-slate-400" />
                  <span className="text-lg">🏦</span>
                  <span className="text-sm font-semibold text-slate-900">Bank</span>
                  <span className="ml-auto bg-[#00D66F] text-black text-[10px] font-bold px-2 py-0.5 rounded">US$5 back</span>
                </div>

                <button type="button" className={`w-full mt-6 py-3 rounded-md text-white font-bold text-sm transition-all ${
                  formState.focus === 'meal_stripe' ? 'bg-[#635BFF] shadow-[0_0_0_4px_rgba(99,91,255,0.35)] scale-[1.02]' : 'bg-[#635BFF] hover:bg-[#5048d3] shadow-md'
                }`}>
                  Pay
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-3 font-medium">Powered by <span className="font-bold text-slate-600">stripe</span> · Terms · Privacy</p>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ===== Splash / Thumbnail overlay ===== */}
      <div
        className={`absolute inset-0 z-[90] transition-all duration-700 ease-out ${
          hasStarted ? 'pointer-events-none opacity-0 scale-[1.02]' : 'opacity-100 scale-100'
        }`}
      >
        {/* Layered background */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #0a2540 0%, #122a4a 35%, #0f766e 100%)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(1400px 700px at 15% -10%, rgba(16,185,129,0.35), transparent), radial-gradient(1000px 600px at 110% 110%, rgba(99,102,241,0.28), transparent)',
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(rgba(255,255,255,0.08) 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Animated orbs */}
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-emerald-400/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-20 w-[560px] h-[560px] rounded-full bg-indigo-500/25 blur-[140px] animate-pulse" style={{ animationDelay: '1.5s' }} />

        {/* Content */}
        <div className="relative z-10 h-full w-full flex flex-col items-center justify-center px-6 md:px-10 text-white overflow-y-auto py-10">
          <div className="max-w-4xl w-full text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-[0.18em] uppercase shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Interactive Tutorial
            </div>

            {/* Title */}
            <h1 className="mt-6 text-4xl md:text-6xl lg:text-[72px] font-black leading-[1.02] tracking-tight">
              Conference Registration,
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                Made Effortless
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 text-base md:text-lg text-white/75 font-medium leading-relaxed max-w-2xl mx-auto">
              A guided walkthrough of the complete FellowFlow flow — from hero page and dynamic registration to Stripe checkout, Apple Wallet badges, and meal top-ups.
            </p>

            {/* Stats row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-4 py-2">
                <Play className="w-3.5 h-3.5 text-emerald-300 fill-emerald-300" />
                <span className="text-xs font-bold text-white/90">{PHASES.length} chapters</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-4 py-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-xs font-bold text-white/90">~{Math.round(PHASES.reduce((a, p) => a + p.fallbackMs, 0) / 60000)} min runtime</span>
              </div>
            </div>

            {/* Chapter pills preview */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-1.5 max-w-3xl mx-auto">
              {PHASES.map((phase, i) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => { setHasStarted(true); skipToPhase(i) }}
                  className="group text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/15 border border-white/10 hover:border-emerald-300/50 text-white/70 hover:text-white px-2.5 py-1.5 rounded-md transition-all"
                  title={`Jump to Chapter ${i + 1}: ${phase.title}`}
                >
                  <span className="opacity-50 mr-1">{String(i + 1).padStart(2, '0')}</span>{phase.title}
                </button>
              ))}
            </div>

            {/* Big Play button */}
            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                disabled={isGeneratingAudio}
                className="group relative inline-flex items-center justify-center gap-3 bg-white text-[#0a2540] font-extrabold text-base md:text-lg px-8 py-4 rounded-full shadow-[0_20px_60px_-15px_rgba(16,185,129,0.6)] hover:shadow-[0_25px_80px_-15px_rgba(16,185,129,0.8)] hover:scale-105 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300/0 via-emerald-300/40 to-emerald-300/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Preparing voice...
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-full bg-[#0a2540] text-white flex items-center justify-center shadow-inner">
                      <Play className="w-4 h-4 ml-0.5 fill-white" />
                    </div>
                    Start the Tutorial
                  </>
                )}
              </button>
              <p className="text-[11px] text-white/50 font-medium">
                Or click any chapter above to jump in · Press the play/pause button anytime
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Control bar (compact) */}
      <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-6px_24px_rgba(0,0,0,0.05)] py-2 px-3 md:px-5 z-[70] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Prev chapter */}
          <button
            type="button"
            onClick={() => skipToPhase(currentPhaseIdx - 1)}
            disabled={currentPhaseIdx === 0 || isGeneratingAudio}
            title="Previous chapter"
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isGeneratingAudio}
            className="w-10 h-10 rounded-full bg-[#0a2540] text-white flex items-center justify-center hover:bg-[#153b61] transition-transform hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(10,37,64,0.3)] flex-shrink-0 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isGeneratingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <div className="w-3.5 h-3.5 flex gap-1 justify-center">
                <div className="w-1 h-full bg-white rounded-sm" />
                <div className="w-1 h-full bg-white rounded-sm" />
              </div>
            ) : currentStep >= FINAL_STEP ? (
              <RotateCcw className="w-4 h-4 ml-0" />
            ) : (
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            )}
          </button>

          {/* Next chapter */}
          <button
            type="button"
            onClick={() => skipToPhase(currentPhaseIdx + 1)}
            disabled={currentPhaseIdx >= PHASES.length - 1 || isGeneratingAudio}
            title="Next chapter"
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0 pr-2">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.14em] flex flex-wrap items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse hidden md:block shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
              {isGeneratingAudio
                ? `Generating — Ch ${currentPhaseIdx + 1}: ${PHASES[currentPhaseIdx].title}`
                : `Ch ${currentPhaseIdx + 1}/${PHASES.length} · ${PHASES[currentPhaseIdx].title}`}
            </div>
            {voiceError && geminiConfigured && (
              <p className="text-[10px] text-amber-700 font-medium truncate" title={voiceError}>
                Voice: {voiceError}
              </p>
            )}
            <p className="text-sm md:text-[15px] font-bold text-slate-800 truncate transition-opacity duration-300 leading-snug">
              {subtitle || '...'}
            </p>
          </div>
        </div>

        {/* Chapter jump pills (compact) */}
        <div className="hidden lg:flex items-center gap-0.5 shrink-0">
          {PHASES.map((phase, pi) => {
            const isActive = pi === currentPhaseIdx
            const isDone = PHASES[pi].events.every((ev) => ev.step <= currentStep)
            return (
              <button
                key={phase.id}
                type="button"
                title={`Chapter ${pi + 1}: ${phase.title}`}
                onClick={() => skipToPhase(pi)}
                className={`group relative flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-[#0a2540]/8'
                    : 'hover:bg-slate-100'
                }`}
              >
                {/* mini progress strip for this chapter */}
                <div className="flex items-center gap-0.5">
                  {phase.events.map((ev) => (
                    <div
                      key={ev.step}
                      className={`h-1 w-2.5 rounded-full transition-all duration-300 ${
                        ev.step <= currentStep
                          ? 'bg-[#21a560] shadow-[0_0_4px_rgba(33,165,96,0.5)]'
                          : isActive
                          ? 'bg-[#0a2540]/20'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
                  isActive ? 'text-[#0a2540]' : isDone ? 'text-[#21a560]' : 'text-slate-400 group-hover:text-slate-600'
                }`}>
                  {phase.title}
                </span>
              </button>
            )
          })}
        </div>

        {/* View mode toggle */}
        <button
          type="button"
          onClick={() => setViewMode((m) => (m === 'fullscreen' ? 'container' : 'fullscreen'))}
          title={viewMode === 'fullscreen' ? 'Exit full screen' : 'Enter full screen'}
          className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95 flex-shrink-0 ml-1"
        >
          {viewMode === 'fullscreen' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Chat */}
      {ENABLE_CHAT && (
      <div
        className={`absolute top-0 right-0 h-full w-80 sm:w-96 bg-white shadow-2xl border-l border-slate-200 z-[80] transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5 font-extrabold text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            Event AI Assistant
          </div>
          <button
            type="button"
            onClick={() => setIsChatOpen(false)}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5 bg-slate-50/30">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#21a560] text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 text-slate-500 rounded-2xl rounded-tl-sm p-4 text-sm flex gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                <span
                  className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={askGemini}
          className="w-full p-5 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]"
        >
          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about the form logic..."
              className="w-full bg-slate-50 border border-slate-200 rounded-full pl-5 pr-12 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#21a560]/30 focus:border-[#21a560]/50 transition-all placeholder:text-slate-400 text-slate-800 shadow-inner"
            />
            <button
              type="submit"
              disabled={isTyping || !chatInput.trim()}
              className="absolute right-2 top-2 w-10 h-10 bg-[#0a2540] text-white rounded-full flex items-center justify-center hover:bg-[#153b61] disabled:opacity-50 transition-colors shadow-md"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </form>
      </div>

      )}

      {ENABLE_CHAT && (
      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        className={`absolute bottom-20 right-5 w-12 h-12 bg-[#0a2540] text-white rounded-full shadow-[0_10px_30px_rgba(10,37,64,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-[60] border-[3px] border-white ${isChatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare className="w-5 h-5" />
      </button>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `,
        }}
      />
      </div>
    </div>
  )
}
