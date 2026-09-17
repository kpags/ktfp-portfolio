<script setup lang="ts">
import faviconUrl from './assets/favicon/kp_favicon.ico'

useHead({
  link: [
    { rel: 'icon', type: 'image/x-icon', href: faviconUrl },
  ],
})

const homeImageModules = import.meta.glob('./assets/images/home/*', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const homeImageGroups = Object.entries(homeImageModules)
  .map(([path, url]) => ({
    order: Number(path.match(/\/(\d+)_/)?.[1]),
    path,
    url,
  }))
  .filter(({ order }) => Number.isFinite(order))
  .sort((first, second) => first.order - second.order || first.path.localeCompare(second.path))
  .reduce<Array<{ order: number; images: string[] }>>((groups, image) => {
    const currentGroup = groups.at(-1)
    if (!currentGroup || currentGroup.order !== image.order) {
      groups.push({ order: image.order, images: [image.url] })
    } else {
      currentGroup.images.push(image.url)
    }
    return groups
  }, [])

const episodeThumbnailModules = import.meta.glob('./assets/episode_thumbnails/**/*.{mp4,webm}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const episodeContentCaptionModules = import.meta.glob('./assets/episode_contents/**/caption.txt', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const episodeContentMediaModules = import.meta.glob('./assets/episode_contents/**/*.{mp4,webm,jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const episodeFolderNames = ['one', 'two', 'three', 'four', 'five']
const episodeClipSequences = episodeFolderNames.map(folder =>
  Object.entries(episodeThumbnailModules)
    .filter(([path]) => path.includes(`/episode_${folder}/`))
    .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
    .map(([, url]) => url),
)

type CaptionSegment = { html: string; isOverflowSplit?: boolean }
type EpisodeTimestamp = {
  folder: string
  captionSegments: CaptionSegment[]
  media: Array<{ url: string; type: 'image' | 'video' }>
}

const supportedCaptionTags = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'del', 'mark', 'small', 'sub', 'sup', 'code', 'kbd', 'br',
])

function escapeCaptionText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeCaptionHtml(segment: string) {
  const tagPattern = /<\/?([a-z][a-z0-9-]*)(?:\s[^<>]*)?\s*\/?\s*>/gi
  let sanitized = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(segment))) {
    sanitized += escapeCaptionText(segment.slice(lastIndex, match.index))
    const tagName = match[1].toLowerCase()
    const isClosingTag = match[0].startsWith('</')

    if (supportedCaptionTags.has(tagName)) {
      sanitized += tagName === 'br' ? '<br>' : isClosingTag ? `</${tagName}>` : `<${tagName}>`
    } else {
      sanitized += escapeCaptionText(match[0])
    }

    lastIndex = tagPattern.lastIndex
  }

  return sanitized + escapeCaptionText(segment.slice(lastIndex))
}

function splitCaption(caption: string) {
  return caption
    .trim()
    .split(/\r?\n+/)
    .flatMap(line => line.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9“'<])/))
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => ({ html: sanitizeCaptionHtml(segment) }))
}

function splitCaptionForFit(html: string) {
  const maximumCharacters = 120
  const tagPattern = /<\/?([a-z][a-z0-9-]*)>/gi
  const segments: CaptionSegment[] = []
  const activeTags: string[] = []
  let current = ''
  let visibleCharacters = 0
  let lastIndex = 0
  let match: RegExpExecArray | null

  const finishSegment = () => {
    const closedTags = [...activeTags].reverse().map(tag => `</${tag}>`).join('')
    if (current.trim()) segments.push({ html: `${current}${closedTags}`, isOverflowSplit: true })
    current = activeTags.map(tag => `<${tag}>`).join('')
    visibleCharacters = 0
  }

  const appendText = (text: string) => {
    const words = text.match(/\S+\s*|\s+/g) ?? []
    words.forEach(word => {
      const wordLength = word.replace(/\s/g, '').length
      if (visibleCharacters && visibleCharacters + wordLength > maximumCharacters) finishSegment()
      current += word
      visibleCharacters += wordLength
    })
  }

  while ((match = tagPattern.exec(html))) {
    appendText(html.slice(lastIndex, match.index))
    const tag = match[1].toLowerCase()
    const isClosingTag = match[0].startsWith('</')

    if (tag === 'br') {
      current += '<br>'
      visibleCharacters += 1
    } else if (isClosingTag) {
      current += match[0]
      const tagIndex = activeTags.lastIndexOf(tag)
      if (tagIndex !== -1) activeTags.splice(tagIndex, 1)
    } else {
      current += match[0]
      activeTags.push(tag)
    }
    lastIndex = tagPattern.lastIndex
  }

  appendText(html.slice(lastIndex))
  finishSegment()
  return segments
}

const sequenceNameOrder = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]

function getSequenceOrder(name: string) {
  const numericOrder = Number(name)
  return Number.isFinite(numericOrder) ? numericOrder : sequenceNameOrder.indexOf(name.toLowerCase()) + 1 || Number.MAX_SAFE_INTEGER
}

