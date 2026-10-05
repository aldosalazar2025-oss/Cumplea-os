(() => {
  const select = (selector) => document.querySelector(selector)
  const picker = select('#photoFiles')
  const choose = select('#choosePhotos')
  const form = select('#albumForm')
  const send = select('#sendPhotos')
  const status = select('#albumStatus')
  const progress = select('#albumProgress')
  const selection = select('#photoSelection')
  const gallery = select('#galleryGrid')
  const galleryStatus = select('#galleryStatus')
  const refresh = select('#refreshGallery')
  const more = select('#morePhotos')
  const viewer = select('#albumViewer')
  const maxBytes = 3 * 1024 * 1024
  let selected = []
  let sending = false
  let galleryPhotos = []
  let visiblePhotos = 0
  let galleryLoading = false

  const timedFetch = async (url, options = {}, timeout = 25000) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  const announce = (message, error = false) => {
    status.textContent = message
    status.dataset.tone = error ? 'error' : 'info'
  }

  const renderSelection = () => {
    selection.replaceChildren()
    selected.forEach((entry) => {
      const row = document.createElement('div')
      row.className = 'photo-selection__item'
      row.dataset.state = entry.state
      row.setAttribute('role', 'listitem')
      const name = document.createElement('span')
      name.className = 'photo-selection__name'
      name.textContent = entry.file.name
      const state = document.createElement('span')
      state.className = 'photo-selection__state'
      state.textContent = entry.message || 'Lista para compartir'
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.textContent = '×'
      remove.setAttribute('aria-label', `Quitar ${entry.file.name}`)
      remove.disabled = sending
      remove.addEventListener('click', () => {
        selected = selected.filter((photo) => photo !== entry)
        renderSelection()
      })
      row.append(name, state, remove)
      selection.append(row)
    })
    form.hidden = selected.length === 0
    send.disabled = sending || selected.every((entry) => entry.state === 'done')
    send.textContent = selected.some((entry) => entry.state === 'error') ? 'Reintentar fotos pendientes' : 'Enviar mis recuerdos'
  }

  choose.addEventListener('click', () => picker.click())
  picker.addEventListener('change', () => {
    if (sending || !picker.files.length) return
    if (picker.files.length + selected.length > 10) {
      announce('Elige hasta 10 fotos por envío. Puedes compartir más en otro envío.', true)
      picker.value = ''
      return
    }
    const files = [...picker.files]
    if (files.some((file) => file.size > 25 * 1024 * 1024 || file.size === 0)) {
      announce('Elige fotos de hasta 25 MB. Los archivos vacíos no se pueden enviar.', true)
      picker.value = ''
      return
    }
    if (selected.every((entry) => entry.state === 'done')) selected = []
    selected.push(...files.map((file) => ({ file, id: crypto.randomUUID(), state: 'ready', message: '' })))
    announce(`${selected.length} ${selected.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}. Confirma el permiso y toca «Enviar mis recuerdos».`)
    progress.hidden = true
    renderSelection()
    picker.value = ''
    form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' })
  })

  const preparePhoto = async (file) => {
    const objectUrl = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      const ratio = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .88))
      canvas.width = 1
      canvas.height = 1
      if (!blob || blob.size > maxBytes) throw new Error('Esta foto es demasiado grande. Elige una versión más pequeña.')
      return blob
    } catch (error) {
      const isHeic = /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]$/.test(file.type)
      if (isHeic && file.size <= maxBytes) return new Blob([file], { type: file.type || 'image/heic' })
      throw new Error(isHeic ? 'Esta foto HEIC supera 3 MB. Compártela como JPEG o elige una versión más pequeña.' : 'No pudimos preparar esta foto. Prueba con una imagen JPEG, PNG o WebP.')
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (sending || !selected.length || !form.reportValidity()) return
    sending = true
    choose.disabled = true
    select('#albumConsent').disabled = true
    progress.hidden = false
    progress.max = selected.length
    progress.value = selected.filter((entry) => entry.state === 'done').length
    form.setAttribute('aria-busy', 'true')
    try {
      for (const [index, entry] of selected.entries()) {
        if (entry.state === 'done') continue
        entry.state = 'sending'
        entry.message = 'Preparando y enviando…'
        renderSelection()
        announce(`Guardando recuerdo ${index + 1} de ${selected.length}… Mantén esta página abierta.`)
        try {
          const photo = await preparePhoto(entry.file)
          const response = await timedFetch('/api/album/upload', {
            method: 'POST',
            headers: { 'Content-Type': photo.type, 'X-Upload-Id': entry.id },
            body: photo,
          }, 55000)
          const data = await response.json().catch(() => ({}))
          if (!response.ok || !data.ok) throw new Error(data.message || (response.status === 429 ? 'Hay muchos envíos en este momento. Espera un minuto y vuelve a intentarlo.' : 'No pudimos confirmar la subida. Inténtalo otra vez.'))
          entry.state = 'done'
          entry.message = 'Guardada en el álbum 💙'
          progress.value += 1
        } catch (error) {
          entry.state = 'error'
          entry.message = error.name === 'TimeoutError' || error.name === 'AbortError'
            ? 'La conexión tardó demasiado. Reintenta esta foto.'
            : error instanceof TypeError ? 'No pudimos conectar. Revisa tu conexión a internet y reintenta esta foto.' : error.message
        }
        renderSelection()
      }
      const count = selected.filter((entry) => entry.state === 'done').length
      if (count === selected.length) {
        announce('¡Gracias por compartir este recuerdo! 💙 Tu foto ya forma parte de nuestro álbum.')
        selected = []
        form.reset()
        progress.hidden = true
      } else {
        announce(`${count ? `${count} ${count === 1 ? 'foto guardada' : 'fotos guardadas'}. ` : ''}Algunas fotos siguen pendientes. Reinténtalas sin volver a enviar las que ya se guardaron.`, true)
      }
    } finally {
      sending = false
      choose.disabled = false
      select('#albumConsent').disabled = false
      form.removeAttribute('aria-busy')
      renderSelection()
    }
  })

  const imageUrl = (id, width) => `/.netlify/images?url=${encodeURIComponent(`/api/album/photo/${id}`)}&w=${width}&fm=webp`

  const showMore = () => {
    const next = Math.min(visiblePhotos + 6, galleryPhotos.length)
    galleryPhotos.slice(visiblePhotos, next).forEach((photo, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'gallery-photo'
      button.setAttribute('aria-label', `Ampliar recuerdo ${visiblePhotos + index + 1}`)
      const image = document.createElement('img')
      image.src = imageUrl(photo.id, 500)
      image.alt = `Recuerdo ${visiblePhotos + index + 1} de los 15 años de Amy`
      image.loading = 'lazy'
      image.decoding = 'async'
      image.width = 400
      image.height = 500
      image.addEventListener('error', () => {
        button.hidden = true
        galleryStatus.textContent = 'Una foto ya no está disponible. Actualiza el álbum para ver los recuerdos actuales.'
      }, { once: true })
      const caption = document.createElement('span')
      caption.className = 'gallery-photo__label'
      caption.textContent = 'Nuestra noche mágica'
      button.append(image, caption)
      button.addEventListener('click', () => {
        select('#albumViewerPhoto').src = imageUrl(photo.id, 1600)
        viewer.showModal()
      })
      gallery.append(button)
    })
    visiblePhotos = next
    more.hidden = visiblePhotos >= galleryPhotos.length
  }

  const loadGallery = async () => {
    if (galleryLoading) return
    galleryLoading = true
    refresh.disabled = true
    galleryStatus.textContent = 'Abriendo las páginas de nuestro álbum…'
    select('#sharedGallery').setAttribute('aria-busy', 'true')
    try {
      const response = await timedFetch('/api/album', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error('No pudimos abrir el álbum. Puedes actualizarlo en unos momentos.')
      if (!data.configured) {
        announce('El álbum se está preparando. La subida estará disponible cuando se complete la conexión privada con Google Drive.')
        galleryStatus.textContent = ''
        return
      }
      galleryPhotos = data.photos.filter((photo) => /^[\w-]{10,100}$/.test(photo.id))
      visiblePhotos = 0
      gallery.replaceChildren()
      select('#galleryEmpty').hidden = galleryPhotos.length > 0
      showMore()
      galleryStatus.textContent = galleryPhotos.length ? 'Recuerdos elegidos con cariño por la familia.' : ''
      if (status.textContent.startsWith('El álbum se está preparando.')) announce('Ya puedes compartir tus fotografías 💙')
    } catch (error) {
      galleryStatus.textContent = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'El álbum tarda un poquito en abrirse. Intenta actualizarlo.' : 'No pudimos abrir el álbum. Puedes actualizarlo en unos momentos.'
    } finally {
      galleryLoading = false
      refresh.disabled = false
      select('#sharedGallery').removeAttribute('aria-busy')
    }
  }

  select('#closeAlbumViewer').addEventListener('click', () => viewer.close())
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close() })
  viewer.addEventListener('close', () => select('#albumViewerPhoto').removeAttribute('src'))
  refresh.addEventListener('click', loadGallery)
  more.addEventListener('click', showMore)
  const galleryObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && document.body.classList.contains('is-open')) {
      galleryObserver.disconnect()
      loadGallery()
    }
  }, { rootMargin: '150px' })
  galleryObserver.observe(select('#memories-title'))
})()
