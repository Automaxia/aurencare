'use client'

import { useEffect, useState } from 'react'

/**
 * Desfoque de fundo (estilo Meet/WhatsApp) via MediaPipe Selfie Segmentation.
 * Recebe o stream da câmera + `enabled`; devolve um MediaStream processado
 * (pessoa nítida, fundo desfocado).
 *
 * O modelo é carregado da CDN da MediaPipe via <script> (o import npm não
 * funciona bem com bundler). Fail-safe: qualquer falha → `error` + stream=null,
 * e o chamador mantém a câmera normal. Nunca quebra a chamada.
 */

// Versão FIXA (não o range flutuante @0.1): o pacote MediaPipe foi descontinuado;
// um patch ruim publicado no range derrubava o desfoque sem mudar nosso código.
const MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747'

function carregarSelfieSegmentation(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (w.SelfieSegmentation) return resolve(w.SelfieSegmentation)
    let s = document.querySelector<HTMLScriptElement>('script[data-mp-selfie]')
    if (!s) {
      s = document.createElement('script')
      s.src = `${MP_CDN}/selfie_segmentation.js`
      s.async = true
      s.crossOrigin = 'anonymous'
      s.setAttribute('data-mp-selfie', '1')
      document.head.appendChild(s)
    }
    s.addEventListener('load', () => (w.SelfieSegmentation ? resolve(w.SelfieSegmentation) : reject(new Error('no_global'))))
    s.addEventListener('error', () => reject(new Error('cdn')))
  })
}

export function useBackgroundBlur(source: MediaStream | null, enabled: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !source || source.getVideoTracks().length === 0) {
      setStream(null); setError(null)
      return
    }
    let cancelled = false
    let raf = 0
    let seg: any = null
    let video: HTMLVideoElement | null = null
    let out: MediaStream | null = null

    async function setup() {
      try {
        const SelfieSegmentation = await carregarSelfieSegmentation()
        if (cancelled) return

        const track = source!.getVideoTracks()[0]
        const st = track.getSettings()
        const w = st.width ?? 640
        const h = st.height ?? 360

        video = document.createElement('video')
        video.srcObject = new MediaStream([track])
        video.muted = true
        video.playsInline = true
        await video.play().catch(() => {})

        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas')

        seg = new SelfieSegmentation({ locateFile: (f: string) => `${MP_CDN}/${f}` })
        seg.setOptions({ modelSelection: 1, selfieMode: false })
        seg.onResults((results: any) => {
          if (cancelled) return
          ctx.save()
          ctx.clearRect(0, 0, w, h)
          ctx.drawImage(results.segmentationMask, 0, 0, w, h)
          ctx.globalCompositeOperation = 'source-in'
          ctx.drawImage(results.image, 0, 0, w, h)
          ctx.globalCompositeOperation = 'destination-over'
          ctx.filter = 'blur(12px)'
          ctx.drawImage(results.image, 0, 0, w, h)
          ctx.restore()
        })
        await seg.initialize?.()

        out = canvas.captureStream(24)
        source!.getAudioTracks().forEach(a => out!.addTrack(a))
        if (cancelled) { out.getVideoTracks().forEach(t => t.stop()); return }
        setStream(out); setError(null)

        const loop = async () => {
          if (cancelled || !video) return
          try { await seg.send({ image: video }) } catch { /* */ }
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch {
        if (!cancelled) { setError('Desfoque indisponível neste dispositivo.'); setStream(null) }
      }
    }
    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      try { seg?.close?.() } catch { /* */ }
      try { out?.getVideoTracks().forEach(t => t.stop()) } catch { /* */ }
      try { if (video) { video.pause(); video.srcObject = null } } catch { /* */ }
      setStream(null)
    }
  }, [source, enabled])

  return { stream, error }
}
