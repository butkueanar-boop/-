import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowLeftRight, BarChart3,
  Bell, Boxes, BriefcaseBusiness, Check, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Clock3, Cloud,
  Camera, Download, HardHat, Home, Image as ImageIcon, Languages, Menu, Package, PackageCheck,
  Pencil, Plus, QrCode, Radio, Search, Settings, ShieldCheck, Signal,
  RotateCcw, SignalZero, SlidersHorizontal, Trash2, UserRound, Users, Wrench as ToolCase,
  X, XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CameraScanner from './components/CameraScanner'
import ToolQrImage from './components/ToolQrImage'
import { deleteToolPhoto, getToolPhoto, saveToolPhoto } from './lib/toolPhotos'
import { addMissingToolQrIds, generateToolQrPng, nextToolQrId } from './lib/toolQr'

type Page = 'dashboard' | 'issue' | 'return' | 'inventory' | 'labels' | 'employees' | 'history' | 'sync' | 'settings'
type ToolStatus = 'available' | 'issued' | 'overdue' | 'damaged' | 'lost' | 'maintenance' | 'retired'
type Condition = 'good' | 'damaged' | 'maintenance'
type Employee = { id: string; name: string; department: string; position: string; barcode: string; active: boolean }
type ToolItem = { id: string; qrId: string; code: string; name: string; category: string; status: ToolStatus; holderId?: string; photoKey?: string }
type PrintableTool = Pick<ToolItem, 'qrId' | 'code' | 'name'> & { qrImage: string }
type EventRecord = { id: number; type: 'Олголт' | 'Буцаалт'; date: string; employeeId: string; toolIds: string[]; condition?: string }
type DemoData = { version: 1; tools: ToolItem[]; employees: Employee[]; events: EventRecord[]; pendingCount: number; lastSync: string }
type ScanTarget = 'employee' | 'issue-tool' | 'return-tool'
type ToolPhotoChange = { file?: File; remove: boolean }

const maxToolPhotoBytes = 5 * 1024 * 1024

const initialEmployees: Employee[] = [
  { id: 'EMP-1042', name: 'Бат-Эрдэнэ Даваа', department: 'Уулын ашиглалт', position: 'Экскаваторын оператор', barcode: '88001042', active: true },
  { id: 'EMP-1078', name: 'Номин-Эрдэнэ Ганболд', department: 'Засвар үйлчилгээ', position: 'Механик инженер', barcode: '88001078', active: true },
  { id: 'EMP-1091', name: 'Тэмүүлэн Энхтөр', department: 'Өрөмдлөг', position: 'Өрмийн оператор', barcode: '88001091', active: true },
  { id: 'EMP-1120', name: 'Саруул Мөнхбат', department: 'Агуулах', position: 'Агуулахын ажилтан', barcode: '88001120', active: true },
  { id: 'EMP-1146', name: 'Эрдэнэбаяр Цогт', department: 'Уулын ашиглалт', position: 'Маркшейдер', barcode: '88001146', active: false },
  { id: 'EMP-1183', name: 'Хулан Амарсанаа', department: 'Цахилгаан', position: 'Цахилгаанчин', barcode: '88001183', active: true },
]

const initialTools: ToolItem[] = [
  { id: 't1', qrId: 'TOOL-0001', code: 'DRL-0241', name: 'Цохилтот дрилл', category: 'Өрөмдлөг', status: 'available' },
  { id: 't2', qrId: 'TOOL-0002', code: 'GRD-0108', name: 'Өнцөг зүлгүүр 125мм', category: 'Цахилгаан багаж', status: 'issued', holderId: 'EMP-1078' },
  { id: 't3', qrId: 'TOOL-0003', code: 'WLD-0034', name: 'Гагнуурын аппарат', category: 'Гагнуур', status: 'available' },
  { id: 't4', qrId: 'TOOL-0004', code: 'MTR-0162', name: 'Мультиметр', category: 'Хэмжих хэрэгсэл', status: 'issued', holderId: 'EMP-1183' },
  { id: 't5', qrId: 'TOOL-0005', code: 'WRN-0320', name: 'Торцовны ком', category: 'Гар багаж', status: 'available' },
  { id: 't6', qrId: 'TOOL-0006', code: 'SAW-0017', name: 'Дугуй хөрөө', category: 'Цахилгаан багаж', status: 'overdue', holderId: 'EMP-1042' },
  { id: 't7', qrId: 'TOOL-0007', code: 'HAM-0275', name: 'Лантуу 5кг', category: 'Гар багаж', status: 'available' },
  { id: 't8', qrId: 'TOOL-0008', code: 'LEV-0043', name: 'Лазер тэгш ус', category: 'Хэмжих хэрэгсэл', status: 'maintenance' },
  { id: 't9', qrId: 'TOOL-0009', code: 'GRD-0112', name: 'Өнцөг зүлгүүр 230мм', category: 'Цахилгаан багаж', status: 'damaged' },
  { id: 't10', qrId: 'TOOL-0010', code: 'PMP-0008', name: 'Усны насос', category: 'Насос', status: 'lost' },
  { id: 't11', qrId: 'TOOL-0011', code: 'DRL-0250', name: 'Аккумулятор дрилл', category: 'Өрөмдлөг', status: 'available' },
  { id: 't12', qrId: 'TOOL-0012', code: 'WLD-0041', name: 'Электрод баригч', category: 'Гагнуур', status: 'available' },
]

const initialEvents: EventRecord[] = [
  { id: 1, type: 'Олголт', date: '2026-10-13T08:42:00', employeeId: 'EMP-1078', toolIds: ['t2'] },
  { id: 2, type: 'Буцаалт', date: '2026-10-13T08:16:00', employeeId: 'EMP-1091', toolIds: ['t3'], condition: 'Хэвийн' },
  { id: 3, type: 'Олголт', date: '2026-10-13T07:55:00', employeeId: 'EMP-1042', toolIds: ['t6'] },
  { id: 4, type: 'Буцаалт', date: '2026-10-12T17:30:00', employeeId: 'EMP-1183', toolIds: ['t4'], condition: 'Хэвийн' },
  { id: 5, type: 'Олголт', date: '2026-10-12T16:10:00', employeeId: 'EMP-1091', toolIds: ['t5'] },
]

const demoStorageKey = 'minetool-manager.demo.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEmployee(value: unknown): value is Employee {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.department === 'string'
    && typeof value.position === 'string'
    && typeof value.barcode === 'string'
    && typeof value.active === 'boolean'
}

function isTool(value: unknown): value is ToolItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.code === 'string'
    && typeof value.name === 'string'
    && typeof value.category === 'string'
    && (value.qrId === undefined || typeof value.qrId === 'string')
    && ['available', 'issued', 'overdue', 'damaged', 'lost', 'maintenance', 'retired'].includes(String(value.status))
    && (value.holderId === undefined || typeof value.holderId === 'string')
    && (value.photoKey === undefined || typeof value.photoKey === 'string')
}

function isEvent(value: unknown): value is EventRecord {
  return isRecord(value)
    && typeof value.id === 'number'
    && (value.type === 'Олголт' || value.type === 'Буцаалт')
    && typeof value.date === 'string'
    && !Number.isNaN(Date.parse(value.date))
    && typeof value.employeeId === 'string'
    && Array.isArray(value.toolIds)
    && value.toolIds.every(toolId => typeof toolId === 'string')
    && (value.condition === undefined || typeof value.condition === 'string')
}

function freshDemoData(): DemoData {
  return {
    version: 1,
    tools: addMissingToolQrIds(initialTools.map(tool => ({ ...tool }))),
    employees: initialEmployees.map(employee => ({ ...employee })),
    events: initialEvents.map(event => ({ ...event, toolIds: [...event.toolIds] })),
    pendingCount: 3,
    lastSync: '2026-10-13 08:42',
  }
}

function readDemoData(): DemoData {
  try {
    const saved = window.localStorage.getItem(demoStorageKey)
    if (!saved) return freshDemoData()
    const parsed: unknown = JSON.parse(saved)
    if (!isRecord(parsed)
      || parsed.version !== 1
      || !Array.isArray(parsed.tools) || !parsed.tools.every(isTool)
      || !Array.isArray(parsed.employees) || !parsed.employees.every(isEmployee)
      || !Array.isArray(parsed.events) || !parsed.events.every(isEvent)
      || typeof parsed.pendingCount !== 'number' || !Number.isInteger(parsed.pendingCount) || parsed.pendingCount < 0
      || typeof parsed.lastSync !== 'string') return freshDemoData()
    const data = parsed as DemoData
    return { ...data, tools: addMissingToolQrIds(data.tools) }
  } catch {
    return freshDemoData()
  }
}

const pages: { id: Page; label: string; icon: LucideIcon; group: string }[] = [
  { id: 'dashboard', label: 'Хянах самбар', icon: Home, group: 'ҮНДСЭН' },
  { id: 'issue', label: 'Багаж олгох', icon: ArrowDownToLine, group: 'ҮЙЛ АЖИЛЛАГАА' },
  { id: 'return', label: 'Багаж буцаах', icon: ArrowLeftRight, group: 'ҮЙЛ АЖИЛЛАГАА' },
  { id: 'inventory', label: 'Багажны бүртгэл', icon: Boxes, group: 'БҮРТГЭЛ' },
  { id: 'labels', label: 'Шошго хэвлэх', icon: QrCode, group: 'БҮРТГЭЛ' },
  { id: 'employees', label: 'Ажилтнууд', icon: Users, group: 'БҮРТГЭЛ' },
  { id: 'history', label: 'Түүх ба тайлан', icon: BarChart3, group: 'ТАЙЛАН' },
  { id: 'sync', label: 'Синхрончлол', icon: Cloud, group: 'СИСТЕМ' },
  { id: 'settings', label: 'Тохиргоо', icon: Settings, group: 'СИСТЕМ' },
]