function compareSequenceNames(first: string, second: string) {
  return getSequenceOrder(first) - getSequenceOrder(second) || first.localeCompare(second, undefined, { numeric: true })
}

function getEpisodeTimestamps(episodeFolder: string): EpisodeTimestamp[] {
  const episodeDirectory = `/episode_${episodeFolder}/`
  const timestampFolders = [...new Set(
    Object.keys(episodeContentCaptionModules)
      .filter(path => path.includes(episodeDirectory))
      .map(path => path.match(/\/timestamp_([^/]+)\/caption\.txt$/)?.[1])
      .filter((folder): folder is string => Boolean(folder)),
  )].sort((first, second) => {
    return compareSequenceNames(first, second)
  })

  return timestampFolders
    .map(folder => {
      const directory = `${episodeDirectory}timestamp_${folder}/`
      const caption = Object.entries(episodeContentCaptionModules).find(([path]) => path.includes(directory))?.[1]
      const media = Object.entries(episodeContentMediaModules)
      .filter(([path]) => path.includes(directory))
      .map(([path, url]) => ({ path, url, type: /\.(mp4|webm)$/i.test(path) ? 'video' as const : 'image' as const }))
      .sort((firstMedia, secondMedia) => compareSequenceNames(
        firstMedia.path.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? firstMedia.path,
        secondMedia.path.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? secondMedia.path,
      ))
      .map(({ url, type }) => ({ url, type }))
      return caption ? { folder, captionSegments: splitCaption(caption), media } : null
    })
    .filter((timestamp): timestamp is EpisodeTimestamp => timestamp !== null)
}

const episodeTimestampSequences = reactive(episodeFolderNames.map(getEpisodeTimestamps))

type PortfolioPage = 'home' | 'library' | 'episode'
type PortfolioHistoryState = { portfolioPage?: PortfolioPage; episodeIndex?: number }

const isLibraryOpen = ref(false)
const isPlayerOpen = ref(false)
const activeEpisode = ref(0)
const hoveredEpisode = ref<number | null>(null)
const isPlaybackActive = ref(true)
const playbackPosition = ref(0)
const activeTimestampIndex = ref(0)
const activeCaptionIndex = ref(0)
const activeMediaIndex = ref(0)
const activeMediaVideo = ref<HTMLVideoElement | null>(null)
const captionElement = ref<HTMLElement | null>(null)
const captionFontSize = ref<string | null>(null)
const playbackFeedback = ref<'play' | 'pause' | 'previous' | 'next' | null>(null)
const playbackFeedbackKey = ref(0)
const activeHomeImageGroup = ref(0)
const isTransitioning = ref(false)
const isEpisodeLoading = ref(false)
const rippleDirection = ref<'previous' | 'next' | null>(null)
const transitionPhase = ref<'idle' | 'leaving' | 'entering'>('idle')
const introComplete = ref(false)
const portalStyle = ref<Record<string, string>>({})
const cursorStyle = ref<Record<string, string>>({})
const cursorIsInteractive = ref(false)
const cursorIsMoving = ref(false)
const cursorIsVisible = ref(false)
const pointerPosition = ref({ x: 0, y: 0 })
const trailPoints = ref(Array.from({ length: 6 }, () => ({ x: 0, y: 0 })))
const episodePreviewIndexes = ref(episodeFolderNames.map(() => 0))
const episodePreviewFading = ref(episodeFolderNames.map(() => false))
const previewingEpisode = ref<number | null>(null)
const episodeVideoRefs: Array<HTMLVideoElement | null> = []
const episodePreloadPromises = new Map<number, Promise<void>>()
let cursorStopTimer: ReturnType<typeof setTimeout> | undefined
let trailAnimationFrame: number | undefined
let homeImageTimer: ReturnType<typeof setInterval> | undefined
let captionAdvanceTimer: ReturnType<typeof setTimeout> | undefined
let mediaAdvanceTimer: ReturnType<typeof setTimeout> | undefined
let playbackFeedbackTimer: ReturnType<typeof setTimeout> | undefined
let captionFitFrame: number | undefined
let captionFitRequest = 0
let captionResizeObserver: ResizeObserver | undefined
let captionFitKey = ''
let isCaptionFitInProgress = false
let historyNavigationToken = 0
const episodePreviewTransitionTimers: Array<ReturnType<typeof setTimeout> | undefined> = []
let hasPointerPosition = false

const episodes = [
  { number: '01', title: 'About Me', label: 'Who am I & hobbies', className: 'about', clips: episodeClipSequences[0] },
  { number: '02', title: 'Education', label: 'The learning arc', className: 'education', clips: episodeClipSequences[1] },
  { number: '03', title: 'Skills', label: 'Tech & soft skills', className: 'skills', clips: episodeClipSequences[2] },
  { number: '04', title: 'Work Experience', label: 'Career highlights', className: 'work', clips: episodeClipSequences[3] },
  { number: '05', title: 'Contact Details & Resume', label: 'Details & resume', className: 'contact', clips: episodeClipSequences[4] },
]

