'use client'

import { useEffect } from 'react'

/**
 * Enquadramento facial para vídeo com object-fit: cover. Quando o container
 * tem aspecto diferente da câmera (ex.: tela cheia widescreen + webcam 4:3), o
 * `cover` recorta centralizado e corta o rosto. Este hook rastreia o rosto no
 * <video> (MediaPipe FaceDetector / blaze_face) e ajusta `object-position` pra
 * o recorte ficar em volta do rosto.
 *
 * Imperativo (mexe direto no style do elemento) pra não causar re-render a cada
 * frame. Fail-safe: sem rosto / erro / modelo indisponível → centro padrão.
 */

const VER = '0.10.18'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite'

let detectorPromise: Promise<any> | null = null

async function getDetector(): Promise<any> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    // @ts-ignore — ESM da CDN (MediaPipe Tasks Vision), sem dep npm.
    const vision: any = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs')
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE)
    const mk = (delegate: 'GPU' | 'CPU') => vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO' as const,
    })
    try { return await mk('GPU') } catch { return await mk('CPU') }
  })().catch(e => { detectorPromise = null; throw e })
  return detectorPromise
}

const clamp = (v: number) => Math.max(0, Math.min(100, v))

// Uma detecção por segundo basta: o rosto mexe pouco numa sessão e a transição
// CSS suaviza o recorte. Antes eram ~7 detecções/s + um rAF a 60 Hz reescrevendo
// o style — no celular do paciente, isso por 50 min esquentava o aparelho.
const INTERVALO_MS = 1000

export function useFaceFraming(videoRef: React.RefObject<HTMLVideoElement>, active: boolean) {
  useEffect(() => {
    const el = videoRef.current
    if (!active) { if (el) { el.style.objectPosition = ''; el.style.transition = '' } ; return }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let detector: any = null
    let ultimo = { x: 50, y: 38 }
    // Começa no centro-alto (rostos costumam ficar no terço superior), então mesmo
    // antes de detectar já é melhor que o centro.
    if (el) {
      el.style.transition = 'object-position .9s ease-out'
      el.style.objectPosition = `${ultimo.x}% ${ultimo.y}%`
    }

    const tick = () => {
      if (cancelled) return
      const v = videoRef.current
      // Aba em segundo plano / tela apagada: não detecta nada.
      if (v && !document.hidden && v.videoWidth > 0 && v.videoHeight > 0) {
        try {
          const res = detector.detectForVideo(v, performance.now())
          const box = res?.detections?.[0]?.boundingBox
          if (box) {
            const x = clamp(((box.originX + box.width / 2) / v.videoWidth) * 100)
            const y = clamp(((box.originY + box.height / 2) / v.videoHeight) * 100)
            // Só mexe no style se o rosto andou de verdade (evita recomposição à toa).
            if (Math.abs(x - ultimo.x) > 1.5 || Math.abs(y - ultimo.y) > 1.5) {
              ultimo = { x, y }
              v.style.objectPosition = `${x.toFixed(1)}% ${y.toFixed(1)}%`
            }
          }
        } catch { /* frame ruim — ignora */ }
      }
      timer = setTimeout(tick, INTERVALO_MS)
    }

    ;(async () => {
      try { detector = await getDetector() } catch { return /* fail-safe: fica no padrão */ }
      if (!cancelled) tick()
    })()

    return () => {
      cancelled = true
      clearTimeout(timer)
      const v = videoRef.current
      if (v) { v.style.objectPosition = ''; v.style.transition = '' }
    }
  }, [active, videoRef])
}
