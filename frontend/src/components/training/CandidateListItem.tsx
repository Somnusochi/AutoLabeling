import type { VirtualItem } from '@tanstack/react-virtual'

interface CandidateListItemProps {
  det: Detection
  virtualRow: VirtualItem
  isSelected: boolean
  toggleSelect: (id: string) => void
  setHoveredDetId: (id: string | null) => void
  setHoveredRect: (rect: { right: number; top: number } | null) => void
  enterTimerRef: { current: number | null }
  leaveTimerRef: { current: number | null }
}

export const CandidateListItem = memo(
  ({
    det,
    virtualRow,
    isSelected,
    toggleSelect,
    setHoveredDetId,
    setHoveredRect,
    enterTimerRef,
    leaveTimerRef,
  }: CandidateListItemProps) => {
    const { t } = useTranslation()

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        }}
        className="pb-1">
        <label
          className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-gray-50 rounded px-1 group h-full"
          onMouseEnter={e => {
            if (leaveTimerRef.current) {
              clearTimeout(leaveTimerRef.current)
              leaveTimerRef.current = null
            }
            if (enterTimerRef.current) {
              clearTimeout(enterTimerRef.current)
            }
            const rect = e.currentTarget.getBoundingClientRect()
            enterTimerRef.current = window.setTimeout(() => {
              setHoveredDetId(det.id)
              setHoveredRect({ right: rect.right, top: rect.top })
            }, 400)
          }}
          onMouseLeave={() => {
            if (enterTimerRef.current) {
              clearTimeout(enterTimerRef.current)
              enterTimerRef.current = null
            }
            leaveTimerRef.current = window.setTimeout(() => {
              setHoveredDetId(null)
              setHoveredRect(null)
            }, 150)
          }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(det.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0"
          />
          <img
            src={`${API_BASE}/detections/${det.id}/image`}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-8 w-8 rounded object-cover flex-shrink-0"
          />
          <span className="truncate flex-1">{det.imageName}</span>
          <span className="text-gray-400 flex-shrink-0">
            {t('trainingPanel.targetsCount', { count: det.boxes.length })}
          </span>
        </label>
      </div>
    )
  },
)
