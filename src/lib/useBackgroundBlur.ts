'use client'

import { useEffect, useState } from 'react'

/**
 * Desfoque de fundo (estilo Meet/WhatsApp) via MediaPipe Selfie Segmentation.
 * Recebe o stream da câmera + `enabled`; devolve um MediaStream processado
 * (pessoa nítida, fundo desfocado) pronto pra enviar e exibir.
 *
 * Fail-safe: qualquer falha (modelo não carrega, navegador fraco) devolve
 * `error` e `stream=null` — o chamador mantém a câmera normal. Nunca quebra a
 * chamada. O modelo é carregado da CDN da MediaPipe sob demanda.
 */
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
        const mod: any = await import('@mediapipe/selfie_segmentation')
        const SelfieSegmentation = mod.SelfieSegmentation ?? mod.default?.SelfieSegmentation
        if (cancelled || !SelfieSegmentation) throw new Error('seg_indisponivel')

        const track = source!.getVideoTracks()[0]
        const s = track.getSettings()
        const w = s.width ?? 640
        const h = s.height ?? 360

        video = document.createElement('video')
        video.srcObject = new MediaStream([track])
        video.muted = true
        video.playsInline = true
        await video.play().catch(() => {})

        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas_indisponivel')

        seg = new SelfieSegmentation({
          locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}`,
        })
        seg.setOptions({ modelSelection: 1 })
        seg.onResults((results: any) => {
          if (cancelled) return
          ctx.save()
          ctx.clearRect(0, 0, w, h)
          // pessoa recortada pela máscara
          ctx.drawImage(results.segmentationMask, 0, 0, w, h)
          ctx.globalCompositeOperation = 'source-in'
          ctx.drawImage(results.image, 0, 0, w, h)
          // fundo desfocado atrás
          ctx.globalCompositeOperation = 'destination-over'
          ctx.filter = 'blur(12px)'
          ctx.drawImage(results.image, 0, 0, w, h)
          ctx.restore()
        })

        out = canvas.captureStream(24)
        // preserva o áudio original junto (se houver)
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
