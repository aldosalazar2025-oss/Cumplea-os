/* Mis 15 años · Amy — interacciones */
(() => {
  const $ = (s, el = document) => el.querySelector(s)
  const body = document.body
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  const WHATSAPP = '51918229197'
  // Hora de Perú (UTC-5)
  const EVENT_DATE = new Date('2026-10-24T20:00:00-05:00')
  // Punto de partida del carruaje en la línea de tiempo
  const JOURNEY_START = new Date('2026-09-01T00:00:00-05:00')

  /* ---------- Destellos plateados ---------- */
  const canvas = $('#sparkles')
  const ctx = canvas.getContext('2d')
  let w, h, dpr, stars = []
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2)
    w = canvas.width = innerWidth * dpr
    h = canvas.height = innerHeight * dpr
    const count = Math.round(Math.min(70, (innerWidth * innerHeight) / 12000))
    stars = Array.from({ length: count }, () => newStar(true))
  }
  const newStar = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    r: (Math.random() * 1.6 + 0.5) * dpr,
    vy: -(Math.random() * 0.25 + 0.06) * dpr,
    vx: (Math.random() - 0.5) * 0.12 * dpr,
    t: Math.random() * Math.PI * 2,
    gold: Math.random() < 0.28,
  })
  const drawStar = (s) => {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(s.t))
    ctx.globalAlpha = a
    ctx.fillStyle = s.gold ? '#f3dc9c' : '#e8f3fd'
    ctx.shadowColor = s.gold ? 'rgba(243,220,156,.9)' : 'rgba(169,212,245,.9)'
    ctx.shadowBlur = 8 * dpr
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
    if (s.r > 1.6 * dpr && a > 0.8) {
      // pequeño destello en cruz
      ctx.globalAlpha = a * 0.6
      ctx.fillRect(s.x - s.r * 3, s.y - 0.4 * dpr, s.r * 6, 0.8 * dpr)
      ctx.fillRect(s.x - 0.4 * dpr, s.y - s.r * 3, 0.8 * dpr, s.r * 6)
    }
  }
  const tick = () => {
    ctx.clearRect(0, 0, w, h)
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]
      s.x += s.vx
      s.y += s.vy
      s.t += 0.02
      if (s.y < -10) stars[i] = newStar(false)
      drawStar(s)
    }
    requestAnimationFrame(tick)
  }
  resize()
  addEventListener('resize', resize)
  if (!reduceMotion) requestAnimationFrame(tick)

  /* ---------- Música ---------- */
  const music = $('#music')
  const musicBtn = $('#musicBtn')
  music.volume = 0.55
  const setPlaying = (on) => {
    musicBtn.classList.toggle('is-playing', on)
    musicBtn.setAttribute('aria-pressed', String(on))
    musicBtn.setAttribute('aria-label', on ? 'Pausar música' : 'Activar música')
  }
  const playMusic = () => music.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  musicBtn.addEventListener('click', () => {
    if (music.paused) playMusic()
    else { music.pause(); setPlaying(false) }
  })
  music.addEventListener('pause', () => setPlaying(false))
  music.addEventListener('play', () => setPlaying(true))

  /* ---------- Apertura del sobre ---------- */
  const cover = $('#cover')
  const invite = $('#invite')
  const openBtn = $('#openBtn')
  const timers = []
  const later = (fn, ms) => timers.push(setTimeout(fn, reduceMotion ? 0 : ms))

  openBtn.addEventListener('click', () => {
    playMusic()
    openBtn.disabled = true
    scrollTo(0, 0)
    cover.classList.add('is-opening')
    later(() => cover.classList.add('is-letter'), 900)
    later(() => cover.classList.add('is-fly', 'is-drive'), 2300)
    later(() => {
      body.classList.remove('is-locked')
      body.classList.add('is-open')
      invite.setAttribute('aria-hidden', 'false')
      cover.classList.add('is-gone')
    }, 4200)
  })

  const resetInvitation = () => {
    timers.splice(0).forEach(clearTimeout)
    $('#thanks').hidden = true
    closeModal()
    body.classList.remove('is-open')
    body.classList.add('is-locked')
    invite.setAttribute('aria-hidden', 'true')
    document.querySelectorAll('.reveal.is-visible').forEach((el) => {
      el.classList.remove('is-visible')
      observer.observe(el)
    })
    cover.className = 'cover'
    // reinicia las animaciones CSS de la portada
    void cover.offsetWidth
    openBtn.disabled = false
    scrollTo({ top: 0, behavior: 'instant' })
  }

  /* ---------- Animaciones al hacer scroll ---------- */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('is-visible')
        observer.unobserve(e.target)
      })
    },
    { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
  )
  document.querySelectorAll('.reveal').forEach((el) => {
    // ligero escalonado entre elementos hermanos
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'))
    el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 0.09}s`
    observer.observe(el)
  })

  /* ---------- Cuenta regresiva + carruaje ---------- */
  const pad = (n) => String(n).padStart(2, '0')
  const cd = { d: $('#cdDays'), h: $('#cdHours'), m: $('#cdMins'), s: $('#cdSecs') }
  const journey = $('.journey')
  const carriage = $('#journeyCarriage')
  const trail = $('#journeyTrail')
  const pctEl = $('#journeyPct')
  let lastMinute = -1

  const updateCountdown = () => {
    const now = Date.now()
    const diff = Math.max(0, EVENT_DATE - now)
    const s = Math.floor(diff / 1000)
    cd.d.textContent = pad(Math.floor(s / 86400))
    cd.h.textContent = pad(Math.floor((s % 86400) / 3600))
    cd.m.textContent = pad(Math.floor((s % 3600) / 60))
    cd.s.textContent = pad(s % 60)

    // el carruaje avanza cada minuto
    const minute = Math.floor(now / 60000)
    if (minute === lastMinute) return
    lastMinute = minute
    const total = EVENT_DATE - JOURNEY_START
    const p = Math.min(1, Math.max(0, (now - JOURNEY_START) / total))
    carriage.style.left = `calc(${p} * (100% - 150px))`
    trail.style.width = `calc(${p} * (100% - 94px) + 40px)`
    pctEl.textContent = p >= 1 ? '100' : (p * 100).toFixed(1).replace('.', ',')
    if (p >= 1) {
      journey.classList.add('is-arrived')
      $('.journey__label').textContent = '¡El carruaje llegó al castillo! ✨'
    }
  }
  updateCountdown()
  setInterval(updateCountdown, 1000)

  /* ---------- Copiar número Yape / Plin ---------- */
  $('#copyPay').addEventListener('click', async (e) => {
    const btn = e.currentTarget
    const num = $('#payNumber').textContent.replace(/\s/g, '')
    try {
      await navigator.clipboard.writeText(num)
      btn.textContent = '¡Copiado! ✓'
    } catch {
      btn.textContent = num
    }
    setTimeout(() => (btn.textContent = 'Copiar número'), 2200)
  })

  /* ---------- Confirmación ---------- */
  const modal = $('#rsvpModal')
  const form = $('#rsvpForm')
  const guestsField = $('#guestsField')
  const openModal = () => {
    modal.hidden = false
    setTimeout(() => form.querySelector('input[name="nombre"]').focus({ preventScroll: true }), 400)
  }
  function closeModal() { modal.hidden = true }
  $('#rsvpBtn').addEventListener('click', openModal)
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal))
  addEventListener('keydown', (e) => e.key === 'Escape' && closeModal())

  form.addEventListener('change', () => {
    const going = form.asistencia.value !== 'No podré asistir'
    guestsField.classList.toggle('is-disabled', !going)
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!form.reportValidity()) return
    const data = new FormData(form)
    const name = data.get('nombre').trim()
    const going = data.get('asistencia') !== 'No podré asistir'
    if (!going) data.set('asistentes', '0')

    // guarda la confirmación en Netlify Forms
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString(),
      keepalive: true,
    }).catch(() => {})

    const note = (data.get('mensaje') || '').trim()
    const text = going
      ? `✨ ¡Hola! Soy ${name} y confirmo mi asistencia a los 15 años de Amy.\n👑 Asistentes: ${data.get('asistentes')}\n📅 Sábado 24 de octubre · 8:00 PM${note ? `\n💌 ${note}` : ''}`
      : `Hola, soy ${name}. Lamentablemente no podré asistir a los 15 años de Amy, pero le deseo una noche mágica. 💙${note ? `\n💌 ${note}` : ''}`
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')

    closeModal()
    showThanks(name, going)
    form.reset()
    guestsField.classList.remove('is-disabled')
  })

  const showThanks = (name, going) => {
    const first = name.split(' ')[0]
    $('#thanksTitle').textContent = going
      ? `¡Gracias, ${first}! Tu lugar en el baile está reservado`
      : `Gracias, ${first}, te extrañaremos en el baile`
    $('#thanksText').textContent = going
      ? 'El hada madrina ya preparó el carruaje y el castillo te espera. Te esperamos el sábado 24 de octubre a las 8:00 PM… y prometemos que la magia no terminará a la medianoche.'
      : 'Aunque no puedas llegar al castillo esa noche, guardaremos un pedacito de la magia para ti. ¡Gracias por tus buenos deseos!'
    $('#thanks').hidden = false
  }

  $('#restartBtn').addEventListener('click', resetInvitation)
})()
