import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Camera, CameraOff, LoaderCircle, QrCode, X } from 'lucide-react'
import type { Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode'

type CameraScannerProps = {
  title: string
  instruction: string
  onDetected: (value: string) => void
  onClose: () => void
}

function getCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : String(error)
  if (/NotAllowed|PermissionDenied|SecurityError/i.test(name)) return 'Камер ашиглах зөвшөөрөл олгогдсонгүй. Хөтчийн тохиргооноос зөвшөөрөөд дахин оролдоно уу.'
  if (/NotFound|DevicesNotFound/i.test(name)) return 'Төхөөрөмжийн камер олдсонгүй. Гарын код оруулах аргыг ашиглана уу.'
  if (/NotReadable|TrackStart|AbortError/i.test(name)) return 'Камерыг нээж чадсангүй. Өөр апп ашиглаж байгаа эсэхийг шалгаад дахин оролдоно уу.'
  return 'Камер нээхэд алдаа гарлаа. Гарын код оруулах аргыг ашиглана уу.'
}

export default function CameraScanner({ title, instruction, onDetected, onClose }: CameraScannerProps) {
  const elementId = `camera-scan-${useId().replaceAll(':', '')}`
  const scannerRef = useRef<Html5QrcodeInstance | null>(null)
  const onCloseRef = useRef(onClose)
  const runRef = useRef(0)
  const decodedRef = useRef(false)
  const [state, setState] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  onCloseRef.current = onClose

  const stopCurrentScanner = async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch {
      try { scanner.clear() } catch { /* The element may already be unmounted. */ }
    }
  }

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      runRef.current += 1
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner?.isScanning) {
        void scanner.stop().then(() => scanner.clear()).catch(() => undefined)
      } else {
        try { scanner?.clear() } catch { /* The scanner may still be initializing. */ }
      }
    }
  }, [])

  const startCamera = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Камер уншуулагч ашиглахын тулд HTTPS эсвэл localhost хаягаар нээнэ үү. Гарын код оруулж болно.')
      setState('error')
      return
    }
    if (scannerRef.current) return

    const currentRun = ++runRef.current
    decodedRef.current = false
    setErrorMessage('')
    setState('starting')

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: Format } = await import('html5-qrcode')
      if (currentRun !== runRef.current) return
      const scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [
          Format.QR_CODE,
          Format.CODE_128,
          Format.CODE_39,
          Format.CODE_93,
          Format.CODABAR,
          Format.EAN_13,
          Format.EAN_8,
          Format.UPC_A,
          Format.UPC_E,
          Format.ITF,
          Format.DATA_MATRIX,
          Format.AZTEC,
          Format.PDF_417,
        ],
        verbose: false,
      })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 180 }, aspectRatio: 4 / 3, disableFlip: false },
        value => {
          if (decodedRef.current || currentRun !== runRef.current) return
          decodedRef.current = true
          onDetected(value.trim())
        },
        () => undefined,
      )
      if (currentRun !== runRef.current) {
        if (scanner.isScanning) await scanner.stop()
        scanner.clear()
        return
      }
      setState('scanning')
    } catch (error) {
      if (currentRun !== runRef.current) return
      const scanner = scannerRef.current
      scannerRef.current = null
      try { scanner?.clear() } catch { /* The camera may never have started. */ }
      setErrorMessage(getCameraError(error))
      setState('error')
    }
  }

  const close = () => {
    runRef.current += 1
    void stopCurrentScanner()
    onClose()
  }

  return (
    <div className="scanner-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
      <section className="scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        <div className="scanner-heading">
          <div className="scanner-heading-icon"><QrCode size={20} /></div>
          <div><h2 id="scanner-title">{title}</h2><p>{instruction}</p></div>
          <button className="icon-button scanner-close" type="button" aria-label="Уншуулагч хаах" onClick={close}><X size={20} /></button>
        </div>
        <div className={`scanner-view ${state === 'idle' ? 'scanner-idle' : ''}`}>
          <div id={elementId} className="scanner-video" />
          {state === 'idle' && <div className="scanner-placeholder"><Camera size={30} /><span>Камер асаахад зөвшөөрөл хүснэ</span></div>}
          {state === 'starting' && <div className="scanner-overlay"><LoaderCircle size={24} className="spinner" /><span>Камер холбож байна...</span></div>}
          {state === 'error' && <div className="scanner-overlay scanner-error"><AlertTriangle size={24} /><span>{errorMessage}</span></div>}
          {state === 'scanning' && <div className="scan-frame" aria-hidden="true"><i /><i /><i /><i /></div>}
        </div>
        <div className="scanner-footer">
          <p><CameraOff size={15} /> Камер зөвхөн энэ цонх нээлттэй үед ажиллана.</p>
          {state === 'scanning' ? <button className="button secondary scanner-action" type="button" onClick={() => { runRef.current += 1; void stopCurrentScanner(); setState('idle') }}>Камер зогсоох</button> : <button className="button primary scanner-action" type="button" onClick={startCamera} disabled={state === 'starting'}><Camera size={17} />{state === 'starting' ? 'Холбож байна' : 'Камер асаах'}</button>}
        </div>
      </section>
    </div>
  )
}