const displayedEpisode = computed(() => episodes[hoveredEpisode.value ?? activeEpisode.value])
const playerEpisode = computed(() => episodes[activeEpisode.value])
const activeEpisodeTimestamps = computed(() => episodeTimestampSequences[activeEpisode.value] ?? [])
const activeTimestamp = computed(() => activeEpisodeTimestamps.value[activeTimestampIndex.value])
const activeCaption = computed(() => activeTimestamp.value?.captionSegments[activeCaptionIndex.value])
const activeMedia = computed(() => activeTimestamp.value?.media[activeMediaIndex.value])
const captionSegmentDuration = 5
const timestampStartPositions = computed(() => {
  let position = 0
  return activeEpisodeTimestamps.value.map(timestamp => {
    const start = position
    position += timestamp.captionSegments.length * captionSegmentDuration
    return start
  })
})
const playbackDuration = computed(() => activeEpisodeTimestamps.value.length
  ? Math.max(captionSegmentDuration, activeEpisodeTimestamps.value.reduce((total, timestamp) => total + timestamp.captionSegments.length * captionSegmentDuration, 0))
  : 300)

function beginTransition(event: MouseEvent, action: () => void) {
  if (isTransitioning.value) return
  portalStyle.value = {
    '--origin-x': `${event.clientX}px`,
    '--origin-y': `${event.clientY}px`,
  }
  isTransitioning.value = true
  transitionPhase.value = 'leaving'
  window.setTimeout(() => {
    action()
    transitionPhase.value = 'entering'
    window.setTimeout(() => {
      isTransitioning.value = false
      transitionPhase.value = 'idle'
      nextTick(() => document.querySelector<HTMLElement>('.episode-card--active')?.focus())
    }, 220)
  }, 500)
}

function beginDirectionalTransition(direction: 'previous' | 'next', action: () => void) {
  if (isTransitioning.value) return
  isTransitioning.value = true
  rippleDirection.value = direction
  transitionPhase.value = 'leaving'
  window.setTimeout(() => {
    action()
    transitionPhase.value = 'entering'
    window.setTimeout(() => {
      isTransitioning.value = false
      rippleDirection.value = null
      transitionPhase.value = 'idle'
    }, 420)
  }, 420)
}

function activateEpisode(index: number, openPlayer = false) {
  activeEpisode.value = index
  hoveredEpisode.value = null
  playbackPosition.value = 0
  isPlaybackActive.value = true
  activeTimestampIndex.value = 0
  activeCaptionIndex.value = 0
  if (openPlayer) isPlayerOpen.value = true
}

