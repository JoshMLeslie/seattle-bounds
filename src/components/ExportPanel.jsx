import { toPng } from 'html-to-image'
import { useEffect, useState } from 'react'
import { exportVectorPdf } from '../utils/exportPdf'

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

const ASPECT_RATIOS = [
  { label: '17:22 (Letter)', width: 17, height: 22 },
  { label: '11:17 (Tabloid)', width: 11, height: 17 },
  { label: '3:4 (Portrait)', width: 3, height: 4 },
  { label: '4:3 (Landscape)', width: 4, height: 3 },
  { label: '2:3 (Large Poster)', width: 2, height: 3 },
  // Physical sizes export as vector PDF instead of PNG.
  { label: '36 × 54 in (3 ft, PDF)', width: 2, height: 3, widthIn: 36 },
  { label: '48 × 72 in (4 ft, PDF)', width: 2, height: 3, widthIn: 48 },
  { label: '1:1 (Square)', width: 1, height: 1 },
  { label: '16:9 (Widescreen)', width: 16, height: 9 },
]

const RESOLUTION_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
  { label: '4x', value: 4 },
]

function ExportPanel({ mapContainer, map, showPrintArea, setShowPrintArea, setPrintAspectRatio, printAreaElement }) {
  const [selectedRatio, setSelectedRatio] = useState(0)
  const [selectedResolution, setSelectedResolution] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [includeBasemap, setIncludeBasemap] = useState(false)

  // The aspect picker only applies with the print area on, so PDF mode does too.
  const pdfWidthIn = showPrintArea ? ASPECT_RATIOS[selectedRatio].widthIn : undefined

  const handleExportPdf = async () => {
    if (!map || !printAreaElement) return
    setExporting(true)
    try {
      const cropRect = printAreaElement.getBoundingClientRect()
      const { warning } = await exportVectorPdf({
        map, cropRect, widthIn: pdfWidthIn, bgColor, includeBasemap, onProgress: setProgress,
      })
      if (warning) alert(warning)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed. See console for details.')
    } finally {
      setExporting(false)
      setProgress('')
    }
  }

  // Update aspect ratio when selection changes
  useEffect(() => {
    const ratio = ASPECT_RATIOS[selectedRatio]
    if (ratio && setPrintAspectRatio) {
      setPrintAspectRatio(ratio.width / ratio.height)
    }
  }, [selectedRatio, setPrintAspectRatio])

  const handleExport = async () => {
    if (!mapContainer) return

    setExporting(true)

    try {
      // Leave out the print area overlay UI, and the basemap tiles unless asked for
      const filter = (node) => {
        if (node.classList?.contains('print-area-overlay')) return false
        if (node.classList?.contains('print-area-label')) return false
        if (node.classList?.contains('resize-handle')) return false
        if (!includeBasemap && node.classList?.contains('leaflet-tile')) return false
        return true
      }

      const ratio = ASPECT_RATIOS[selectedRatio]
      const pixelRatio = selectedResolution

      // Temporarily override Leaflet's background for capture
      const leafletContainer = mapContainer.querySelector('.leaflet-container')
      const originalBg = leafletContainer?.style.background
      if (leafletContainer) {
        leafletContainer.style.background = bgColor
      }

      // Always capture the full map container (has the actual content)
      const fullDataUrl = await toPng(mapContainer, {
        width: mapContainer.offsetWidth,
        height: mapContainer.offsetHeight,
        backgroundColor: bgColor,
        filter,
        skipFonts: true,
        pixelRatio,
      })

      // Restore original background
      if (leafletContainer) {
        leafletContainer.style.background = originalBg
      }

      let finalDataUrl = fullDataUrl

      // If print area is enabled, crop to the selection bounds
      if (showPrintArea && printAreaElement) {
        const mapRect = mapContainer.getBoundingClientRect()
        const printRect = printAreaElement.getBoundingClientRect()

        // Calculate crop region relative to map container, scaled by pixelRatio
        const cropX = (printRect.left - mapRect.left) * pixelRatio
        const cropY = (printRect.top - mapRect.top) * pixelRatio
        const cropWidth = printRect.width * pixelRatio
        const cropHeight = printRect.height * pixelRatio

        finalDataUrl = await cropImage(fullDataUrl, cropX, cropY, cropWidth, cropHeight)
      }

      // Download
      const link = document.createElement('a')
      const resLabel = RESOLUTION_OPTIONS.find(r => r.value === selectedResolution)?.label || '1x'
      link.download = `seattle-neighborhoods-${ratio.width}x${ratio.height}-${resLabel}.png`
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
        <label>Background Color</label>
        <input
          type="color"
          value={bgColor}
          onChange={e => setBgColor(e.target.value)}
        />
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={includeBasemap}
            onChange={e => setIncludeBasemap(e.target.checked)}
          />
          Include Basemap
        </label>
      </div>

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
        <label>Aspect Ratio</label>
        <select
          value={selectedRatio}
          onChange={e => setSelectedRatio(parseInt(e.target.value))}
					disabled={!showPrintArea}
        >
          {ASPECT_RATIOS.map((ratio, i) => (
            <option key={i} value={i}>
              {ratio.label}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>Resolution</label>
        <select
          value={selectedResolution}
          onChange={e => setSelectedResolution(parseInt(e.target.value))}
					disabled={!showPrintArea || !!pdfWidthIn}
        >
          {RESOLUTION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {pdfWidthIn && (
        <p className="export-note">
          Vector PDF: line widths and labels scale with the box, so a bigger box prints finer lines.
          {includeBasemap && ' The basemap is re-fetched at print detail, so it shows more streets than the screen.'}
        </p>
      )}

      <button
        className="export-button"
        onClick={pdfWidthIn ? handleExportPdf : handleExport}
        disabled={exporting || (!!pdfWidthIn && !map)}
      >
        {exporting ? (progress || 'Exporting...') : pdfWidthIn ? 'Export PDF' : 'Export PNG'}
      </button>
    </div>
  )
}

export default ExportPanel
