import { useEffect, useState } from 'react'
import { generateToolQrPng } from '../lib/toolQr'

export default function ToolQrImage({ qrId, size = 220, className = '' }: { qrId: string; size?: number; className?: string }) {
  const [image, setImage] = useState<string>()
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setImage(undefined)
    setError(false)
    void generateToolQrPng(qrId, size).then(dataUrl => {
      if (active) setImage(dataUrl)
    }).catch(() => {
      if (active) setError(true)
    })
    return () => { active = false }
  }, [qrId, size])

  if (error) return <span className="qr-image-error" role="alert">QR код үүсгэж чадсангүй.</span>
  if (!image) return <span className="qr-image-loading" role="status">QR код үүсгэж байна...</span>
  return <img className={className} src={image} width={size} height={size} alt={`${qrId} QR код`} />
}
