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
    // @ts-ignore — ESM da CDN (mesmo pacote do desfoque), sem dep npm.
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

export function useFaceFraming(videoRef: React.RefObject<HTMLVideoElement>, active: boolean) {
  useEffect(() => {
    const el = videoRef.current
    if (!active) { if (el) el.style.objectPosition = '' ; return }

    let cancelled = false
    let raf = 0
    let lastDetect = 0
    let detector: any = null
    // Posição corrente e alvo (em %). Começa no centro-alto (rostos costumam
    // ficar no terço superior), então mesmo antes de detectar já é melhor.
    const target = { x: 50, y: 38 }
    const cur = { x: 50, y: 38 }

    ;(async () => {
      try { detector = await getDetector() } catch { return /* fail-safe: fica no padrão */ }
      if (cancelled) return

      const loop = (ts: number) => {
        if (cancelled) return
        const v = videoRef.current
        if (v && v.videoWidth > 0 && v.videoHeight > 0) {
          if (ts - lastDetect > 140) {
            lastDetect = ts
            try {
              const res = detector.detectForVideo(v, ts)
              const box = res?.detections?.[0]?.boundingBox
              if (box) {
                const cx = (box.originX + box.width / 2) / v.videoWidth
                const cy = (box.originY + box.height / 2) / v.videoHeight
                target.x = clamp(cx * 100)
                target.y = clamp(cy * 100)
              }
            } catch { /* frame ruim — ignora */ }
          }
          // Suaviza (lerp) pra não dar solavanco no recorte.
          cur.x += (target.x - cur.x) * 0.14
          cur.y += (target.y - cur.y) * 0.14
          v.style.objectPosition = `${cur.x.toFixed(1)}% ${cur.y.toFixed(1)}%`
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      const v = videoRef.current
      if (v) v.style.objectPosition = ''
    }
  }, [active, videoRef])
}