function getPortfolioPageFromLocation(): PortfolioHistoryState {
  const state = window.history.state as PortfolioHistoryState | null
  if (state?.portfolioPage) return state

  const match = window.location.hash.match(/^#\/episode\/(\d+)$/)
  if (match) return { portfolioPage: 'episode', episodeIndex: Number(match[1]) - 1 }
  return window.location.hash === '#/episodes' ? { portfolioPage: 'library' } : { portfolioPage: 'home' }
}

function getPortfolioPath(page: PortfolioPage, episodeIndex = activeEpisode.value) {
  if (page === 'episode') return `#/episode/${episodeIndex + 1}`
  return page === 'library' ? '#/episodes' : '#/'
}

function applyPortfolioPage(state: PortfolioHistoryState) {
  const page = state.portfolioPage ?? 'home'
  const episodeIndex = Number.isInteger(state.episodeIndex) && state.episodeIndex! >= 0 && state.episodeIndex! < episodes.length
    ? state.episodeIndex!
    : activeEpisode.value

  isLibraryOpen.value = page !== 'home'
  isPlayerOpen.value = page === 'episode'
  if (page === 'episode') activateEpisode(episodeIndex, true)
}

function writePortfolioHistory(page: PortfolioPage, episodeIndex = activeEpisode.value, replace = false) {
  const state: PortfolioHistoryState = { portfolioPage: page, ...(page === 'episode' ? { episodeIndex } : {}) }
  const method = replace ? 'replaceState' : 'pushState'
  window.history[method](state, '', getPortfolioPath(page, episodeIndex))
}

function navigatePortfolio(page: PortfolioPage, episodeIndex = activeEpisode.value) {
  applyPortfolioPage({ portfolioPage: page, episodeIndex })
  writePortfolioHistory(page, episodeIndex)
}

async function restorePortfolioPage(state: PortfolioHistoryState) {
  const page = state.portfolioPage ?? 'home'
  const episodeIndex = Number.isInteger(state.episodeIndex) && state.episodeIndex! >= 0 && state.episodeIndex! < episodes.length
    ? state.episodeIndex!
    : activeEpisode.value
  const token = ++historyNavigationToken
  if (page === 'episode') await prepareEpisodeContents(episodeIndex)
  if (token !== historyNavigationToken) return
  applyPortfolioPage({ portfolioPage: page, episodeIndex })
}

function handleBrowserNavigation() {
  void restorePortfolioPage(getPortfolioPageFromLocation())
}

function preloadMedia(url: string, type: 'image' | 'video') {
  return new Promise<void>((resolve) => {
    if (type === 'image') {
      const image = new Image()
      image.onload = () => resolve()
      image.onerror = () => resolve()
      image.src = url
      return
    }

    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.oncanplaythrough = () => resolve()
    video.onerror = () => resolve()
    video.src = url
    video.load()
  })
}

function preloadEpisodeContents(index: number) {
  const existingPreload = episodePreloadPromises.get(index)
  if (existingPreload) return existingPreload

  const media = (episodeTimestampSequences[index] ?? []).flatMap(timestamp => timestamp.media)
  const preload = Promise.all(media.map(item => preloadMedia(item.url, item.type))).then(() => undefined)
  episodePreloadPromises.set(index, preload)
  return preload
}

async function prepareEpisodeContents(index: number) {
  const hasContent = (episodeTimestampSequences[index] ?? []).some(timestamp => timestamp.media.length)
  const isCached = episodePreloadPromises.has(index)
  if (!hasContent || isCached) {
    await preloadEpisodeContents(index)
    return
  }

  isEpisodeLoading.value = true
  try {
    await preloadEpisodeContents(index)
  } finally {
    isEpisodeLoading.value = false
  }
}

function openLibrary(event: MouseEvent) {
  beginTransition(event, () => { navigatePortfolio('library') })
}

async function openEpisodePlayer(event: MouseEvent, index: number) {
  if (isTransitioning.value || isEpisodeLoading.value) return
  await prepareEpisodeContents(index)
  beginTransition(event, () => { navigatePortfolio('episode', index) })
}

function closePlayer(event: MouseEvent) {
  beginTransition(event, () => { navigatePortfolio('library') })
}

function setHoveredEpisode(index: number | null) {
  hoveredEpisode.value = index
}

async function changeEpisode(event: MouseEvent, direction: -1 | 1) {
  const nextIndex = activeEpisode.value + direction
  if (nextIndex < 0 || nextIndex >= episodes.length || isTransitioning.value || isEpisodeLoading.value) return
  await prepareEpisodeContents(nextIndex)
  beginDirectionalTransition(direction === -1 ? 'previous' : 'next', () => { navigatePortfolio('episode', nextIndex) })
}

function skipPlayback(seconds: number) {
  seekPlayback(playbackPosition.value + seconds)
  showPlaybackFeedback(seconds < 0 ? 'previous' : 'next')
}

function selectTimestamp(index: number) {
  seekPlayback(timestampStartPositions.value[index] ?? 0)
}

function seekPlayback(position: number) {
  playbackPosition.value = Math.min(playbackDuration.value, Math.max(0, position))
  if (!activeEpisodeTimestamps.value.length) return

  let elapsed = 0
  for (let index = 0; index < activeEpisodeTimestamps.value.length; index += 1) {
    const timestamp = activeEpisodeTimestamps.value[index]
    const timestampDuration = timestamp.captionSegments.length * captionSegmentDuration
    if (playbackPosition.value < elapsed + timestampDuration || index === activeEpisodeTimestamps.value.length - 1) {
      activeTimestampIndex.value = index
      activeCaptionIndex.value = Math.min(
        timestamp.captionSegments.length - 1,
        Math.floor((playbackPosition.value - elapsed) / captionSegmentDuration),
      )
      return
    }
    elapsed += timestampDuration
  }
}

function handleProgressInput(event: Event) {
  seekPlayback(Number((event.target as HTMLInputElement).value))
}

function advanceTimestampMedia() {
  const mediaCount = activeTimestamp.value?.media.length ?? 0
  if (!mediaCount) return
  activeMediaIndex.value = (activeMediaIndex.value + 1) % mediaCount
}

function scheduleMediaAdvance() {
  if (mediaAdvanceTimer) clearTimeout(mediaAdvanceTimer)
  if (!isPlayerOpen.value || !activeEpisodeTimestamps.value.length || !isPlaybackActive.value || activeMedia.value?.type !== 'image') return
  mediaAdvanceTimer = window.setTimeout(advanceTimestampMedia, 3000)
}

function scheduleCaptionAdvance() {
  if (captionAdvanceTimer) clearTimeout(captionAdvanceTimer)
  if (!isPlayerOpen.value || !activeEpisodeTimestamps.value.length || !isPlaybackActive.value || !activeTimestamp.value) return

  captionAdvanceTimer = window.setTimeout(() => {
    const nextPosition = playbackPosition.value + captionSegmentDuration
    seekPlayback(nextPosition)
    if (nextPosition >= playbackDuration.value) isPlaybackActive.value = false
  }, captionSegmentDuration * 1000)
}

function setCaptionElement(element: Element | null) {
  const nextCaptionElement = element instanceof HTMLElement ? element : null
  if (captionElement.value === nextCaptionElement) return
  captionElement.value = nextCaptionElement
  captionResizeObserver?.disconnect()
  if (captionElement.value?.parentElement) captionResizeObserver?.observe(captionElement.value.parentElement)
  requestCaptionFit()
}

function requestCaptionFit() {
  if (isCaptionFitInProgress) return
  captionFitRequest += 1
  if (captionFitFrame) window.cancelAnimationFrame(captionFitFrame)
  const request = captionFitRequest
  captionFitFrame = window.requestAnimationFrame(() => { void fitCaption(request) })
}

function getCaptionAvailableHeight(caption: HTMLElement) {
  const container = caption.parentElement
  const count = container?.querySelector<HTMLElement>('.episode-caption__count')
  if (!container || !count) return 0

  const containerStyles = window.getComputedStyle(container)
  return container.clientHeight
    - Number.parseFloat(containerStyles.paddingTop)
    - Number.parseFloat(containerStyles.paddingBottom)
    - count.offsetHeight
    - Number.parseFloat(window.getComputedStyle(count).marginBottom)
}

function getCaptionFitKey(caption: HTMLElement, availableHeight: number) {
  const { width, height } = caption.getBoundingClientRect()
  return [activeCaption.value?.html, Math.round(width), Math.round(height), Math.round(availableHeight), window.matchMedia('(max-width: 560px)').matches].join('|')
}

function measureCaptionFontSize(caption: HTMLElement, availableHeight: number, minimumSize: number) {
  const sourceContainer = caption.parentElement
  if (!sourceContainer) return null

  const measureContainer = sourceContainer.cloneNode(false) as HTMLElement
  const measureCaption = caption.cloneNode(true) as HTMLElement
  measureContainer.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;display:block;width:${caption.getBoundingClientRect().width}px;height:auto;min-height:0;padding:0;overflow:visible;`
  measureCaption.style.maxHeight = 'none'
  measureCaption.style.overflow = 'visible'
  measureCaption.style.fontSize = ''
  measureContainer.appendChild(measureCaption)
  document.body.appendChild(measureContainer)

  let fontSize = Number.parseFloat(window.getComputedStyle(measureCaption).fontSize)
  while (measureCaption.scrollHeight > availableHeight && fontSize > minimumSize) {
    fontSize = Math.max(minimumSize, fontSize - .5)
    measureCaption.style.fontSize = `${fontSize}px`
  }

  const fits = measureCaption.scrollHeight <= availableHeight
  measureContainer.remove()
  return { fontSize, fits }
}

async function fitCaption(request: number) {
  await nextTick()
  if (request !== captionFitRequest || !captionElement.value || !activeCaption.value) return

  const caption = captionElement.value
  const availableHeight = getCaptionAvailableHeight(caption)
  if (availableHeight <= 0) return
  const fitKey = getCaptionFitKey(caption, availableHeight)
  if (fitKey === captionFitKey) return

  isCaptionFitInProgress = true
  const minimumSize = window.matchMedia('(max-width: 560px)').matches ? 16 : 18.4
  const result = measureCaptionFontSize(caption, availableHeight, minimumSize)
  if (!result) {
    isCaptionFitInProgress = false
    return
  }
  let needsRefit = false

  if (result.fits) {
    captionFontSize.value = `${result.fontSize}px`
    captionFitKey = fitKey
  } else if (!activeCaption.value.isOverflowSplit) {
    const splitSegments = splitCaptionForFit(activeCaption.value.html)
    if (splitSegments.length > 1) {
      activeTimestamp.value?.captionSegments.splice(activeCaptionIndex.value, 1, ...splitSegments)
      captionFitKey = ''
      needsRefit = true
    }
  } else {
    captionFontSize.value = `${minimumSize}px`
    captionFitKey = fitKey
  }

  isCaptionFitInProgress = false
  if (request !== captionFitRequest || needsRefit) requestCaptionFit()
}

function setActiveMediaVideo(element: Element | null) {
  activeMediaVideo.value = element instanceof HTMLVideoElement ? element : null
}

function syncActiveMediaPlayback() {
  const video = activeMediaVideo.value
  if (!video) return
  if (isPlaybackActive.value) {
    video.play().catch(() => undefined)
  } else {
    video.pause()
  }
}

function showPlaybackFeedback(feedback: NonNullable<typeof playbackFeedback.value>) {
  playbackFeedback.value = feedback
  playbackFeedbackKey.value += 1
  if (playbackFeedbackTimer) clearTimeout(playbackFeedbackTimer)
  playbackFeedbackTimer = window.setTimeout(() => { playbackFeedback.value = null }, 500)
}

function togglePlayback() {
  isPlaybackActive.value = !isPlaybackActive.value
  showPlaybackFeedback(isPlaybackActive.value ? 'play' : 'pause')
}

function setEpisodeVideo(index: number, element: Element | null) {
  episodeVideoRefs[index] = element instanceof HTMLVideoElement ? element : null
}

function startEpisodePreview(index: number) {
  if (!episodes[index].clips.length) return
  previewingEpisode.value = index
  episodePreviewIndexes.value[index] = 0
  nextTick(() => {
    const video = episodeVideoRefs[index]
    if (!video) return
    video.currentTime = 0
    video.play().catch(() => undefined)
  })
}

function playNextPreviewClip(index: number) {
  const clips = episodes[index].clips
  if (!clips.length || previewingEpisode.value !== index) return
  episodeVideoRefs[index]?.pause()
  episodePreviewFading.value[index] = true
  episodePreviewTransitionTimers[index] = window.setTimeout(() => {
    if (previewingEpisode.value !== index) return
    episodePreviewIndexes.value[index] = (episodePreviewIndexes.value[index] + 1) % clips.length
    nextTick(() => {
      const nextVideo = episodeVideoRefs[index]
      if (!nextVideo) return
      nextVideo.load()
      episodePreviewFading.value[index] = false
      nextVideo.play().catch(() => undefined)
    })
  }, 180)
}

function resetEpisodePreview(index: number) {
  if (!episodes[index].clips.length) return
  if (episodePreviewTransitionTimers[index]) clearTimeout(episodePreviewTransitionTimers[index])
  previewingEpisode.value = null
  episodePreviewFading.value[index] = false
  const video = episodeVideoRefs[index]
  if (video) video.pause()
  episodePreviewIndexes.value[index] = 0
  nextTick(() => {
    const thumbnailVideo = episodeVideoRefs[index]
    if (!thumbnailVideo) return
    thumbnailVideo.load()
  })
}

function setThumbnailFrame(index: number) {
  if (previewingEpisode.value === index) return
  const video = episodeVideoRefs[index]
  if (!video) return
  video.pause()
  video.currentTime = .05
}

function closeLibrary(event: MouseEvent) {
  beginTransition(event, () => { navigatePortfolio('home') })
}

function goHome() {
  navigatePortfolio('home')
}

function moveCursor(event: MouseEvent) {
  cursorStyle.value = { '--cursor-x': `${event.clientX}px`, '--cursor-y': `${event.clientY}px` }
  pointerPosition.value = { x: event.clientX, y: event.clientY }
  if (!hasPointerPosition) {
    trailPoints.value = Array.from({ length: 6 }, () => ({ x: event.clientX, y: event.clientY }))
    hasPointerPosition = true
  }
  cursorIsVisible.value = true
  cursorIsInteractive.value = Boolean((event.target as HTMLElement).closest('button, a'))
  cursorIsMoving.value = true
  if (cursorStopTimer) clearTimeout(cursorStopTimer)
  cursorStopTimer = setTimeout(() => { cursorIsMoving.value = false }, 85)
}

function hideCursor() {
  cursorIsVisible.value = false
  cursorIsMoving.value = false
}

function animateTrail() {
  trailPoints.value = trailPoints.value.map((point, index, points) => {
    const target = index === 0 ? pointerPosition.value : points[index - 1]
    const followSpeed = .31 - index * .035
    return { x: point.x + (target.x - point.x) * followSpeed, y: point.y + (target.y - point.y) * followSpeed }
  })
  trailAnimationFrame = window.requestAnimationFrame(animateTrail)
}

onMounted(() => {
  window.setTimeout(() => { introComplete.value = true }, 2250)
  trailAnimationFrame = window.requestAnimationFrame(animateTrail)
  if (homeImageGroups.length > 1) {
    homeImageTimer = window.setInterval(() => {
      activeHomeImageGroup.value = (activeHomeImageGroup.value + 1) % homeImageGroups.length
    }, 5000)
  }
  captionResizeObserver = new ResizeObserver(requestCaptionFit)
  window.addEventListener('resize', requestCaptionFit)
  document.fonts?.ready.then(requestCaptionFit)
  const initialPage = getPortfolioPageFromLocation()
  writePortfolioHistory(initialPage.portfolioPage ?? 'home', initialPage.episodeIndex, true)
  void restorePortfolioPage(initialPage)
  window.addEventListener('popstate', handleBrowserNavigation)
})

watch([isPlayerOpen, activeEpisode, isPlaybackActive, activeTimestampIndex, activeCaptionIndex], scheduleCaptionAdvance)
watch([isPlayerOpen, activeEpisode, activeTimestampIndex, activeCaptionIndex], requestCaptionFit)
watch([isPlayerOpen, activeEpisode, activeTimestampIndex], () => { activeMediaIndex.value = 0 })
watch([isPlayerOpen, activeEpisode, isPlaybackActive, activeTimestampIndex, activeMediaIndex], scheduleMediaAdvance)
watch([isPlaybackActive, activeMedia], () => { nextTick(syncActiveMediaPlayback) })

onBeforeUnmount(() => {
  if (cursorStopTimer) clearTimeout(cursorStopTimer)
  if (trailAnimationFrame) window.cancelAnimationFrame(trailAnimationFrame)
  if (homeImageTimer) clearInterval(homeImageTimer)
  if (captionAdvanceTimer) clearTimeout(captionAdvanceTimer)
  if (mediaAdvanceTimer) clearTimeout(mediaAdvanceTimer)
  if (playbackFeedbackTimer) clearTimeout(playbackFeedbackTimer)
  if (captionFitFrame) window.cancelAnimationFrame(captionFitFrame)
  captionResizeObserver?.disconnect()
  window.removeEventListener('resize', requestCaptionFit)
  window.removeEventListener('popstate', handleBrowserNavigation)
  episodePreviewTransitionTimers.forEach(timer => { if (timer) clearTimeout(timer) })
})
</script>

<template>
  <main class="site-shell" @mousemove="moveCursor" @mouseleave="hideCursor" @mouseenter="moveCursor">
    <template v-if="introComplete && cursorIsVisible">
      <span v-if="!cursorIsInteractive" v-for="(point, index) in trailPoints" :key="index" class="cursor-tail" :style="{ left: `${point.x}px`, top: `${point.y}px`, width: `${8 - index}px`, height: `${8 - index}px`, opacity: `${.5 - index * .06}` }" aria-hidden="true"></span>
      <div :class="['cursor', { 'cursor--interactive': cursorIsInteractive, 'cursor--moving': cursorIsMoving }]" :style="cursorStyle" aria-hidden="true"></div>
    </template>
    <Transition name="content-loader">
      <div v-if="isEpisodeLoading" class="content-loader" role="status" aria-live="polite" aria-label="Wait for a moment">
        <span v-for="(character, index) in 'Wait for a moment...'.split('')" :key="index" class="content-loader__letter" :style="{ '--letter-index': index }">{{ character === ' ' ? '\u00a0' : character }}</span>
      </div>
    </Transition>
    <section v-if="!introComplete" class="intro" aria-label="Kurt Paguio">
      <p class="intro-kurt">KURT</p><p class="intro-paguio">PAGUIO</p>
    </section>
    <div v-if="isTransitioning && !rippleDirection" class="portal" :style="portalStyle" aria-hidden="true"><span></span><span></span></div>
    <div v-if="rippleDirection" :class="['episode-ripple', `episode-ripple--${rippleDirection}`]" aria-hidden="true"><span></span><span></span></div>
    <section v-if="!isLibraryOpen" :class="['hero', { 'hero--leaving': transitionPhase === 'leaving' }]" aria-labelledby="hero-title">
      <nav class="nav">
        <button class="brand" aria-label="Kurt Paguio home" @click="goHome">KURT<span>PAGUIO</span></button>
        <button class="menu-button" aria-label="Open episode selector" @click="openLibrary"><i></i><i></i></button>
      </nav>

      <div class="hero-content">
        <p class="eyebrow">GET TO KNOW AN AMAZING SOFTWARE ENGINEER</p>
        <h1 id="hero-title">HI!<br /><em>I AM KURT.</em></h1>
        <div class="hero-meta"><span>2026</span><span>PORTFOLIO</span><span class="rating">5 EPS</span></div>
        <p class="hero-copy">Story of a boy who dreams to be in the world of tech and currently exploring. Get to know him one episode at a time.</p>
        <button class="play-button" @click="openLibrary"><b>▶</b> Play Now</button>
      </div>
      <div v-if="homeImageGroups.length" class="home-image-showcase" aria-label="Kurt Paguio through the years">
        <div
          v-for="(group, index) in homeImageGroups"
          :key="group.order"
          :class="['home-image-group', `home-image-group--${group.order}`, { 'home-image-group--active': activeHomeImageGroup === index }]"
        >
          <img v-for="image in group.images" :key="image" :src="image" alt="" />
        </div>
      </div>
      <div class="droplet-field" aria-hidden="true"><span v-for="n in 8" :key="n"></span></div>
    </section>

    <section v-if="isLibraryOpen && !isPlayerOpen" :class="['library', { 'library--leaving': transitionPhase === 'leaving', 'library--entering': transitionPhase === 'entering' }]" aria-labelledby="library-title">
      <nav class="nav">
        <button class="brand" aria-label="Back to home" @click="closeLibrary">KURT<span>PAGUIO</span></button>
        <button class="back-button" @click="closeLibrary">← Back</button>
      </nav>

      <div class="library-heading">
        <p class="eyebrow">NOW STREAMING</p>
        <h2 id="library-title">The Engineer<br /><em>Behind the Screen.</em></h2>
        <p>Choose an episode to start the get-to-know me.</p>
      </div>

      <div class="episode-rail" role="list" aria-label="Portfolio episodes">
        <button
          v-for="(episode, index) in episodes"
          :key="episode.number"
          :class="['episode-card', `episode-card--${episode.className}`, { 'episode-card--active': activeEpisode === index }]"
          role="listitem"
          :aria-label="`Play episode ${episode.number}: ${episode.title}`"
          @click="openEpisodePlayer($event, index)"
          @mouseenter="startEpisodePreview(index); setHoveredEpisode(index)"
          @mouseleave="resetEpisodePreview(index); setHoveredEpisode(null)"
          @touchstart="startEpisodePreview(index); setHoveredEpisode(index)"
          @touchend="resetEpisodePreview(index); setHoveredEpisode(null)"
          @touchcancel="resetEpisodePreview(index); setHoveredEpisode(null)"
          @focus="setHoveredEpisode(index)"
          @blur="setHoveredEpisode(null)"
        >
          <video
            v-if="episode.clips.length"
            :ref="element => setEpisodeVideo(index, element)"
            :class="['episode-preview', { 'episode-preview--fading': episodePreviewFading[index] }]"
            :src="episode.clips[episodePreviewIndexes[index]]"
            muted
            playsinline
            preload="metadata"
            aria-hidden="true"
            @ended="playNextPreviewClip(index)"
            @loadeddata="setThumbnailFrame(index)"
          ></video>
          <span class="episode-index">EP. {{ episode.number }}</span>
          <span class="episode-title">{{ episode.title }}</span>
          <span class="episode-subtitle">{{ episode.label }}</span>
          <span class="watch-icon">↗</span>
        </button>
      </div>

      <div class="episode-detail">
        <span class="detail-pulse"></span>
        <p>SELECTED EPISODE</p>
        <strong>EP. {{ displayedEpisode.number }} — {{ displayedEpisode.title }}</strong>
      </div>
    </section>

    <section v-if="isPlayerOpen" :class="['player-page', { 'player-page--leaving': transitionPhase === 'leaving' }]" aria-labelledby="player-title">
      <nav class="nav">
        <button class="brand" aria-label="Back to home" @click="goHome">KURT<span>PAGUIO</span></button>
        <button class="back-button" @click="closePlayer">← Episodes</button>
      </nav>

      <div class="player-content">
        <p class="eyebrow">NOW PLAYING</p>
        <div class="video-player" role="region" :aria-label="`Episode ${playerEpisode.number} video player`">
          <div v-if="activeEpisodeTimestamps.length && activeTimestamp" class="episode-content-stage">
            <h1 id="player-title" class="sr-only">{{ playerEpisode.title }}</h1>
            <div v-if="playbackFeedback" :key="playbackFeedbackKey" :class="['playback-feedback', { 'playback-feedback--left': playbackFeedback === 'previous', 'playback-feedback--right': playbackFeedback === 'next' }]" aria-hidden="true"><span v-if="playbackFeedback === 'previous' || playbackFeedback === 'next'">5 seconds</span><template v-else>{{ playbackFeedback === 'pause' ? '❚❚' : '▶' }}</template></div>
            <div class="timestamp-rail" :style="{ '--timestamp-count': activeEpisodeTimestamps.length }" :aria-label="`${playerEpisode.title} timestamps`">
              <button
                v-for="(timestamp, index) in activeEpisodeTimestamps"
                :key="timestamp.folder"
                :class="['timestamp-button', { 'timestamp-button--active': activeTimestampIndex === index }]"
                :aria-label="`Show timestamp ${index + 1}`"
                :aria-pressed="activeTimestampIndex === index"
                @click="selectTimestamp(index)"
              >{{ String(index + 1).padStart(2, '0') }}</button>
            </div>
            <div class="episode-content-grid">
              <div class="episode-caption" aria-live="polite">
                <span class="episode-caption__count">{{ String(activeCaptionIndex + 1).padStart(2, '0') }} / {{ String(activeTimestamp.captionSegments.length).padStart(2, '0') }}</span>
                <p v-if="activeCaption" :ref="setCaptionElement" :style="captionFontSize ? { fontSize: captionFontSize } : undefined" v-html="activeCaption.html"></p>
              </div>
              <div class="episode-media">
                <Transition name="episode-media" mode="out-in">
                  <div v-if="activeMedia" :key="activeMedia.url" class="episode-media__item">
                    <video v-if="activeMedia.type === 'video'" :ref="setActiveMediaVideo" :src="activeMedia.url" :autoplay="isPlaybackActive" muted playsinline preload="metadata" :aria-label="`${playerEpisode.title} media`" @ended="advanceTimestampMedia"></video>
                    <img v-else :src="activeMedia.url" :alt="`${playerEpisode.title} media`" />
                  </div>
                </Transition>
              </div>
            </div>
          </div>
          <div v-else class="video-player__screen">
            <span>EP. {{ playerEpisode.number }}</span>
            <h1 id="player-title">{{ playerEpisode.title }}</h1>
            <p>Video coming soon</p>
          </div>
          <div class="video-player__controls">
            <input :value="playbackPosition" class="progress-control" type="range" min="0" :max="playbackDuration" step=".1" aria-label="Video progress" @input="handleProgressInput" />
            <div class="control-row">
              <div class="control-group">
                <button class="player-control" :disabled="activeEpisode === 0" aria-label="Previous episode" title="Previous episode" @click="changeEpisode($event, -1)">⏮</button>
                <button class="player-control" aria-label="Previous 5 seconds" title="Previous 5 seconds" @click="skipPlayback(-5)">↶</button>
                <button class="player-control player-control--primary" :aria-label="isPlaybackActive ? 'Pause' : 'Play'" :title="isPlaybackActive ? 'Pause' : 'Play'" @click="togglePlayback">{{ isPlaybackActive ? '❚❚' : '▶' }}</button>
                <button class="player-control" aria-label="Next 5 seconds" title="Next 5 seconds" @click="skipPlayback(5)">↷</button>
                <button class="player-control" :disabled="activeEpisode === episodes.length - 1" aria-label="Next episode" title="Next episode" @click="changeEpisode($event, 1)">⏭</button>
              </div>
            </div>
          </div>
        </div>
        <div class="player-episode-meta"><span>EP. {{ playerEpisode.number }}</span><strong>{{ playerEpisode.title }}</strong><span>{{ playerEpisode.label }}</span></div>
      </div>
    </section>
  </main>
</template>
