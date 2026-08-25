<script setup lang="ts">
const isLibraryOpen = ref(false)
const activeEpisode = ref(0)
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
let cursorStopTimer: ReturnType<typeof setTimeout> | undefined
let trailAnimationFrame: number | undefined
let hasPointerPosition = false

const episodes = [
  { number: '01', title: 'About Me', label: 'Who am I & hobbies', className: 'about' },
  { number: '02', title: 'Education', label: 'The learning arc', className: 'education' },
  { number: '03', title: 'Skills', label: 'Tech & soft skills', className: 'skills' },
  { number: '04', title: 'Work Experience', label: 'Career highlights', className: 'work' },
  { number: '05', title: 'Contact', label: 'Details & resume', className: 'contact' },
]

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

function selectEpisode(event: MouseEvent, index: number) {
  beginTransition(event, () => { activeEpisode.value = index })
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
})

onBeforeUnmount(() => {
  if (cursorStopTimer) clearTimeout(cursorStopTimer)
  if (trailAnimationFrame) window.cancelAnimationFrame(trailAnimationFrame)
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
      <div class="droplet-field" aria-hidden="true"><span v-for="n in 8" :key="n"></span></div>
    </section>

    <section v-if="isLibraryOpen" :class="['library', { 'library--leaving': transitionPhase === 'leaving', 'library--entering': transitionPhase === 'entering' }]" aria-labelledby="library-title">
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
          :aria-pressed="activeEpisode === index"
          @click="selectEpisode($event, index)"
        >
          <span class="episode-index">EP. {{ episode.number }}</span>
          <span class="episode-title">{{ episode.title }}</span>
          <span class="episode-subtitle">{{ episode.label }}</span>
          <span class="watch-icon">↗</span>
        </button>
      </div>

      <div class="episode-detail">
        <span class="detail-pulse"></span>
        <p>SELECTED EPISODE</p>
        <strong>EP. {{ episodes[activeEpisode].number }} — {{ episodes[activeEpisode].title }}</strong>
        <span>Content placeholder · Coming soon</span>
      </div>
    </section>
  </main>
</template>
