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

const episodeOneCaptionModules = import.meta.glob('./assets/episode_contents/episode_one/**/caption.txt', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const episodeOneMediaModules = import.meta.glob('./assets/episode_contents/episode_one/**/*.{mp4,webm,jpg,jpeg,png,webp}', {
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

type CaptionPart = { text: string; italic: boolean }
type EpisodeTimestamp = {
  folder: string
  captionSegments: Array<{ parts: CaptionPart[] }>
  media: Array<{ url: string; type: 'image' | 'video' }>
}

function getCaptionParts(segment: string): CaptionPart[] {
  const parts: CaptionPart[] = []
  const italicPattern = /<i>([\s\S]*?)<\/i>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = italicPattern.exec(segment))) {
    if (match.index > lastIndex) parts.push({ text: segment.slice(lastIndex, match.index), italic: false })
    parts.push({ text: match[1], italic: true })
    lastIndex = italicPattern.lastIndex
  }

  if (lastIndex < segment.length) parts.push({ text: segment.slice(lastIndex), italic: false })
  return parts.length ? parts : [{ text: segment, italic: false }]
}

function splitCaption(caption: string) {
  return caption
    .trim()
    .split(/\r?\n+/)
    .flatMap(line => line.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9“'<])/))
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => ({ parts: getCaptionParts(segment) }))
}

const timestampNameOrder = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const episodeOneTimestampFolders = [...new Set(
  Object.keys(episodeOneCaptionModules)
    .map(path => path.match(/\/timestamp_([^/]+)\/caption\.txt$/)?.[1])
    .filter((folder): folder is string => Boolean(folder)),
)].sort((first, second) => {
  const firstNumeric = Number(first)
  const secondNumeric = Number(second)
  const firstOrder = Number.isFinite(firstNumeric) ? firstNumeric : timestampNameOrder.indexOf(first) + 1 || Number.MAX_SAFE_INTEGER
  const secondOrder = Number.isFinite(secondNumeric) ? secondNumeric : timestampNameOrder.indexOf(second) + 1 || Number.MAX_SAFE_INTEGER
  return firstOrder - secondOrder || first.localeCompare(second, undefined, { numeric: true })
})

const episodeOneTimestamps = episodeOneTimestampFolders
  .map(folder => {
    const directory = `/timestamp_${folder}/`
    const caption = Object.entries(episodeOneCaptionModules).find(([path]) => path.includes(directory))?.[1]
    const media = Object.entries(episodeOneMediaModules)
      .filter(([path]) => path.includes(directory))
      .map(([path, url]) => ({ path, url, type: /\.(mp4|webm)$/i.test(path) ? 'video' as const : 'image' as const }))
      .sort((firstMedia, secondMedia) => {
        if (firstMedia.type !== secondMedia.type) return firstMedia.type === 'image' ? -1 : 1
        return firstMedia.path.localeCompare(secondMedia.path, undefined, { numeric: true })
      })
      .map(({ url, type }) => ({ url, type }))

    return caption ? { folder, captionSegments: splitCaption(caption), media } : null
  })
  .filter((timestamp): timestamp is EpisodeTimestamp => timestamp !== null)

const isLibraryOpen = ref(false)
const isPlayerOpen = ref(false)
const activeEpisode = ref(0)
const hoveredEpisode = ref<number | null>(null)
const isPlaybackActive = ref(true)
const playbackPosition = ref(0)
const activeTimestampIndex = ref(0)
const activeCaptionIndex = ref(0)
const activeMediaIndex = ref(0)
const activeHomeImageGroup = ref(0)
const isTransitioning = ref(false)
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
let cursorStopTimer: ReturnType<typeof setTimeout> | undefined
let trailAnimationFrame: number | undefined
let homeImageTimer: ReturnType<typeof setInterval> | undefined
let captionAdvanceTimer: ReturnType<typeof setTimeout> | undefined
let mediaAdvanceTimer: ReturnType<typeof setTimeout> | undefined
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
const activeTimestamp = computed(() => episodeOneTimestamps[activeTimestampIndex.value])
const activeCaption = computed(() => activeTimestamp.value?.captionSegments[activeCaptionIndex.value])
const activeMedia = computed(() => activeTimestamp.value?.media[activeMediaIndex.value])
const captionSegmentDuration = 4.5
const timestampStartPositions = computed(() => {
  let position = 0
  return episodeOneTimestamps.map(timestamp => {
    const start = position
    position += timestamp.captionSegments.length * captionSegmentDuration
    return start
  })
})
const playbackDuration = computed(() => activeEpisode.value === 0
  ? Math.max(captionSegmentDuration, episodeOneTimestamps.reduce((total, timestamp) => total + timestamp.captionSegments.length * captionSegmentDuration, 0))
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

function openLibrary(event: MouseEvent) {
  beginTransition(event, () => { isLibraryOpen.value = true })
}

function openEpisodePlayer(event: MouseEvent, index: number) {
  beginTransition(event, () => {
    activeEpisode.value = index
    hoveredEpisode.value = null
    playbackPosition.value = 0
    isPlaybackActive.value = true
    activeTimestampIndex.value = 0
    activeCaptionIndex.value = 0
    isPlayerOpen.value = true
  })
}

function closePlayer(event: MouseEvent) {
  beginTransition(event, () => { isPlayerOpen.value = false })
}

function setHoveredEpisode(index: number | null) {
  hoveredEpisode.value = index
}

function changeEpisode(event: MouseEvent, direction: -1 | 1) {
  const nextIndex = activeEpisode.value + direction
  if (nextIndex < 0 || nextIndex >= episodes.length) return
  beginTransition(event, () => {
    activeEpisode.value = nextIndex
    playbackPosition.value = 0
    isPlaybackActive.value = true
    activeTimestampIndex.value = 0
    activeCaptionIndex.value = 0
  })
}

function skipPlayback(seconds: number) {
  seekPlayback(playbackPosition.value + seconds)
}

function selectTimestamp(index: number) {
  seekPlayback(timestampStartPositions.value[index] ?? 0)
}

function seekPlayback(position: number) {
  playbackPosition.value = Math.min(playbackDuration.value, Math.max(0, position))
  if (activeEpisode.value !== 0 || !episodeOneTimestamps.length) return

  let elapsed = 0
  for (let index = 0; index < episodeOneTimestamps.length; index += 1) {
    const timestamp = episodeOneTimestamps[index]
    const timestampDuration = timestamp.captionSegments.length * captionSegmentDuration
    if (playbackPosition.value < elapsed + timestampDuration || index === episodeOneTimestamps.length - 1) {
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
  if (!isPlayerOpen.value || activeEpisode.value !== 0 || !isPlaybackActive.value || activeMedia.value?.type !== 'image') return
  mediaAdvanceTimer = window.setTimeout(advanceTimestampMedia, 3000)
}

function scheduleCaptionAdvance() {
  if (captionAdvanceTimer) clearTimeout(captionAdvanceTimer)
  if (!isPlayerOpen.value || activeEpisode.value !== 0 || !isPlaybackActive.value || !activeTimestamp.value) return

  captionAdvanceTimer = window.setTimeout(() => {
    const nextPosition = playbackPosition.value + captionSegmentDuration
    seekPlayback(nextPosition)
    if (nextPosition >= playbackDuration.value) isPlaybackActive.value = false
  }, 4500)
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
  beginTransition(event, () => { isLibraryOpen.value = false })
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
})

watch([isPlayerOpen, activeEpisode, isPlaybackActive, activeTimestampIndex, activeCaptionIndex], scheduleCaptionAdvance)
watch([isPlayerOpen, activeEpisode, activeTimestampIndex], () => { activeMediaIndex.value = 0 })
watch([isPlayerOpen, activeEpisode, isPlaybackActive, activeTimestampIndex, activeMediaIndex], scheduleMediaAdvance)

onBeforeUnmount(() => {
  if (cursorStopTimer) clearTimeout(cursorStopTimer)
  if (trailAnimationFrame) window.cancelAnimationFrame(trailAnimationFrame)
  if (homeImageTimer) clearInterval(homeImageTimer)
  if (captionAdvanceTimer) clearTimeout(captionAdvanceTimer)
  if (mediaAdvanceTimer) clearTimeout(mediaAdvanceTimer)
  episodePreviewTransitionTimers.forEach(timer => { if (timer) clearTimeout(timer) })
})
</script>

<template>
  <main class="site-shell" @mousemove="moveCursor" @mouseleave="hideCursor" @mouseenter="moveCursor">
    <template v-if="introComplete && cursorIsVisible">
      <span v-if="!cursorIsInteractive" v-for="(point, index) in trailPoints" :key="index" class="cursor-tail" :style="{ left: `${point.x}px`, top: `${point.y}px`, width: `${8 - index}px`, height: `${8 - index}px`, opacity: `${.5 - index * .06}` }" aria-hidden="true"></span>
      <div :class="['cursor', { 'cursor--interactive': cursorIsInteractive, 'cursor--moving': cursorIsMoving }]" :style="cursorStyle" aria-hidden="true"></div>
    </template>
    <section v-if="!introComplete" class="intro" aria-label="Kurt Paguio">
      <p class="intro-kurt">KURT</p><p class="intro-paguio">PAGUIO</p>
    </section>
    <div v-if="isTransitioning" class="portal" :style="portalStyle" aria-hidden="true"><span></span><span></span></div>
    <section v-if="!isLibraryOpen" :class="['hero', { 'hero--leaving': transitionPhase === 'leaving' }]" aria-labelledby="hero-title">
      <nav class="nav">
        <button class="brand" aria-label="Kurt Paguio home" @click="isLibraryOpen = false">KURT<span>PAGUIO</span></button>
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
        <span>Content placeholder · Coming soon</span>
      </div>
    </section>

    <section v-if="isPlayerOpen" :class="['player-page', { 'player-page--leaving': transitionPhase === 'leaving' }]" aria-labelledby="player-title">
      <nav class="nav">
        <button class="brand" aria-label="Back to home" @click="isPlayerOpen = false; isLibraryOpen = false">KURT<span>PAGUIO</span></button>
        <button class="back-button" @click="closePlayer">← Episodes</button>
      </nav>

      <div class="player-content">
        <p class="eyebrow">NOW PLAYING</p>
        <div class="video-player" role="region" :aria-label="`Episode ${playerEpisode.number} video player`">
          <div v-if="activeEpisode === 0 && activeTimestamp" class="episode-content-stage">
            <h1 id="player-title" class="sr-only">{{ playerEpisode.title }}</h1>
            <div class="timestamp-rail" :style="{ '--timestamp-count': episodeOneTimestamps.length }" aria-label="Episode one timestamps">
              <button
                v-for="(timestamp, index) in episodeOneTimestamps"
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
                <p v-if="activeCaption">
                  <template v-for="(part, index) in activeCaption.parts" :key="index"><i v-if="part.italic">{{ part.text }}</i><template v-else>{{ part.text }}</template></template>
                </p>
              </div>
              <div class="episode-media">
                <Transition name="episode-media" mode="out-in">
                  <div v-if="activeMedia" :key="activeMedia.url" class="episode-media__item">
                    <video v-if="activeMedia.type === 'video'" :src="activeMedia.url" autoplay muted playsinline preload="metadata" aria-label="Episode one media" @ended="advanceTimestampMedia"></video>
                    <img v-else :src="activeMedia.url" alt="Episode one media" />
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
                <button class="player-control player-control--primary" :aria-label="isPlaybackActive ? 'Pause' : 'Play'" :title="isPlaybackActive ? 'Pause' : 'Play'" @click="isPlaybackActive = !isPlaybackActive">{{ isPlaybackActive ? '❚❚' : '▶' }}</button>
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