const statusLabels: Record<ToolStatus, string> = {
  available: 'Бэлэн', issued: 'Олгосон', overdue: 'Хугацаа хэтэрсэн', damaged: 'Гэмтэлтэй', lost: 'Алдагдсан', maintenance: 'Засварт', retired: 'Ашиглалтаас хассан',
}
const conditionLabels: Record<Condition, string> = { good: 'Хэвийн', damaged: 'Гэмтэлтэй', maintenance: 'Засвар шаардлагатай' }
const dateLabel = (date: string) => new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [demoData, setDemoData] = useState<DemoData>(() => readDemoData())
  const { tools, employees, events, pendingCount, lastSync } = demoData
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [toolPhotoUrls, setToolPhotoUrls] = useState<Record<string, string>>({})
  const [photoViewerToolId, setPhotoViewerToolId] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scannerTarget, setScannerTarget] = useState<ScanTarget | null>(null)
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryStatus, setInventoryStatus] = useState('all')
  const [inventoryPage, setInventoryPage] = useState(1)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [historyType, setHistoryType] = useState('all')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [issueBarcode, setIssueBarcode] = useState('')
  const [issueEmployee, setIssueEmployee] = useState<Employee | null>(null)
  const [issueEmployeePreview, setIssueEmployeePreview] = useState<Employee | null>(null)
  const [issueToolCode, setIssueToolCode] = useState('')
  const [issueToolPreview, setIssueToolPreview] = useState<ToolItem | null>(null)
  const [issueToolQuery, setIssueToolQuery] = useState('')
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])
  const [issueEmployeeConfirmed, setIssueEmployeeConfirmed] = useState(false)
  const [issueStaffConfirmed, setIssueStaffConfirmed] = useState(false)
  const [returnQuery, setReturnQuery] = useState('')
  const [returnToolId, setReturnToolId] = useState('')
  const [returnToolPreview, setReturnToolPreview] = useState<ToolItem | null>(null)
  const [returnCondition, setReturnCondition] = useState<Condition>('good')
  const [returnEmployeeConfirmed, setReturnEmployeeConfirmed] = useState(false)
  const [returnStaffConfirmed, setReturnStaffConfirmed] = useState(false)
  const [dialog, setDialog] = useState<ToolItem | 'new' | null>(null)
  const [toolDetailsId, setToolDetailsId] = useState<string | null>(null)
  const [labelSelectedIds, setLabelSelectedIds] = useState<string[]>([])
  const [printableTools, setPrintableTools] = useState<PrintableTool[] | null>(null)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(demoStorageKey, JSON.stringify(demoData))
      setStorageAvailable(true)
    } catch {
      setStorageAvailable(false)
    }
  }, [demoData])

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []
    const loadThumbnails = async () => {
      const entries = await Promise.all(demoData.tools.filter(tool => tool.photoKey).map(async tool => {
        try {
          const image = await getToolPhoto(tool.id, 'thumbnail')
          if (!image) return null
          const url = URL.createObjectURL(image)
          objectUrls.push(url)
          return [tool.id, url] as const
        } catch {
          return null
        }
      }))
      if (cancelled) {
        objectUrls.forEach(url => URL.revokeObjectURL(url))
        return
      }
      setToolPhotoUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)))
    }
    void loadThumbnails()
    return () => {
      cancelled = true
      objectUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [demoData.tools])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!printableTools) return
    const clearPrintView = () => setPrintableTools(null)
    window.addEventListener('afterprint', clearPrintView)
    const timer = window.setTimeout(() => window.print(), 150)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', clearPrintView)
    }
  }, [printableTools])

  const filteredTools = useMemo(() => tools.filter(tool => {
    const query = inventorySearch.trim().toLocaleLowerCase()
    const matchesText = !query || `${tool.code} ${tool.name} ${tool.category} ${employees.find(employee => employee.id === tool.holderId)?.name ?? ''}`.toLocaleLowerCase().includes(query)
    return matchesText && (inventoryStatus === 'all' || tool.status === inventoryStatus)
  }), [tools, inventorySearch, inventoryStatus, employees])
  const pageSize = 7
  const pageCount = Math.max(1, Math.ceil(filteredTools.length / pageSize))
  const pageTools = filteredTools.slice((inventoryPage - 1) * pageSize, inventoryPage * pageSize)

  const filteredEmployees = employees.filter(employee => {
    const query = employeeSearch.trim().toLocaleLowerCase()
    const matchesText = !query || `${employee.id} ${employee.barcode} ${employee.name} ${employee.department} ${employee.position}`.toLocaleLowerCase().includes(query)
    return matchesText && (employeeFilter === 'all' || String(employee.active) === employeeFilter)
  })

  const filteredEvents = events.filter(event => {
    const employee = employees.find(person => person.id === event.employeeId)
    const toolText = event.toolIds.map(id => tools.find(tool => tool.id === id)?.code ?? '').join(' ')
    const query = historySearch.trim().toLocaleLowerCase()
    const day = event.date.slice(0, 10)
    return (!query || `${employee?.name ?? ''} ${employee?.id ?? ''} ${toolText}`.toLocaleLowerCase().includes(query))
      && (historyType === 'all' || event.type === historyType)
      && (!historyFrom || day >= historyFrom)
      && (!historyTo || day <= historyTo)
  })

  const showToast = (text: string, error = false) => setToast({ text, error })
  const changePage = (next: Page) => { setScannerTarget(null); setPage(next); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const employeeById = (id?: string) => employees.find(employee => employee.id === id)
  const printToolLabels = async (labelTools: ToolItem[]) => {
    if (!labelTools.length) {
      showToast('Хэвлэх багаж сонгоно уу.', true)
      return
    }
    try {
      const labels = await Promise.all(labelTools.map(async tool => ({
        qrId: tool.qrId,
        code: tool.code,
        name: tool.name,
        qrImage: await generateToolQrPng(tool.qrId, 640),
      })))
      setPrintableTools(labels)
    } catch {
      showToast('QR шошгыг үүсгэж чадсангүй. Дахин оролдоно уу.', true)
    }
  }
  const downloadToolQr = async (tool: ToolItem) => {
    try {
      const image = await generateToolQrPng(tool.qrId, 1024)
      const link = document.createElement('a')
      link.href = image
      link.download = `${tool.qrId}.png`
      document.body.append(link)
      link.click()
      link.remove()
    } catch {
      showToast('QR PNG файлыг үүсгэж чадсангүй. Дахин оролдоно уу.', true)
    }
  }
  const registerEvent = (type: EventRecord['type'], employeeId: string, toolIds: string[], condition?: string, updateTools?: (current: ToolItem[]) => ToolItem[]) => {
    const event: EventRecord = { id: Date.now(), type, date: new Date().toISOString(), employeeId, toolIds: [...toolIds], condition }
    setDemoData(current => ({
      ...current,
      tools: updateTools ? updateTools(current.tools) : current.tools,
      events: [event, ...current.events],
      pendingCount: current.pendingCount + 1,
    }))
  }

  const acceptEmployeeCode = (code: string) => {
    const normalizedCode = code.trim().toLowerCase()
    const match = employees.find(employee => employee.barcode.toLowerCase() === normalizedCode || employee.id.toLowerCase() === normalizedCode)
    setIssueBarcode(code)
    setIssueEmployeePreview(match ?? null)
    if (!match) { setIssueEmployee(null); setIssueEmployeeConfirmed(false); showToast('Ажилтны дугаар эсвэл баркод бүртгэлээс олдсонгүй.', true); return }
    if (!match.active) { setIssueEmployee(null); setIssueEmployeeConfirmed(false); showToast(`${match.name} ажилтан идэвхгүй тул багаж олгох боломжгүй.`, true); return }
    if (issueEmployee?.id === match.id) { showToast(`${match.name} ажилтан аль хэдийн сонгогдсон байна.`); return }
    setIssueEmployee(match)
    setIssueEmployeeConfirmed(false)
    showToast(`${match.name} ажилтны мэдээлэл олдлоо.`)
  }
  const findIssueEmployee = () => acceptEmployeeCode(issueBarcode)

  const acceptIssueToolCode = (code: string) => {
    setIssueToolCode(code)
    const normalizedCode = code.trim().toLowerCase()
    const match = tools.find(tool => tool.qrId.toLowerCase() === normalizedCode || tool.code.toLowerCase() === normalizedCode || tool.id.toLowerCase() === normalizedCode)
    if (!match) { setIssueToolPreview(null); showToast('Багажны QR код эсвэл дугаар бүртгэлээс олдсонгүй.', true); return }
    setIssueToolPreview(match)
    if (match.status !== 'available') { showToast(`${match.code} — ${statusLabels[match.status]} тул олгох боломжгүй.`, true); return }
    if (selectedToolIds.includes(match.id)) { showToast(`${match.code} багаж сонгосон жагсаалтад байна.`); return }
    setSelectedToolIds(current => current.includes(match.id) ? current : [...current, match.id])
    showToast(`${match.code} багажийг олголтын жагсаалтад нэмлээ.`)
  }
  const findIssueTool = () => acceptIssueToolCode(issueToolCode)

  const toggleIssueTool = (id: string) => setSelectedToolIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const confirmIssue = () => {
    const selected = tools.filter(tool => selectedToolIds.includes(tool.id))
    if (!issueEmployee) return showToast('Эхлээд ажилтны баркодыг баталгаажуулна уу.', true)
    if (!selected.length) return showToast('Олгох багаж сонгоно уу.', true)
    if (!issueEmployeeConfirmed || !issueStaffConfirmed) return showToast('Ажилтан болон агуулахын ажилтны баталгаажуулалт шаардлагатай.', true)
    if (selected.some(tool => tool.status !== 'available')) return showToast('Сонгосон багаж бэлэн биш байна. Жагсаалтыг шинэчилнэ үү.', true)
    registerEvent('Олголт', issueEmployee.id, selectedToolIds, undefined, current => current.map(tool => selectedToolIds.includes(tool.id) ? { ...tool, status: 'issued', holderId: issueEmployee.id } : tool))
    showToast(`${selected.length} багажийг ${issueEmployee.name} ажилтанд демо горимоор олголоо.`)
    resetIssue()
  }

  const acceptReturnToolCode = (code: string) => {
    setReturnQuery(code)
    const normalizedCode = code.trim().toLowerCase()
    const match = tools.find(tool => tool.qrId.toLowerCase() === normalizedCode || tool.code.toLowerCase() === normalizedCode || tool.id.toLowerCase() === normalizedCode)
    if (!match) { setReturnToolId(''); setReturnToolPreview(null); showToast('Багажны QR код эсвэл дугаар бүртгэлээс олдсонгүй.', true); return }
    setReturnToolPreview(match)
    if (!['issued', 'overdue'].includes(match.status) || !match.holderId) {
      setReturnToolId('')
      showToast(`${match.code} багаж ${statusLabels[match.status]} төлөвтэй тул буцаах боломжгүй.`, true)
      return
    }
    if (returnToolId === match.id) {
      showToast(`${match.code} багаж буцаалтын жагсаалтад аль хэдийн сонгогдсон байна.`)
      return
    }
    setReturnToolId(match.id); setReturnEmployeeConfirmed(false); setReturnStaffConfirmed(false)
    showToast(`${match.code} багажийн олголтын мэдээлэл олдлоо.`)
  }
  const findReturnTool = () => acceptReturnToolCode(returnQuery)

  const confirmReturn = () => {
    const tool = tools.find(item => item.id === returnToolId)
    if (!tool || !tool.holderId || !['issued', 'overdue'].includes(tool.status)) return showToast('Буцаах боломжтой олгосон багаж сонгоно уу.', true)
    if (!returnEmployeeConfirmed || !returnStaffConfirmed) return showToast('Ажилтан болон агуулахын ажилтны баталгаажуулалт шаардлагатай.', true)
    const nextStatus: ToolStatus = returnCondition === 'good' ? 'available' : returnCondition === 'damaged' ? 'damaged' : 'maintenance'
    registerEvent('Буцаалт', tool.holderId, [tool.id], conditionLabels[returnCondition], current => current.map(item => item.id === tool.id ? { ...item, status: nextStatus, holderId: undefined } : item))
    showToast(`${tool.code} багажийг буцаалтаар бүртгэлээ. Демо өгөгдөл шинэчлэгдсэн.`)
    resetReturn()
  }

  const resetIssue = () => {
    setScannerTarget(null); setIssueBarcode(''); setIssueEmployee(null); setIssueEmployeePreview(null); setIssueEmployeeConfirmed(false); setIssueStaffConfirmed(false)
    setIssueToolCode(''); setIssueToolPreview(null); setIssueToolQuery(''); setSelectedToolIds([])
  }

  const resetReturn = () => {
    setScannerTarget(null); setReturnQuery(''); setReturnToolId(''); setReturnToolPreview(null)
    setReturnCondition('good'); setReturnEmployeeConfirmed(false); setReturnStaffConfirmed(false)
  }

  const exportCsv = () => {
    const rows = [
      ['Огноо', 'Үйл явдал', 'Ажилтны дугаар', 'Ажилтны нэр', 'Багажны код', 'Нөхцөл'],
      ...filteredEvents.map(event => [dateLabel(event.date), event.type, event.employeeId, employeeById(event.employeeId)?.name ?? '', event.toolIds.map(id => tools.find(tool => tool.id === id)?.code ?? id).join('; '), event.condition ?? '']),
    ]
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'minetool-tailan.csv'; anchor.click(); URL.revokeObjectURL(url)
    showToast(`${filteredEvents.length} мөрийг CSV файлд экспортоллоо.`)
  }

  const simulateSync = () => {
    if (!online) return showToast('Интернет холболтгүй үед демо синхрончлол хийх боломжгүй.', true)
    setDemoData(current => ({ ...current, pendingCount: 0, lastSync: new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) }))
    showToast('Демо төлөв шинэчлэгдлээ. Сервертэй холбогдоогүй тул бодит өгөгдөл илгээгээгүй.')
  }

  const pageTitle = pages.find(item => item.id === page)?.label ?? 'Хянах самбар'
  const issuedCount = tools.filter(tool => tool.status === 'issued' || tool.status === 'overdue').length
  const overdueCount = tools.filter(tool => tool.status === 'overdue').length
  const damagedCount = tools.filter(tool => tool.status === 'damaged' || tool.status === 'lost').length
  const availableCount = tools.filter(tool => tool.status === 'available').length
  const activeReturnTool = tools.find(tool => tool.id === returnToolId)
  const selectedDetailsTool = tools.find(tool => tool.id === toolDetailsId)
  const activeReturnIssue = activeReturnTool && events.find(event => event.type === 'Олголт' && event.toolIds.includes(activeReturnTool.id))
  const issueCandidates = tools.filter(tool => tool.status === 'available' && `${tool.qrId} ${tool.code} ${tool.name}`.toLowerCase().includes(issueToolQuery.toLowerCase()))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Package size={22} strokeWidth={1.8} />
          </div>
          <div>
            <strong>MineTool</strong>
            <span>АГУУЛАХЫН СИСТЕМ</span>
          </div>
        </div>
        <div className="workspace-tag">
          <span className="live-dot" /> ДЕМО ОРЧИН
        </div>
        <nav className="side-nav" aria-label="Үндсэн цэс">
          {['ҮНДСЭН', 'ҮЙЛ АЖИЛЛАГАА', 'БҮРТГЭЛ', 'ТАЙЛАН', 'СИСТЕМ'].map(
            (group) => (
              <div className="nav-group" key={group}>
                <p className="nav-caption">{group}</p>
                {pages
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        className={`nav-link ${page === item.id ? 'active' : ''}`}
                        key={item.id}
                        onClick={() => changePage(item.id)}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                        {item.id === 'sync' && pendingCount > 0 && (
                          <i>{pendingCount}</i>
                        )}
                      </button>
                    )
                  })}
              </div>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="warehouse-avatar">АС</div>
          <div className="warehouse-user">
            <strong>Агуулахын систем</strong>
            <span>Демо хэрэглэгч</span>
          </div>
          <ChevronDown size={15} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">
              <Package size={19} />
            </div>
            <strong>MineTool</strong>
            <span>ДЕМО</span>
          </div>
          <div className="breadcrumbs">
            <span>MineTool Manager</span>
            <ChevronRight size={14} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="top-actions">
            <div className={`connection-pill ${online ? 'online' : 'offline'}`}>
              <span />
              {online ? 'Холбогдсон' : 'Офлайн'}
            </div>
            <button
              className="icon-button notification-button"
              aria-label="Мэдэгдэл"
              onClick={() => showToast('Одоогоор шинэ мэдэгдэл алга.')}
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="top-user">
              <div className="user-avatar">АС</div>
              <div>
                <strong>Агуулах</strong>
                <span>Демо хэрэглэгч</span>
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">УУРХАЙН АГУУЛАХ · ДЕМО ӨГӨГДӨЛ</div>
              <h1>{pageTitle}</h1>
              <p>
                {page === 'dashboard'
                  ? 'Өнөөдрийн багаж хэрэгслийн бүртгэлийн тойм'
                  : pageDescriptions[page]}
              </p>
            </div>
            {page === 'inventory' && (
              <div className="page-heading-actions">
                <button className="button secondary" onClick={() => changePage('labels')}><QrCode size={16} /> Шошго хэвлэх</button>
                <button className="button primary" onClick={() => setDialog('new')}><Plus size={17} /> Багаж нэмэх</button>
              </div>
            )}
          </div>

          {page === 'dashboard' && (
            <section className="page-stack">
              <div
                className={`demo-banner ${storageAvailable ? '' : 'storage-warning'}`}
              >
                <div className="demo-banner-icon">
                  <CircleHelp size={19} />
                </div>
                <div>
                  <strong>
                    {storageAvailable
                      ? 'Демо орчин'
                      : 'Хөтчийн хадгалалт боломжгүй'}
                  </strong>
                  <span>
                    {storageAvailable
                      ? 'Жишээ ба өөрчилсөн өгөгдөл энэ төхөөрөмжийн хөтчид хадгалагдана. Серверт илгээгдэхгүй.'
                      : 'Хөтчийн санах ой хаалттай эсвэл дүүрсэн байна. Шинэчлэлтүүд хуудсыг дахин ачаалахад хадгалагдахгүй.'}
                  </span>
                </div>
                <span className="demo-badge">ДЕМО</span>
              </div>
              <div className="stat-grid">
                <StatCard
                  label="Нийт бүртгэлтэй"
                  value={tools.length}
                  unit="багаж"
                  icon={Boxes}
                  tone="navy"
                  note="Бүх ангилал"
                />
                <StatCard
                  label="Бэлэн байгаа"
                  value={availableCount}
                  unit="багаж"
                  icon={PackageCheck}
                  tone="green"
                  note="Олгоход бэлэн"
                />
                <StatCard
                  label="Олгогдсон"
                  value={issuedCount}
                  unit="багаж"
                  icon={ArrowDownToLine}
                  tone="blue"
                  note="Ажилтанд байгаа"
                />
                <StatCard
                  label="Хугацаа хэтэрсэн"
                  value={overdueCount}
                  unit="багаж"
                  icon={Clock3}
                  tone="orange"
                  note="Буцаах хугацаа хэтэрсэн"
                />
                <StatCard
                  label="Гэмтэлтэй / алдагдсан"
                  value={damagedCount}
                  unit="багаж"
                  icon={AlertTriangle}
                  tone="red"
                  note="Анхаарах шаардлагатай"
                />
                <StatCard
                  label="Илгээхээр хүлээгдэж буй"
                  value={pendingCount}
                  unit="үйлдэл"
                  icon={Cloud}
                  tone="gray"
                  note="Демо дараалал"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Сүүлийн үйл ажиллагаа</h2>
                      <p>Олголт болон буцаалтын бүртгэл</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => changePage('history')}
                    >
                      Бүгдийг харах <ChevronRight size={15} />
                    </button>
                  </div>
                  <ActivityList
                    events={events.slice(0, 5)}
                    tools={tools}
                    employees={employees}
                  />
                </section>
                <section className="panel attention-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Анхаарах зүйлс</h2>
                      <p>Шуурхай шалгах шаардлагатай</p>
                    </div>
                    <span className="attention-count">
                      {overdueCount + damagedCount}
                    </span>
                  </div>
                  <div className="attention-list">
                    <Attention
                      icon={Clock3}
                      title="Хугацаа хэтэрсэн"
                      description={`${overdueCount} багаж буцаалтын хугацаа хэтэрсэн`}
                      count={overdueCount}
                      tone="orange"
                      onClick={() => {
                        setInventoryStatus('overdue')
                        setInventoryPage(1)
                        changePage('inventory')
                      }}
                    />
                    <Attention
                      icon={AlertTriangle}
                      title="Төлөв шалгах"
                      description={`${damagedCount} багаж ашиглалтаас гарсан`}
                      count={damagedCount}
                      tone="red"
                      onClick={() => {
                        setInventoryStatus('damaged')
                        setInventoryPage(1)
                        changePage('inventory')
                      }}
                    />
                    <Attention
                      icon={Cloud}
                      title="Синхрончлол"
                      description={`${pendingCount} демо үйлдэл хүлээгдэж байна`}
                      count={pendingCount}
                      tone="blue"
                      onClick={() => changePage('sync')}
                    />
                  </div>
                  <div className="panel-footnote">
                    <ShieldCheck size={15} /> Бодит уурхайтай холболт хийгдээгүй
                  </div>
                </section>
              </div>
            </section>
          )}

          {page === 'issue' && (
            <section className="workflow-layout">
              <div className="workflow-main">
                <div className="step-heading">
                  <span className="step-number">01</span>
                  <div>
                    <h2>Ажилтан баталгаажуулах</h2>
                    <p>Камераар уншуулах эсвэл гараар оруулах</p>
                  </div>
                </div>
                <div className="panel workflow-panel">
                  <label className="field-label" htmlFor="employee-barcode">
                    Ажилтны баркод / дугаар
                  </label>
                  <div className="scan-input-row">
                    <div className="input-with-icon">
                      <QrCode size={19} />
                      <input
                        id="employee-barcode"
                        value={issueBarcode}
                        onChange={(event) => {
                          setIssueBarcode(event.target.value)
                          setIssueEmployee(null)
                          setIssueEmployeePreview(null)
                          setIssueEmployeeConfirmed(false)
                        }}
                        onKeyDown={(event) =>
                          event.key === 'Enter' && findIssueEmployee()
                        }
                        placeholder="Жишээ: 88001042"
                        autoComplete="off"
                      />
                    </div>
                    <button
                      className="button secondary scan-trigger"
                      onClick={() => setScannerTarget('employee')}
                    >
                      <Camera size={17} /> Камер
                    </button>
                    <button
                      className="button primary"
                      onClick={findIssueEmployee}
                    >
                      Хайх
                    </button>
                  </div>
                  <p className="field-hint">
                    <Radio size={14} /> Идэвхгүй ажилтанд багаж олгох боломжгүй.
                  </p>
                  {issueEmployeePreview && (
                    <EmployeePreview employee={issueEmployeePreview} />
                  )}
                </div>
                <div className="step-heading section-gap">
                  <span className="step-number">02</span>
                  <div>
                    <h2>Багаж сонгох</h2>
                    <p>QR код уншуулах эсвэл бэлэн жагсаалтаас сонгох</p>
                  </div>
                  <span className="step-count">
                    {selectedToolIds.length} сонгосон
                  </span>
                </div>
                <div className="panel workflow-panel scan-tool-panel">
                  <label className="field-label" htmlFor="issue-tool-code">
                    Багажны QR код / бүртгэлийн дугаар
                  </label>
                  <div className="scan-input-row">
                    <div className="input-with-icon">
                      <QrCode size={19} />
                      <input
                        id="issue-tool-code"
                        value={issueToolCode}
                        onChange={(event) => {
                          setIssueToolCode(event.target.value)
                          setIssueToolPreview(null)
                        }}
                        onKeyDown={(event) =>
                          event.key === 'Enter' && findIssueTool()
                        }
                        placeholder="Жишээ: DRL-0241"
                        autoComplete="off"
                      />
                    </div>
                    <button
                      className="button secondary scan-trigger"
                      onClick={() => setScannerTarget('issue-tool')}
                    >
                      <Camera size={17} /> Камер
                    </button>
                    <button className="button primary" onClick={findIssueTool}>
                      Багаж нэмэх
                    </button>
                  </div>
                  {issueToolPreview && (
                    <ScannedToolPreview
                      tool={issueToolPreview}
                      holder={employeeById(issueToolPreview.holderId)}
                      photoUrl={toolPhotoUrls[issueToolPreview.id]}
                    />
                  )}
                </div>
                <div className="panel tool-picker">
                  <div className="panel-toolbar">
                    <div className="input-with-icon search-input">
                      <Search size={17} />
                      <input
                        value={issueToolQuery}
                        onChange={(event) =>
                          setIssueToolQuery(event.target.value)
                        }
                        placeholder="Код эсвэл нэрээр хайх"
                      />
                    </div>
                    <span className="available-note">
                      <span /> {issueCandidates.length} бэлэн
                    </span>
                  </div>
                  <div className="pick-list">
                    {issueCandidates.map((tool) => (
                      <label
                        className={`pick-row ${selectedToolIds.includes(tool.id) ? 'selected' : ''}`}
                        key={tool.id}
                      >
                        <input
                          type="checkbox"
                          checked={selectedToolIds.includes(tool.id)}
                          onChange={() => toggleIssueTool(tool.id)}
                        />
                        <span className="tool-symbol">
                          <ToolCase size={17} />
                        </span>
                        <span className="pick-tool-info">
                          <strong>{tool.name}</strong>
                          <small>
                            {tool.code} · {tool.category}
                          </small>
                        </span>
                        <span className="badge available">Бэлэн</span>
                      </label>
                    ))}
                    {issueCandidates.length === 0 && (
                      <EmptyState text="Хайлтад тохирох бэлэн багаж олдсонгүй." />
                    )}
                  </div>
                </div>
              </div>
              <aside className="workflow-side panel">
                <h2>Олголтын баталгаажуулалт</h2>
                <p className="side-intro">
                  Олголтыг бүртгэхийн өмнө хоёр талын баталгаажуулалт хийнэ.
                </p>
                <div className="summary-block">
                  <span>Ажилтан</span>
                  <strong>{issueEmployee?.name ?? 'Сонгоогүй'}</strong>
                  <small>
                    {issueEmployee
                      ? `${issueEmployee.id} · ${issueEmployee.department}`
                      : 'Баркод уншуулаагүй'}
                  </small>
                </div>
                <div className="summary-block">
                  <span>Сонгосон багаж</span>
                  <strong>{selectedToolIds.length} багаж</strong>
                </div>
                {selectedToolIds.length > 0 && (
                  <div className="selected-tool-list">
                    {tools
                      .filter((tool) => selectedToolIds.includes(tool.id))
                      .map((tool) => (
                        <div className="selected-tool-row" key={tool.id}>
                          <span>
                            <strong>{tool.name}</strong>
                            <small>{tool.code}</small>
                          </span>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`${tool.code} жагсаалтаас хасах`}
                            onClick={() =>
                              setSelectedToolIds((current) =>
                                current.filter((id) => id !== tool.id),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                <div className="confirm-list">
                  <label
                    className={`confirm-check ${!issueEmployee ? 'disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={issueEmployeeConfirmed}
                      disabled={!issueEmployee}
                      onChange={(event) =>
                        setIssueEmployeeConfirmed(event.target.checked)
                      }
                    />
                    <span className="confirm-icon">
                      <UserRound size={16} />
                    </span>
                    <span>
                      <strong>
                        {issueEmployeeConfirmed
                          ? 'Ажилтан баталгаажуулсан'
                          : 'Ажилтан баталгаажуулах'}
                      </strong>
                      <small>Багаж хүлээн авахыг зөвшөөрсөн</small>
                    </span>
                  </label>
                  <label className="confirm-check">
                    <input
                      type="checkbox"
                      checked={issueStaffConfirmed}
                      onChange={(event) =>
                        setIssueStaffConfirmed(event.target.checked)
                      }
                    />
                    <span className="confirm-icon">
                      <BriefcaseBusiness size={16} />
                    </span>
                    <span>
                      <strong>
                        {issueStaffConfirmed
                          ? 'Агуулах баталгаажуулсан'
                          : 'Агуулах баталгаажуулах'}
                      </strong>
                      <small>Багажийг олгосныг баталгаажуулсан</small>
                    </span>
                  </label>
                </div>
                <button
                  className="button primary full-width"
                  onClick={confirmIssue}
                  disabled={
                    !issueEmployee ||
                    selectedToolIds.length === 0 ||
                    !issueEmployeeConfirmed ||
                    !issueStaffConfirmed
                  }
                >
                  <CheckCircle2 size={17} /> Олголт баталгаажуулах
                </button>
                <button
                  className="button secondary full-width reset-workflow"
                  onClick={resetIssue}
                >
                  <RotateCcw size={16} /> Олголтыг цуцлах / цэвэрлэх
                </button>
                <div className="demo-note">
                  <CircleHelp size={14} /> Демо гүйлгээ зөвхөн энэ төхөөрөмжийн
                  хөтчийн санах ойд хадгалагдана.
                </div>
              </aside>
            </section>
          )}

          {page === 'return' && (
            <section className="workflow-layout return-layout">
              <div className="workflow-main">
                <div className="step-heading">
                  <span className="step-number">01</span>
                  <div>
                    <h2>Буцаах багаж хайх</h2>
                    <p>QR код уншуулах эсвэл кодыг гараар оруулна</p>
                  </div>
                </div>
                <div className="panel workflow-panel">
                  <label className="field-label" htmlFor="return-code">
                    Багажны QR / код
                  </label>
                  <div className="scan-input-row">
                    <div className="input-with-icon">
                      <QrCode size={19} />
                      <input
                        id="return-code"
                        value={returnQuery}
                        onChange={(event) => {
                          setReturnQuery(event.target.value)
                          setReturnToolId('')
                          setReturnToolPreview(null)
                          setReturnEmployeeConfirmed(false)
                          setReturnStaffConfirmed(false)
                        }}
                        onKeyDown={(event) =>
                          event.key === 'Enter' && findReturnTool()
                        }
                        placeholder="Жишээ: GRD-0108"
                        autoComplete="off"
                      />
                    </div>
                    <button
                      className="button secondary scan-trigger"
                      onClick={() => setScannerTarget('return-tool')}
                    >
                      <Camera size={17} /> Камер
                    </button>
                    <button className="button primary" onClick={findReturnTool}>
                      Хайх
                    </button>
                  </div>
                  {returnToolPreview && (
                    <ScannedToolPreview
                      tool={returnToolPreview}
                      holder={employeeById(returnToolPreview.holderId)}
                      photoUrl={toolPhotoUrls[returnToolPreview.id]}
                    />
                  )}
                  <div className="return-shortcuts">
                    <span>Буцаах боломжтой:</span>
                    {tools
                      .filter(
                        (tool) =>
                          (tool.status === 'issued' ||
                            tool.status === 'overdue') &&
                          tool.holderId,
                      )
                      .map((tool) => (
                        <button
                          type="button"
                          key={tool.id}
                          className={`code-chip ${returnToolId === tool.id ? 'active' : ''}`}
                          onClick={() => acceptReturnToolCode(tool.code)}
                        >
                          {tool.code}
                        </button>
                      ))}
                  </div>
                </div>
                {activeReturnTool && (
                  <>
                    <div className="step-heading section-gap">
                      <span className="step-number">02</span>
                      <div>
                        <h2>Буцаалтын нөхцөл</h2>
                        <p>Багажийн төлөвийг шалгаж сонгоно</p>
                      </div>
                    </div>
                    <div className="panel condition-panel">
                      <div className="return-tool-card">
                        <span className="tool-symbol large">
                          <ToolCase size={20} />
                        </span>
                        <div>
                          <strong>{activeReturnTool.name}</strong>
                          <small>
                            {activeReturnTool.code} ·{' '}
                            {activeReturnTool.category}
                          </small>
                        </div>
                        <StatusBadge status={activeReturnTool.status} />
                      </div>
                      <div className="holder-info">
                        <span>Одоогийн эзэмшигч</span>
                        <strong>
                          {employeeById(activeReturnTool.holderId)?.name ??
                            'Мэдээлэл олдсонгүй'}
                        </strong>
                        <small>
                          {employeeById(activeReturnTool.holderId)?.id} ·{' '}
                          {employeeById(activeReturnTool.holderId)?.department}
                        </small>
                      </div>
                      <div className="issue-origin">
                        <Clock3 size={15} />
                        <span>
                          {activeReturnIssue
                            ? `Анхны олголт: ${dateLabel(activeReturnIssue.date)} · ${employeeById(activeReturnIssue.employeeId)?.name ?? activeReturnIssue.employeeId}`
                            : 'Анхны олголтын үйл явдлын түүх олдсонгүй.'}
                        </span>
                      </div>
                      <fieldset className="condition-options">
                        <legend>Буцааж буй багажийн нөхцөл</legend>
                        {(
                          ['good', 'damaged', 'maintenance'] as Condition[]
                        ).map((condition) => (
                          <label
                            key={condition}
                            className={`condition-option ${returnCondition === condition ? 'chosen' : ''}`}
                          >
                            <input
                              type="radio"
                              name="condition"
                              value={condition}
                              checked={returnCondition === condition}
                              onChange={() => setReturnCondition(condition)}
                            />
                            <span className={`condition-dot ${condition}`} />
                            <span>{conditionLabels[condition]}</span>
                            {returnCondition === condition && (
                              <Check size={16} />
                            )}
                          </label>
                        ))}
                      </fieldset>
                    </div>
                  </>
                )}
              </div>
              <aside className="workflow-side panel">
                <h2>Буцаалтын баталгаажуулалт</h2>
                <p className="side-intro">
                  Багаж хүлээн авагч болон агуулахын ажилтан баталгаажуулна.
                </p>
                <div className="summary-block">
                  <span>Багаж</span>
                  <strong>
                    {activeReturnTool?.code ??
                      returnToolPreview?.code ??
                      'Сонгоогүй'}
                  </strong>
                  <small>
                    {activeReturnTool?.name ??
                      returnToolPreview?.name ??
                      'QR код уншуулаагүй'}
                  </small>
                </div>
                <div className="summary-block">
                  <span>Буцаалтын төлөв</span>
                  <strong>{conditionLabels[returnCondition]}</strong>
                  <small>
                    {returnCondition === 'good'
                      ? 'Бэлэн төлөвт шилжинэ'
                      : returnCondition === 'damaged'
                        ? 'Гэмтэлтэй төлөвт шилжинэ'
                        : 'Засварт төлөвт шилжинэ'}
                  </small>
                </div>
                <div className="confirm-list">
                  <label
                    className={`confirm-check ${!activeReturnTool ? 'disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={returnEmployeeConfirmed}
                      disabled={!activeReturnTool}
                      onChange={(event) =>
                        setReturnEmployeeConfirmed(event.target.checked)
                      }
                    />
                    <span className="confirm-icon">
                      <UserRound size={16} />
                    </span>
                    <span>
                      <strong>
                        {returnEmployeeConfirmed
                          ? 'Ажилтан баталгаажуулсан'
                          : 'Ажилтан баталгаажуулах'}
                      </strong>
                      <small>Одоогийн эзэмшигч буцаалтыг зөвшөөрсөн</small>
                    </span>
                  </label>
                  <label className="confirm-check">
                    <input
                      type="checkbox"
                      checked={returnStaffConfirmed}
                      onChange={(event) =>
                        setReturnStaffConfirmed(event.target.checked)
                      }
                    />
                    <span className="confirm-icon">
                      <BriefcaseBusiness size={16} />
                    </span>
                    <span>
                      <strong>
                        {returnStaffConfirmed
                          ? 'Агуулах баталгаажуулсан'
                          : 'Агуулах баталгаажуулах'}
                      </strong>
                      <small>Багажийн нөхцөлийг шалгасан</small>
                    </span>
                  </label>
                </div>
                <button
                  className="button primary full-width"
                  onClick={confirmReturn}
                  disabled={
                    !activeReturnTool ||
                    !returnEmployeeConfirmed ||
                    !returnStaffConfirmed
                  }
                >
                  <CheckCircle2 size={17} /> Буцаалт баталгаажуулах
                </button>
                <button
                  className="button secondary full-width reset-workflow"
                  onClick={resetReturn}
                >
                  <RotateCcw size={16} /> Буцаалтыг цуцлах / цэвэрлэх
                </button>
                <div className="demo-note">
                  <CircleHelp size={14} /> Демо гүйлгээ зөвхөн энэ төхөөрөмжийн
                  хөтчийн санах ойд хадгалагдана.
                </div>
              </aside>
            </section>
          )}

          {page === 'inventory' && (
            <section className="panel data-panel">
              <div className="table-toolbar">
                <div className="input-with-icon search-input">
                  <Search size={17} />
                  <input
                    value={inventorySearch}
                    onChange={(event) => {
                      setInventorySearch(event.target.value)
                      setInventoryPage(1)
                    }}
                    placeholder="Код, нэр, ангилал, эзэмшигчээр хайх"
                  />
                </div>
                <div className="filter-control">
                  <SlidersHorizontal size={16} />
                  <select
                    value={inventoryStatus}
                    onChange={(event) => {
                      setInventoryStatus(event.target.value)
                      setInventoryPage(1)
                    }}
                    aria-label="Багажийн төлөв"
                  >
                    <option value="all">Бүх төлөв</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
                <span className="results-count">
                  {filteredTools.length} багаж
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>БАГАЖ</th>
                      <th>АНГИЛАЛ</th>
                      <th>ТӨЛӨВ</th>
                      <th>ОДООГИЙН ЭЗЭМШИГЧ</th>
                      <th>
                        <span className="sr-only">Үйлдэл</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageTools.map((tool) => (
                      <tr key={tool.id}>
                        <td>
                          <div className="table-tool">
                            <ToolPhotoThumb
                              src={toolPhotoUrls[tool.id]}
                              alt={`${tool.name} зураг`}
                              onClick={toolPhotoUrls[tool.id] ? () => setPhotoViewerToolId(tool.id) : undefined}
                            />
                            <span>
                              <button type="button" className="tool-name-link" onClick={() => setToolDetailsId(tool.id)}>
                                <strong>{tool.name}</strong>
                              </button>
                              <small>{tool.code}</small>
                              <small>{tool.qrId}</small>
                            </span>
                          </div>
                        </td>
                        <td>{tool.category}</td>
                        <td>
                          <StatusBadge status={tool.status} />
                        </td>
                        <td>
                          {employeeById(tool.holderId)?.name ?? (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="icon-button row-edit"
                            aria-label={`${tool.code} засах`}
                            onClick={() => setDialog(tool)}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!pageTools.length && (
                  <EmptyState text="Бүртгэлд тохирох багаж олдсонгүй." />
                )}
              </div>
              <div className="pagination">
                <span>
                  {filteredTools.length
                    ? `${(inventoryPage - 1) * pageSize + 1}–${Math.min(inventoryPage * pageSize, filteredTools.length)} / ${filteredTools.length}`
                    : '0 үр дүн'}
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Өмнөх хуудас"
                    disabled={inventoryPage <= 1}
                    onClick={() => setInventoryPage((value) => value - 1)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <span className="page-indicator">
                    {inventoryPage} / {pageCount}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Дараах хуудас"
                    disabled={inventoryPage >= pageCount}
                    onClick={() => setInventoryPage((value) => value + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {page === 'labels' && (
            <section className="page-stack label-selection-page">
              <div className="demo-banner compact">
                <div className="demo-banner-icon"><QrCode size={18} /></div>
                <div>
                  <strong>Локал демо QR шошго</strong>
                  <span>QR нь зөвхөн тогтмол багажийн дугаарыг агуулна. Энэ бүртгэл төв серверт холбогдоогүй.</span>
                </div>
                <span className="demo-badge">ДЕМО</span>
              </div>
              <section className="panel label-picker-panel">
                <div className="panel-heading">
                  <div><h2>Хэвлэх багаж сонгох</h2><p>{labelSelectedIds.length} багаж сонгосон</p></div>
                  <div className="label-picker-actions">
                    <button type="button" className="button secondary" onClick={() => setLabelSelectedIds(tools.map(tool => tool.id))}>Бүгдийг сонгох</button>
                    <button type="button" className="button secondary" onClick={() => setLabelSelectedIds([])}>Сонголт цэвэрлэх</button>
                    <button type="button" className="button primary" disabled={!labelSelectedIds.length} onClick={() => void printToolLabels(tools.filter(tool => labelSelectedIds.includes(tool.id)))}><QrCode size={16} /> Сонгосон шошгыг хэвлэх</button>
                  </div>
                </div>
                <div className="label-tool-list">
                  {tools.map(tool => (
                    <label className="label-tool-row" key={tool.id}>
                      <input
                        type="checkbox"
                        checked={labelSelectedIds.includes(tool.id)}
                        onChange={() => setLabelSelectedIds(current => current.includes(tool.id) ? current.filter(id => id !== tool.id) : [...current, tool.id])}
                      />
                      <span><strong>{tool.name}</strong><small>{tool.qrId} · {tool.code}</small></span>
                      <StatusBadge status={tool.status} />
                    </label>
                  ))}
                </div>
              </section>
            </section>
          )}

          {page === 'employees' && (
            <section className="page-stack">
              <div className="demo-banner compact">
                <div className="demo-banner-icon">
                  <Users size={18} />
                </div>
                <div>
                  <strong>Ажилтны жишээ мэдээлэл</strong>
                  <span>
                    Жишээ ажилтны мэдээлэл. Хүний нөөцийн системтэй
                    холбогдоогүй.
                  </span>
                </div>
                <span className="demo-badge">{employees.length} ЖИШЭЭ</span>
              </div>
              <section className="panel data-panel">
                <div className="table-toolbar">
                  <div className="input-with-icon search-input">
                    <Search size={17} />
                    <input
                      value={employeeSearch}
                      onChange={(event) =>
                        setEmployeeSearch(event.target.value)
                      }
                      placeholder="Дугаар, нэр, баркод, хэлтсээр хайх"
                    />
                  </div>
                  <div className="filter-control">
                    <SlidersHorizontal size={16} />
                    <select
                      value={employeeFilter}
                      onChange={(event) =>
                        setEmployeeFilter(event.target.value)
                      }
                      aria-label="Ажилтны төлөв"
                    >
                      <option value="all">Бүх төлөв</option>
                      <option value="true">Идэвхтэй</option>
                      <option value="false">Идэвхгүй</option>
                    </select>
                    <ChevronDown size={14} />
                  </div>
                  <span className="results-count">
                    {filteredEmployees.length} ажилтан
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>АЖИЛТАН</th>
                        <th>АЖИЛТНЫ ДУГААР</th>
                        <th>ХЭЛТЭС</th>
                        <th>АЛБАН ТУШААЛ</th>
                        <th>ТӨЛӨВ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id}>
                          <td>
                            <div className="employee-table-cell">
                              <span className="person-avatar">
                                {employee.name
                                  .split(' ')
                                  .map((part) => part[0])
                                  .slice(0, 2)
                                  .join('')}
                              </span>
                              <span>
                                <strong>{employee.name}</strong>
                                <small>Баркод: {employee.barcode}</small>
                              </span>
                            </div>
                          </td>
                          <td className="mono-cell">{employee.id}</td>
                          <td>{employee.department}</td>
                          <td>{employee.position}</td>
                          <td>
                            <span
                              className={`badge ${employee.active ? 'active-status' : 'inactive-status'}`}
                            >
                              <span />
                              {employee.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredEmployees.length && (
                    <EmptyState text="Хайлтад тохирох ажилтан олдсонгүй." />
                  )}
                </div>
              </section>
            </section>
          )}

          {page === 'history' && (
            <section className="panel data-panel">
              <div className="history-toolbar">
                <div className="input-with-icon search-input">
                  <Search size={17} />
                  <input
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Ажилтан эсвэл багажны код"
                  />
                </div>
                <div className="filter-control">
                  <SlidersHorizontal size={16} />
                  <select
                    value={historyType}
                    onChange={(event) => setHistoryType(event.target.value)}
                    aria-label="Үйл явдлын төрөл"
                  >
                    <option value="all">Бүх үйл явдал</option>
                    <option value="Олголт">Олголт</option>
                    <option value="Буцаалт">Буцаалт</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
                <label className="date-filter">
                  <span>Эхлэх</span>
                  <input
                    type="date"
                    value={historyFrom}
                    onChange={(event) => setHistoryFrom(event.target.value)}
                  />
                </label>
                <label className="date-filter">
                  <span>Дуусах</span>
                  <input
                    type="date"
                    value={historyTo}
                    onChange={(event) => setHistoryTo(event.target.value)}
                  />
                </label>
                <button
                  className="button secondary export-button"
                  onClick={exportCsv}
                >
                  <Download size={16} /> CSV экспорт
                </button>
              </div>
              <div className="history-summary">
                <Activity size={16} /> Шүүлтэд тохирсон{' '}
                <strong>{filteredEvents.length}</strong> бүртгэл <span>·</span>{' '}
                Демо түүх
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ОГНОО, ЦАГ</th>
                      <th>ҮЙЛ ЯВДАЛ</th>
                      <th>АЖИЛТАН</th>
                      <th>БАГАЖ</th>
                      <th>ТӨЛӨВ / НӨХЦӨЛ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="date-cell">{dateLabel(event.date)}</td>
                        <td>
                          <span
                            className={`event-type ${event.type === 'Олголт' ? 'issue-event' : 'return-event'}`}
                          >
                            {event.type === 'Олголт' ? (
                              <ArrowDownToLine size={14} />
                            ) : (
                              <ArrowLeftRight size={14} />
                            )}
                            {event.type}
                          </span>
                        </td>
                        <td>
                          <div className="table-person">
                            <strong>
                              {employeeById(event.employeeId)?.name ??
                                'Тодорхойгүй'}
                            </strong>
                            <small>{event.employeeId}</small>
                          </div>
                        </td>
                        <td>
                          {event.toolIds
                            .map(
                              (id) =>
                                tools.find((tool) => tool.id === id)?.code ??
                                id,
                            )
                            .join(', ')}
                        </td>
                        <td>
                          {event.condition ??
                            (event.type === 'Олголт'
                              ? 'Ажилтанд олгосон'
                              : 'Буцаалт')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredEvents.length && (
                  <EmptyState text="Сонгосон шүүлтэд бүртгэл алга." />
                )}
              </div>
            </section>
          )}

          {page === 'sync' && (
            <section className="sync-layout">
              <div className="sync-main page-stack">
                <section className="panel sync-status-panel">
                  <div className="sync-status-top">
                    <div className={`sync-orb ${online ? 'is-online' : ''}`}>
                      {online ? <Signal size={25} /> : <SignalZero size={25} />}
                    </div>
                    <div>
                      <span
                        className={`status-overline ${online ? 'green-text' : 'red-text'}`}
                      >
                        {online ? 'СҮЛЖЭЭ ИДЭВХТЭЙ' : 'ОФЛАЙН'}
                      </span>
                      <h2>
                        {online
                          ? 'Интернет холболт байна'
                          : 'Интернет холболт алга'}
                      </h2>
                      <p>Энэ нь сервертэй синхрончлогдсон гэсэн үг биш.</p>
                    </div>
                    <span className="demo-badge">ДЕМО</span>
                  </div>
                  <div className="sync-metrics">
                    <div>
                      <span>Сүүлд шалгасан</span>
                      <strong>{lastSync}</strong>
                    </div>
                    <div>
                      <span>Хүлээгдэж буй демо үйлдэл</span>
                      <strong>{pendingCount}</strong>
                    </div>
                    <div>
                      <span>Өгөгдлийн сан</span>
                      <strong className="red-text">Холбогдоогүй</strong>
                    </div>
                  </div>
                  <button className="button primary" onClick={simulateSync}>
                    <ArrowLeftRight size={17} /> Демо төлөв шинэчлэх
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Хүлээгдэж буй үйлдлүүд</h2>
                      <p>Зөвхөн энэ хөтчийн түр демо дараалал</p>
                    </div>
                    <span className="badge queued">
                      {pendingCount} хүлээгдэж буй
                    </span>
                  </div>
                  {pendingCount ? (
                    <div className="queue-list">
                      {Array.from({ length: pendingCount }, (_, index) => (
                        <div className="queue-row" key={index}>
                          <span className="queue-icon">
                            <ClipboardList size={17} />
                          </span>
                          <span>
                            <strong>Демо үйлдэл #{pendingCount - index}</strong>
                            <small>
                              Хөтчийн санах ойд · Сервер рүү илгээгээгүй
                            </small>
                          </span>
                          <span className="queue-time">Хүлээгдэж байна</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={CheckCircle2}
                      text="Хүлээгдэж буй демо үйлдэл алга."
                    />
                  )}
                </section>
              </div>
              <aside className="panel sync-explainer">
                <div className="sync-explainer-icon">
                  <CircleHelp size={20} />
                </div>
                <h2>Демо синхрончлол</h2>
                <p>
                  Энэ дэлгэц холболтын төлөв болон жишээ дарааллыг үзүүлнэ.
                  Сервер, уурхай, ажилтны мэдээллийн системтэй холболт одоогоор
                  хийгдээгүй.
                </p>
                <div className="explanation-line">
                  <CheckCircle2 size={16} />
                  <span>Хөтчийн интернет төлөв харагдана</span>
                </div>
                <div className="explanation-line">
                  <XCircle size={16} />
                  <span>Үйлдэл серверт илгээгдэхгүй</span>
                </div>
                <div className="explanation-line">
                  <XCircle size={16} />
                  <span>{storageAvailable ? 'Хуудас хаасан ч демо өгөгдөл хөтчийн санах ойд хадгалагдана.' : 'Хөтчийн хадгалалт боломжгүй тул дахин ачаалахад өөрчлөлт арилж болно.'}</span>
                </div>
              </aside>
            </section>
          )}

          {page === 'settings' && (
            <section className="settings-layout">
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Ерөнхий мэдээлэл</h2>
                    <p>Аппликейшний одоогийн тохиргоо</p>
                  </div>
                  <Settings size={18} />
                </div>
                <SettingRow
                  icon={ToolCase}
                  label="Аппликейшний нэр"
                  value="MineTool Manager"
                />
                <SettingRow
                  icon={Languages}
                  label="Интерфэйсийн хэл"
                  value="Монгол хэл"
                />
                <SettingRow
                  icon={Users}
                  label="Ажилтны мэдээллийн эх үүсвэр"
                  value="Демо өгөгдөл"
                />
                <SettingRow
                  icon={Boxes}
                  label="Багажны мэдээллийн эх үүсвэр"
                  value="Демо өгөгдөл"
                />
                <SettingRow
                  icon={ShieldCheck}
                  label="Өгөгдлийн сангийн холболт"
                  value="Холбогдоогүй"
                  negative
                />
              </section>
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Орчны мэдээлэл</h2>
                    <p>Хөгжүүлэлтийн үеийн төлөв</p>
                  </div>
                  <HardHat size={19} />
                </div>
                <SettingRow
                  icon={Radio}
                  label="Ажиллах орчин"
                  value="Локал демо"
                />
                <SettingRow
                  icon={Cloud}
                  label="Серверийн холболт"
                  value="Тохируулаагүй"
                  negative
                />
                <SettingRow
                  icon={Activity}
                  label="Демо өгөгдлийн хадгалалт"
                  value={
                    storageAvailable
                      ? 'Хөтчийн санах ой'
                      : 'Хадгалалт боломжгүй'
                  }
                  negative={!storageAvailable}
                />
                <div className="settings-notice">
                  <CircleHelp size={17} />
                  <span>
                    <strong>Үйлдвэрлэлийн бэлэн байдал</strong>
                    <br />
                    Бодит ажилтны мэдээлэл, эрхийн удирдлага, серверийн холболт
                    болон найдвартай хадгалалт холбогдоогүй.
                  </span>
                </div>
              </section>
            </section>
          )}
        </div>
        <footer className="app-footer">
          <span>
            MineTool Manager <span className="footer-separator">·</span> Демо
            хувилбар
          </span>
          <span>Уурхайн агуулахын багажны бүртгэл</span>
        </footer>
      </main>

      <nav className="mobile-nav" aria-label="Гар утасны цэс">
        {(['dashboard', 'issue', 'return', 'inventory'] as Page[]).map((id) => {
          const item = pages.find((navItem) => navItem.id === id)!
          const Icon = item.icon
          return (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              onClick={() => changePage(id)}
            >
              <Icon size={19} />
              <span>
                {id === 'dashboard'
                  ? 'Самбар'
                  : id === 'inventory'
                    ? 'Бүртгэл'
                    : item.label}
              </span>
            </button>
          )
        })}
        <button
          className={mobileMenuOpen ? 'active' : ''}
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          <Menu size={20} />
          <span>Бусад</span>
        </button>
      </nav>
      {mobileMenuOpen && (
        <>
          <button
            className="menu-scrim"
            aria-label="Цэс хаах"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="mobile-more-menu">
            {pages
              .filter(
                (item) =>
                  !['dashboard', 'issue', 'return', 'inventory'].includes(
                    item.id,
                  ),
              )
              .map((item) => {
                const Icon = item.icon
                return (
                  <button key={item.id} onClick={() => changePage(item.id)}>
                    <Icon size={18} />
                    {item.label}
                  </button>
                )
              })}
          </div>
        </>
      )}
      {scannerTarget && (
        <CameraScanner
          title={
            scannerTarget === 'employee'
              ? 'Ажилтны баркод уншуулах'
              : 'Багажны код уншуулах'
          }
          instruction={
            scannerTarget === 'employee'
              ? 'Ажилтны үнэмлэх дээрх баркодыг хүрээ дотор байрлуулна уу.'
              : 'Багажны QR эсвэл шошгыг хүрээ дотор байрлуулна уу.'
          }
          onDetected={(value) => {
            if (scannerTarget === 'employee') acceptEmployeeCode(value)
            else if (scannerTarget === 'issue-tool') acceptIssueToolCode(value)
            else acceptReturnToolCode(value)
            setScannerTarget(null)
          }}
          onClose={() => setScannerTarget(null)}
        />
      )}
      {photoViewerToolId && (
        <ToolPhotoViewer
          tool={tools.find((tool) => tool.id === photoViewerToolId)}
          onClose={() => setPhotoViewerToolId(null)}
        />
      )}
      {selectedDetailsTool && (
        <ToolDetailsDialog
          tool={selectedDetailsTool}
          onClose={() => setToolDetailsId(null)}
          onPrint={() => {
            const tool = tools.find(item => item.id === toolDetailsId)
            if (tool) void printToolLabels([tool])
          }}
          onDownload={() => {
            const tool = tools.find(item => item.id === toolDetailsId)
            if (tool) void downloadToolQr(tool)
          }}
        />
      )}
      {printableTools && (
        <div className="print-document" aria-label="Хэвлэх QR шошго">
          <div className="print-label-sheet">
            {printableTools.map(tool => (
              <article className="print-label" key={tool.qrId}>
                <img src={tool.qrImage} alt={`${tool.qrId} QR код`} />
                <div className="print-label-copy">
                <small>{tool.qrId}</small>
                <strong>{tool.code}</strong>
                  <span>{tool.name}</span>
                  <b>БҮРТГЭЛТЭЙ БАГАЖ</b>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? 'toast-error' : ''}`}
          role="status"
        >
          <span>
            {toast.error ? (
              <AlertTriangle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </span>
          {toast.text}
          <button aria-label="Мэдэгдэл хаах" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {dialog && (
        <ToolDialog
          tool={dialog === 'new' ? undefined : dialog}
          photoKey={dialog === 'new' ? undefined : dialog.photoKey}
          nextQrId={nextToolQrId(tools)}
          existingCodes={tools
            .filter((item) => dialog === 'new' || item.id !== dialog.id)
            .map((item) => item.code)}
          onClose={() => setDialog(null)}
          onSave={async (tool, photoChange, isNew) => {
            const existingTool = tools.find(item => item.id === tool.id)
            if (isNew && tools.some(item => item.id === tool.id || item.qrId.toUpperCase() === tool.qrId.toUpperCase())) {
              throw new Error('Багажийн дугаар эсвэл QR дугаар давхардсан байна. Дахин оролдоно уу.')
            }
            if (!isNew && (!existingTool || existingTool.qrId !== tool.qrId)) {
              throw new Error('Бүртгэлтэй багажийн QR дугаарыг өөрчлөх боломжгүй.')
            }
            if (tools.some(item => item.id !== tool.id && item.qrId.toUpperCase() === tool.qrId.toUpperCase())) {
              throw new Error('Энэ QR дугаар өөр багажид бүртгэлтэй байна.')
            }
            try {
              if (photoChange.file) await saveToolPhoto(tool.id, photoChange.file)
              else if (photoChange.remove) await deleteToolPhoto(tool.id)
              setDemoData((current) => ({
                ...current,
                tools: isNew
                  ? [...current.tools, tool]
                  : current.tools.map((item) =>
                      item.id === tool.id ? tool : item,
                    ),
              }))
              showToast(
                isNew
                  ? 'Шинэ багажийн демо бүртгэл хадгалагдлаа.'
                  : 'Багажийн демо мэдээлэл шинэчлэгдлээ.',
              )
            } catch (error) {
              if (error instanceof Error && error.message.startsWith('Багаж')) throw error
              throw new Error('Зургийг энэ төхөөрөмжийн хөтчид хадгалж чадсангүй. Хадгалах зайг шалгаад дахин оролдоно уу.')
            }
          }}
        />
      )}
    </div>
  )
}

const pageDescriptions: Record<Page, string> = {
  dashboard: 'Өнөөдрийн багаж хэрэгслийн бүртгэлийн тойм', issue: 'Ажилтанд багаж олгох үйл явцыг баталгаажуулна', return: 'Багаж хүлээн авч нөхцөлийг бүртгэнэ', inventory: 'Багажийн бүртгэл, төлөвийг удирдана', labels: 'Багажийн QR шошгыг нэг дор хэвлэнэ', employees: 'Ажилтны жишээ бүртгэл, баркодын мэдээлэл', history: 'Олголт, буцаалтын үйл ажиллагааны тайлан', sync: 'Офлайн төлөв болон демо үйлдлийн дараалал', settings: 'Аппликейшний одоогийн тохиргоо ба холболтууд',
}

function StatCard({ label, value, unit, icon: Icon, tone, note }: { label: string; value: number; unit: string; icon: LucideIcon; tone: string; note: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{unit}</small></div><span className="stat-note">{note}</span></article>
}

function StatusBadge({ status }: { status: ToolStatus }) { return <span className={`badge ${status}`}><i />{statusLabels[status]}</span> }

function EmployeePreview({ employee }: { employee: Employee }) {
  return <div className="employee-preview"><span className="person-avatar large-avatar">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><strong>{employee.name}</strong><span>{employee.id} · {employee.position}</span><small>{employee.department}</small></div><span className={`badge ${employee.active ? 'active-status' : 'inactive-status'}`}><i />{employee.active ? 'Идэвхтэй' : 'Идэвхгүй'}</span></div>
}

function ScannedToolPreview({ tool, holder, photoUrl }: { tool: ToolItem; holder?: Employee; photoUrl?: string }) {
  return <div className="scanned-tool-preview"><ToolPhotoThumb src={photoUrl} alt={`${tool.name} зураг`} /><div className="scanned-tool-copy"><strong>{tool.name}</strong><span>{tool.code} · {tool.category}</span><small>{tool.qrId} · Одоогийн эзэмшигч: {holder?.name ?? 'Байхгүй'}</small></div><StatusBadge status={tool.status} /></div>
}

function ToolPhotoThumb({ src, alt, onClick }: { src?: string; alt: string; onClick?: () => void }) {
  const contents = src ? <img src={src} alt={alt} loading="lazy" /> : <ImageIcon size={18} />
  if (onClick) return <button type="button" className="tool-photo-thumb clickable" aria-label={`${alt} томоор харах`} onClick={onClick}>{contents}</button>
  return <span className="tool-photo-thumb">{contents}</span>
}

function ToolPhotoViewer({ tool, onClose }: { tool?: ToolItem; onClose: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string>()
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    if (!tool?.photoKey) return () => { active = false }
    void getToolPhoto(tool.id, 'original').then(photo => {
      if (!active) return
      if (!photo) { setError(true); return }
      objectUrl = URL.createObjectURL(photo)
      setPhotoUrl(objectUrl)
    }).catch(() => { if (active) setError(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [tool?.id, tool?.photoKey])

  return <div className="photo-viewer-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="photo-viewer" role="dialog" aria-modal="true" aria-label="Багажийн зураг"><div className="photo-viewer-heading"><span>{tool?.name ?? 'Багажийн зураг'} · {tool?.code ?? ''}</span><button type="button" className="icon-button" aria-label="Зураг хаах" onClick={onClose}><X size={19} /></button></div>{photoUrl ? <img className="photo-viewer-image" src={photoUrl} alt={`${tool?.name ?? 'Багаж'} бүрэн зураг`} /> : <div className="photo-viewer-empty"><ImageIcon size={24} /><span>{error ? 'Зургийг хөтчийн сангаас уншиж чадсангүй.' : 'Зураг ачаалж байна...'}</span></div>}</section></div>
}

function ActivityList({ events, tools, employees }: { events: EventRecord[]; tools: ToolItem[]; employees: Employee[] }) {
  if (!events.length) return <EmptyState text="Үйл ажиллагааны бүртгэл алга." />
  return <div className="activity-list">{events.map(event => { const employee = employees.find(person => person.id === event.employeeId); const names = event.toolIds.map(id => tools.find(tool => tool.id === id)?.code ?? id).join(', '); return <div className="activity-row" key={event.id}><span className={`activity-icon ${event.type === 'Олголт' ? 'issued' : 'returned'}`}>{event.type === 'Олголт' ? <ArrowDownToLine size={17} /> : <PackageCheck size={17} />}</span><div className="activity-copy"><strong>{event.type} · {names}</strong><span>{employee?.name ?? 'Тодорхойгүй'}{event.condition ? ` · ${event.condition}` : ''}</span></div><time>{new Intl.DateTimeFormat('mn-MN', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.date))}</time></div> })}</div>
}

function Attention({ icon: Icon, title, description, count, tone, onClick }: { icon: LucideIcon; title: string; description: string; count: number; tone: string; onClick: () => void }) {
  return <button className="attention-row" onClick={onClick}><span className={`attention-icon ${tone}`}><Icon size={17} /></span><span className="attention-copy"><strong>{title}</strong><small>{description}</small></span><span className={`attention-number ${tone}`}>{count}</span></button>
}

function EmptyState({ text, icon: Icon = Search }: { text: string; icon?: LucideIcon }) {
  return <div className="empty-state"><Icon size={21} /><span>{text}</span></div>
}

function SettingRow({ icon: Icon, label, value, negative = false }: { icon: LucideIcon; label: string; value: string; negative?: boolean }) {
  return <div className="setting-row"><span className="setting-icon"><Icon size={17} /></span><span className="setting-label">{label}</span><strong className={negative ? 'red-text' : ''}>{value}</strong></div>
}

function ToolDetailsDialog({ tool, onClose, onPrint, onDownload }: { tool: ToolItem; onClose: () => void; onPrint: () => void; onDownload: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="dialog tool-details-dialog" role="dialog" aria-modal="true" aria-labelledby="tool-details-title">
        <div className="dialog-heading">
          <div><span className="eyebrow">БАГАЖИЙН ДЭМО QR БҮРТГЭЛ</span><h2 id="tool-details-title">{tool.name}</h2></div>
          <button type="button" className="icon-button" aria-label="Хаах" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="tool-qr-card">
          <ToolQrImage qrId={tool.qrId} size={300} className="tool-qr-image" />
          <div className="tool-qr-copy">
            <strong>{tool.code}</strong>
            <span>{tool.name}</span>
            <code>{tool.qrId}</code>
            <StatusBadge status={tool.status} />
          </div>
        </div>
        <p className="qr-demo-note"><CircleHelp size={15} /> QR дугаар энэ төхөөрөмжийн локал демо бүртгэлтэй холбогдоно. Төв серверт бүртгэгдээгүй.</p>
        <div className="tool-qr-actions">
          <button type="button" className="button primary" onClick={onPrint}><QrCode size={16} /> QR код хэвлэх</button>
          <button type="button" className="button secondary" onClick={onDownload}><Download size={16} /> QR код татах</button>
          <button type="button" className="button secondary" onClick={onPrint}><QrCode size={16} /> QR код дахин хэвлэх</button>
        </div>
      </section>
    </div>
  )
}

function ToolDialog({
  tool,
  nextQrId,
  photoKey,
  existingCodes,
  onClose,
  onSave,
}: {
  tool?: ToolItem
  nextQrId: string
  photoKey?: string
  existingCodes: string[]
  onClose: () => void
  onSave: (tool: ToolItem, photoChange: ToolPhotoChange, isNew: boolean) => Promise<void>
}) {
  const isNew = !tool
  const [code, setCode] = useState(tool?.code ?? '')
  const [name, setName] = useState(tool?.name ?? '')
  const [category, setCategory] = useState(tool?.category ?? 'Гар багаж')
  const [status, setStatus] = useState<ToolStatus>(tool?.status ?? 'available')
  const [selectedPhoto, setSelectedPhoto] = useState<File>()
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>()
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string>()
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoLoadError, setPhotoLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    setPhotoLoadError(false)
    if (!tool?.photoKey) {
      setExistingPhotoUrl(undefined)
      return () => { active = false }
    }
    void getToolPhoto(tool.id, 'original').then(photo => {
      if (!photo) {
        if (active) setPhotoLoadError(true)
        return
      }
      objectUrl = URL.createObjectURL(photo)
      if (active) setExistingPhotoUrl(objectUrl)
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => { if (active) setPhotoLoadError(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [tool?.id, tool?.photoKey])

  useEffect(() => {
    if (!selectedPhoto) {
      setSelectedPhotoUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(selectedPhoto)
    setSelectedPhotoUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedPhoto])

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoError('')
    if (file.size > maxToolPhotoBytes) {
      setPhotoError('Зургийн хэмжээ 5 МБ-аас их байна. Жижиг зураг сонгоно уу.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
      setPhotoError('Зөвхөн JPEG, PNG эсвэл WebP зургийн файл сонгоно уу.')
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
    } catch {
      setPhotoError('Зургийн файл уншигдахгүй байна. Өөр зураг сонгоно уу.')
      return
    }
    setSelectedPhoto(file)
    setPhotoRemoved(false)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!code.trim() || !name.trim() || !category.trim()) {
      setError('Код, нэр, ангиллыг бүрэн оруулна уу.')
      return
    }
    if (
      existingCodes.some(
        (existingCode) =>
          existingCode.toUpperCase() === code.trim().toUpperCase(),
      )
    ) {
      setError('Энэ багажны код бүртгэлтэй байна. Давхардалгүй код оруулна уу.')
      return
    }
    if ((status === 'issued' || status === 'overdue') && !tool?.holderId) {
      setError(
        'Эзэмшигчгүй олголтын төлөв үүсгэх боломжгүй. Олголтын хэсгийг ашиглана уу.',
      )
      return
    }
    const id = tool?.id ?? `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const nextTool: ToolItem = {
      id,
      qrId: tool?.qrId ?? nextQrId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category: category.trim(),
      status,
      holderId: status === 'issued' || status === 'overdue' ? tool?.holderId : undefined,
      photoKey: selectedPhoto ? id : photoRemoved ? undefined : photoKey,
    }
    setSaving(true)
    try {
      await onSave(nextTool, {
        file: selectedPhoto,
        remove: !selectedPhoto && photoRemoved && Boolean(photoKey),
      }, isNew)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Багажийн мэдээллийг хадгалж чадсангүй.')
    } finally {
      setSaving(false)
    }
  }
  const displayedPhotoUrl = selectedPhotoUrl ?? (photoRemoved ? undefined : existingPhotoUrl)
  const hasPhoto = Boolean(displayedPhotoUrl || (photoKey && !photoRemoved))

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="dialog"
        onSubmit={submit}
        aria-labelledby="tool-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">БАГАЖНЫ БҮРТГЭЛ</span>
            <h2 id="tool-dialog-title">
              {isNew ? 'Шинэ багаж нэмэх' : 'Багаж засах'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Хаах"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <label className="form-field">
          <span>
            Багажны код <b>*</b>
          </span>
          <input
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Жишээ: DRL-0260"
            maxLength={24}
          />
        </label>
        <label className="form-field">
          <span>
            Багажны нэр <b>*</b>
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Багажны нэр"
            maxLength={80}
          />
        </label>
        <label className="form-field">
          <span>
            Ангилал <b>*</b>
          </span>
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Жишээ: Гар багаж"
            maxLength={50}
          />
        </label>
        <label className="form-field">
          <span>Төлөв</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ToolStatus)}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <section className="tool-photo-field" aria-labelledby="tool-photo-label">
          <div className="tool-photo-field-heading">
            <div><strong id="tool-photo-label">Багажийн зураг</strong><span>Сонголттой · Дээд хэмжээ 5 МБ</span></div>
            {hasPhoto && <span className="photo-attached-label">Зураг хавсаргасан</span>}
          </div>
          <div className={`tool-photo-preview ${displayedPhotoUrl ? 'has-photo' : ''}`}>
            {displayedPhotoUrl ? <img src={displayedPhotoUrl} alt="Сонгосон багажийн зураг" /> : <div className="tool-photo-placeholder"><ImageIcon size={26} /><span>{photoLoadError ? 'Өмнөх зургийг уншиж чадсангүй' : photoKey && !photoRemoved ? 'Зургийг ачаалж байна...' : 'Багажийн зураг хавсаргаагүй'}</span></div>}
          </div>
          <div className="photo-actions">
            <input ref={cameraInputRef} className="visually-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhotoSelection} aria-label="Камераар авах зураг сонгох" />
            <input ref={galleryInputRef} className="visually-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelection} aria-label="Төхөөрөмжөөс зураг сонгох" />
            <button type="button" className="button secondary photo-action" onClick={() => cameraInputRef.current?.click()}><Camera size={16} /> Камераар зураг авах</button>
            <button type="button" className="button secondary photo-action" onClick={() => galleryInputRef.current?.click()}><ImageIcon size={16} /> {hasPhoto ? 'Зураг солих' : 'Зураг сонгох'}</button>
            {hasPhoto && <button type="button" className="button secondary photo-action remove-photo" onClick={() => { setSelectedPhoto(undefined); setPhotoRemoved(true); setPhotoError('') }}><Trash2 size={15} /> Зураг устгах</button>}
          </div>
          {photoError && <div className="form-error"><AlertTriangle size={15} />{photoError}</div>}
          <p className="photo-storage-note">Зураг зөвхөн энэ төхөөрөмжийн хөтөчид хадгалагдана. Сервер рүү илгээгдэхгүй.</p>
        </section>
        {error && (
          <div className="form-error">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}
        <div className="dialog-demo-note">
          <CircleHelp size={15} /> Демо бүртгэлд түр хугацаанд хадгалагдана.
        </div>
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Болих
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            <Check size={16} />
            {saving ? 'Хадгалж байна...' : isNew ? 'Бүртгэлд нэмэх' : 'Өөрчлөлт хадгалах'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default App