import { toPng } from 'html-to-image'
import { useState, useEffect } from 'react'

// Crop an image to a specific region using Canvas API
function cropImage(dataUrl, x, y, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

const PRESETS = [
  { name: '8.5x11"', width: 8.5, height: 11 },
  { name: '11x17"', width: 11, height: 17 },
  { name: '18x24"', width: 18, height: 24 },
  { name: '24x36"', width: 24, height: 36 },
]

const DPI_OPTIONS = [150, 300]

function ExportPanel({ mapContainer, showPrintArea, setShowPrintArea, setPrintAspectRatio, printAreaElement }) {
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [selectedDpi, setSelectedDpi] = useState(150)
  const [exporting, setExporting] = useState(false)
  const [bgColor, setBgColor] = useState('#ffffff')

  // Update aspect ratio when preset changes
  useEffect(() => {
    const preset = PRESETS[selectedPreset]
    if (preset && setPrintAspectRatio) {
      setPrintAspectRatio(preset.width / preset.height)
    }
  }, [selectedPreset, setPrintAspectRatio])

  const handleExport = async () => {
    if (!mapContainer) return

    setExporting(true)

    try {
      // Filter out external tile images (CORS issues) and print area overlay UI
      const filter = (node) => {
        if (node.classList?.contains('print-area-overlay')) return false
        if (node.classList?.contains('print-area-label')) return false
        if (node.classList?.contains('resize-handle')) return false
        if (node.tagName === 'IMG') {
          const src = node.getAttribute('src') || ''
          if (src.includes('basemaps.cartocdn.com') || src.includes('tile')) {
            return false
          }
        }
        return true
      }

      const preset = PRESETS[selectedPreset]

      // Always capture the full map container (has the actual content)
      const fullDataUrl = await toPng(mapContainer, {
        width: mapContainer.offsetWidth,
        height: mapContainer.offsetHeight,
        backgroundColor: bgColor,
        filter,
        skipFonts: true,
      })

      let finalDataUrl = fullDataUrl

      // If print area is enabled, crop to the selection bounds
      if (showPrintArea && printAreaElement) {
        const mapRect = mapContainer.getBoundingClientRect()
        const printRect = printAreaElement.getBoundingClientRect()

        // Calculate crop region relative to map container
        const cropX = printRect.left - mapRect.left
        const cropY = printRect.top - mapRect.top
        const cropWidth = printRect.width
        const cropHeight = printRect.height

        finalDataUrl = await cropImage(fullDataUrl, cropX, cropY, cropWidth, cropHeight)
      }

      // Download
      const link = document.createElement('a')
      link.download = `seattle-neighborhoods-${preset.name.replace(/"/g, '')}-${selectedDpi}dpi.png`
      link.href = finalDataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. See console for details.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="export-panel">
      <h3>Export</h3>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={showPrintArea}
            onChange={e => setShowPrintArea(e.target.checked)}
          />
          Show Print Area Selector
        </label>
        <p className="export-hint">
          {showPrintArea
            ? 'Drag the box to select area. Drag corner to resize.'
            : 'Enable to select a specific area to export.'}
        </p>
      </div>

      <div className="control-group">
        <label>Background Color</label>
        <input
          type="color"
          value={bgColor}
          onChange={e => setBgColor(e.target.value)}
        />
      </div>

      <div className="control-group">
        <label>Paper Size</label>
        <select
          value={selectedPreset}
          onChange={e => setSelectedPreset(parseInt(e.target.value))}
        >
          {PRESETS.map((preset, i) => (
            <option key={i} value={i}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>DPI</label>
        <select
          value={selectedDpi}
          onChange={e => setSelectedDpi(parseInt(e.target.value))}
        >
          {DPI_OPTIONS.map(dpi => (
            <option key={dpi} value={dpi}>
              {dpi} DPI
            </option>
          ))}
        </select>
      </div>

      <p className="export-note">
        Note: Base map tiles cannot be exported (CORS). Only boundaries on background.
      </p>

      <button
        className="export-button"
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? 'Exporting...' : 'Export PNG'}
      </button>
    </div>
  )
}

export default ExportPanel
