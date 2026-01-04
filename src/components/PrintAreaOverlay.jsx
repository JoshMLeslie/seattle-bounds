import { useState, useRef, useEffect } from 'react'

function PrintAreaOverlay({ aspectRatio, printAreaRef }) {
  const overlayRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [position, setPosition] = useState(null) // null = centered
  const [width, setWidth] = useState(300)
  const dragStart = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ width: 0, x: 0, y: 0 })

  // Compute height from width and aspect ratio
  const height = aspectRatio ? width / aspectRatio : width
  const size = { width, height }

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return
    e.preventDefault()
    setIsDragging(true)
    const rect = overlayRef.current?.getBoundingClientRect()
    if (rect) {
      dragStart.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
  }

  const handleResizeMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStart.current = {
      width,
      x: e.clientX,
      y: e.clientY
    }
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && overlayRef.current) {
        const parent = overlayRef.current.parentElement
        if (parent) {
          const parentRect = parent.getBoundingClientRect()
          setPosition({
            x: e.clientX - parentRect.left - dragStart.current.x,
            y: e.clientY - parentRect.top - dragStart.current.y
          })
        }
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.current.x
        const newWidth = Math.max(100, resizeStart.current.width + deltaX)
        setWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, aspectRatio])

  // Calculate style - center if no position set yet
  const positionStyle = position
    ? { left: position.x, top: position.y }
    : { left: '50%', top: '50%', transform: `translate(-50%, -50%)` }

  return (
    <div
      ref={(el) => {
        overlayRef.current = el
        if (printAreaRef) printAreaRef.current = el
      }}
      className="print-area-overlay"
      style={{
        ...positionStyle,
        width: size.width,
        height: size.height,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="print-area-label">Print Area</div>
      <div
        className="resize-handle"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  )
}

export default PrintAreaOverlay
