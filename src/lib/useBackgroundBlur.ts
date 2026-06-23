'use client'

import { useEffect, useState } from 'react'

/**
 * Desfoque de fundo (estilo Meet/WhatsApp) via MediaPipe Tasks Vision
 * (ImageSegmenter + selfie_segmenter). Recebe o stream da câmera + `enabled`;
 * devolve um MediaStream processado (pessoa nítida, fundo desfocado).
 *
 * Antes usávamos @mediapipe/selfie_segmentation (descontinuado) — quebrava no
 * init sem erro visível. Agora usamos o pacote MANTIDO @mediapipe/tasks-vision,
 * importado como ESM direto da CDN (sem dep npm / webpackIgnore). Fail-safe:
 * qualquer falha → `error` + stream=null, e o chamador mantém a câmera normal.
 * Nunca quebra a chamada.
 */

const VISION_VER = '0.10.18'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VER}/wasm`
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

// Singleton por página — carregar o WASM + modelo é caro; reusa entre toggles.
let segmenterPromise: Promise<any> | null = null

async function getSegmenter(): Promise<any> {
  if (segmenterPromise) return segmenterPromise
  segmenterPromise = (async () => {
    // @ts-ignore — ESM da CDN, sem dep/types no projeto (webpackIgnore externaliza).
    // Entry .mjs explícito pra garantir o módulo ESM (o specifier bare pode cair no CJS).
    const vision: any = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs')
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE)
    const opts = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO' as const,
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
    try {
      return await vision.ImageSegmenter.createFromOptions(fileset, opts('GPU'))
    } catch {
      // GPU indisponível (driver/WebGL) → CPU.
      return await vision.ImageSegmenter.createFromOptions(fileset, opts('CPU'))
    }
  })().catch(e => { segmenterPromise = null; throw e })
  return segmenterPromise
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
    let video: HTMLVideoElement | null = null
    let out: MediaStream | null = null

    async function setup() {
      try {
        const segmenter = await getSegmenter()
        if (cancelled) return

        const track = source!.getVideoTracks()[0]
        const st = track.getSettings()
        const w = Math.round(st.width ?? 640)
        const h = Math.round(st.height ?? 360)

        video = document.createElement('video')
        video.srcObject = new MediaStream([track])
        video.muted = true
        video.playsInline = true
        await video.play().catch(() => { /* */ })
        // Sem videoWidth, segmentForVideo falha. Espera os metadados.
        if (!video.videoWidth) {
          await new Promise<void>(res => {
            const t = setTimeout(res, 1800)
            video!.onloadeddata = () => { clearTimeout(t); res() }
          })
        }

        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        const person = document.createElement('canvas')
        const pctx = person.getContext('2d')!
        const tmp = document.createElement('canvas')
        const tctx = tmp.getContext('2d', { willReadFrequently: true })!

        out = canvas.captureStream(24)
        source!.getAudioTracks().forEach(a => out!.addTrack(a))
        if (cancelled) { out.getVideoTracks().forEach(t => t.stop()); return }

        let started = false

        const render = (mask: any) => {
          const mw: number = mask.width
          const mh: number = mask.height
          const data: Float32Array = mask.getAsFloat32Array()

          // Frame nítido na resolução da máscara → vira a "camada pessoa".
          if (tmp.width !== mw || tmp.height !== mh) { tmp.width = mw; tmp.height = mh; person.width = mw; person.height = mh }
          tctx.drawImage(video!, 0, 0, mw, mh)
          const img = tctx.getImageData(0, 0, mw, mh)
          const px = img.data

          // Robustez à inversão da máscara: o centro costuma ser pessoa, os
          // cantos fundo. Se o centro tiver confiança menor que os cantos, a
          // máscara está com o foreground invertido — então invertemos.
          const c = data[((mh >> 1) * mw) + (mw >> 1)]
          const cornerAvg = (data[0] + data[mw - 1] + data[(mh - 1) * mw] + data[mh * mw - 1]) / 4
          const fgHigh = c >= cornerAvg

          for (let i = 0; i < data.length; i++) {
            let v = data[i]
            if (!fgHigh) v = 1 - v
            // alpha = confiança de ser pessoa (com bordas suaves)
            px[(i << 2) + 3] = v > 0.62 ? 255 : v < 0.38 ? 0 : Math.round(v * 255)
          }
          pctx.putImageData(img, 0, 0)

          // Saída: fundo desfocado + pessoa nítida por cima.
          ctx.clearRect(0, 0, w, h)
          ctx.filter = 'blur(14px)'
          ctx.drawImage(video!, 0, 0, w, h)
          ctx.filter = 'none'
          ctx.drawImage(person, 0, 0, mw, mh, 0, 0, w, h)

          if (!started) { started = true; if (!cancelled) { setStream(out); setError(null) } }
        }

        const loop = () => {
          if (cancelled || !video) return
          try {
            segmenter.segmentForVideo(video, performance.now(), (result: any) => {
              if (cancelled) { try { result.close?.() } catch { /* */ } ; return }
              try {
                const mask = result.confidenceMasks?.[0]
                if (mask) render(mask)
              } finally {
                try { result.close?.() } catch { /* */ }
              }
            })
          } catch { /* frame ruim — tenta o próximo */ }
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch (e) {
        console.warn('[blur] desfoque indisponível:', e)
        if (!cancelled) { setError('Desfoque indisponível neste dispositivo.'); setStream(null) }
      }
    }
    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      // NÃO fecha o segmenter (singleton reusado entre toggles).
      try { out?.getVideoTracks().forEach(t => t.stop()) } catch { /* */ }
      try { if (video) { video.pause(); video.srcObject = null } } catch { /* */ }
      setStream(null)
    }
  }, [source, enabled])

  return { stream, error }
}
