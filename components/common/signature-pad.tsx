'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Signature } from 'lucide-react'

export function SignaturePad({ value, onChange, disabled }: {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const inkRef = useRef(Boolean(value))
  const [hasInk, setHasInk] = useState(Boolean(value))

  function paintBackground() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const rect = canvas.getBoundingClientRect()
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, rect.width, rect.height)
  }

  useEffect(() => {
    inkRef.current = Boolean(value)
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      canvas.height = Math.max(1, Math.round(bounds.height * ratio))
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, bounds.width, bounds.height)
      if (value) {
        const image = new Image()
        image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height)
        image.src = value
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [value])

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    lastPoint.current = point(event)
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPoint.current || disabled) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const next = point(event)
    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = Math.max(2.1, event.pressure ? event.pressure * 4.5 : 2.4)
    context.strokeStyle = '#102018'
    context.beginPath()
    context.moveTo(lastPoint.current.x, lastPoint.current.y)
    context.lineTo(next.x, next.y)
    context.stroke()
    context.restore()
    lastPoint.current = next
    inkRef.current = true
    setHasInk(true)
  }

  function stop() {
    if (!drawing.current) return
    drawing.current = false
    lastPoint.current = null
    const canvas = canvasRef.current
    if (canvas && inkRef.current) onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    paintBackground()
    inkRef.current = false
    setHasInk(false)
    onChange('')
  }

  return (
    <div className="signature-field">
      <div className="signature-heading">
        <span><Signature /> Freiwillige Unterschrift des Kunden (optional)</span>
        <button type="button" onClick={clear} disabled={disabled || !hasInk}><RotateCcw /> Leeren</button>
      </div>
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        aria-label="Unterschriftsfeld"
      />
      <small>Nur verwenden, wenn der Kunde zusätzlich unterschreiben möchte. Die Kundenaufnahme funktioniert auch ohne Unterschrift.</small>
    </div>
  )
}
