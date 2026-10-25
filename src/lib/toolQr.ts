import QRCode from 'qrcode'

const qrIdPattern = /^TOOL-(\d+)$/

export function nextToolQrId(tools: readonly { qrId: string }[]): string {
  const usedIds = new Set(tools.map(tool => tool.qrId.toUpperCase()))
  let nextNumber = tools.reduce((highest, tool) => {
    const match = qrIdPattern.exec(tool.qrId.toUpperCase())
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0) + 1

  let candidate = `TOOL-${String(nextNumber).padStart(4, '0')}`
  while (usedIds.has(candidate)) {
    nextNumber += 1
    candidate = `TOOL-${String(nextNumber).padStart(4, '0')}`
  }
  return candidate
}

export function addMissingToolQrIds<T extends { qrId?: string }>(tools: readonly T[]): (T & { qrId: string })[] {
  const preservedIds = new Set<string>()
  const duplicateIndexes = new Set<number>()
  tools.forEach((tool, index) => {
    const qrId = tool.qrId?.trim().toUpperCase()
    if (!qrId) return
    if (preservedIds.has(qrId)) duplicateIndexes.add(index)
    else preservedIds.add(qrId)
  })
  const usedIds = new Set(preservedIds)
  let nextNumber = 1

  return tools.map((tool, index) => {
    let qrId = tool.qrId?.trim().toUpperCase()
    if (!qrId || duplicateIndexes.has(index)) {
      do {
        qrId = `TOOL-${String(nextNumber).padStart(4, '0')}`
        nextNumber += 1
      } while (usedIds.has(qrId))
    }
    usedIds.add(qrId)
    return { ...tool, qrId }
  })
}

export function generateToolQrPng(qrId: string, width = 512): Promise<string> {
  return QRCode.toDataURL(qrId, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width,
    color: { dark: '#000000', light: '#ffffff' },
  })
}
