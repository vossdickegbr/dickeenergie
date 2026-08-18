'use client'

import { useEffect, useRef, useState } from 'react'
import { Eraser, PenLine, RotateCcw, Save, Trash2 } from 'lucide-react'

interface HandwritingPadProps {
  initialDataUrl?: string
  onSave: (dataUrl: string) => Promise<void> | void
}

export function HandwritingPad({ initialDataUrl, onSave }: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen')
  const [history, setHistory] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function redraw(dataUrl?: string) {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (!dataUrl) return
    const image = new Image()
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.src = dataUrl
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const bounds = canvas.getBoundingClientRect()
      const current = canvas.width ? canvas.toDataURL('image/png') : initialDataUrl
      canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      canvas.height = Math.max(1, Math.round(bounds.height * ratio))
      const context = canvas.getContext('2d')
      if (context) context.scale(ratio, ratio)
      if (current) {
        const image = new Image()
        image.onload = () => context?.drawImage(image, 0, 0, bounds.width, bounds.height)
        image.src = current
      } else {
        context!.fillStyle = '#ffffff'
        context!.fillRect(0, 0, bounds.width, bounds.height)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [initialDataUrl])

  function pointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setHistory((items) => [...items.slice(-14), event.currentTarget.toDataURL('image/png')])
    drawingRef.current = true
    lastPoint.current = pointer(event)
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPoint.current) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const point = pointer(event)
    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = mode === 'eraser' ? 18 : Math.max(2, event.pressure ? event.pressure * 5 : 2.4)
    context.strokeStyle = mode === 'eraser' ? '#ffffff' : '#172216'
    context.beginPath()
    context.moveTo(lastPoint.current.x, lastPoint.current.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    context.restore()
    lastPoint.current = point
  }

  function stop() {
    drawingRef.current = false
    lastPoint.current = null
  }

  async function save() {
    const canvas = canvasRef.current
    if (!canvas || saving) return
    setSaving(true); setError('')
    try {
      await onSave(canvas.toDataURL('image/png'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notiz konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="handwriting-card">
      <div className="section-heading compact">
        <div><span className="eyebrow">Apple Pencil / Stift</span><h3>Handschriftliche Tagesnotizen</h3></div>
        <div className="drawing-tools">
          <button type="button" className={mode === 'pen' ? 'active' : ''} disabled={saving} onClick={() => setMode('pen')} title="Stift"><PenLine /></button>
          <button type="button" className={mode === 'eraser' ? 'active' : ''} disabled={saving} onClick={() => setMode('eraser')} title="Radierer"><Eraser /></button>
          <button type="button" disabled={saving || !history.length} onClick={() => {
            const previous = history.at(-1)
            if (!previous) return
            redraw(previous)
            setHistory((items) => items.slice(0, -1))
          }} title="Rückgängig"><RotateCcw /></button>
          <button type="button" disabled={saving} onClick={() => { setHistory((items) => [...items, canvasRef.current?.toDataURL('image/png') ?? '']); redraw() }} title="Leeren"><Trash2 /></button>
          <button type="button" className="save-drawing" onClick={() => void save()} disabled={saving}><Save /> {saving ? 'Speichert …' : 'Speichern'}</button>
        </div>
      </div>
      {error && <p className="form-error handwriting-error">{error}</p>}
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        aria-label="Zeichenfläche für handschriftliche Notizen"
      />
    </section>
  )
}
