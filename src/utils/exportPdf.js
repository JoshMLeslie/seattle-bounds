// Vector PDF export for large-format printing.
//
// Redraws the neighborhood polygons from their raw GeoJSON coordinates (not Leaflet's
// screen-simplified SVG) and the labels from their on-screen tooltips, scaled from the
// crop box to a physical page width. What's in the box is what prints, at any size.
// The optional basemap is re-fetched at a higher tile zoom so it isn't a blown-up screenshot.

import { BASEMAP, basemapTileUrl } from '../basemap'

const PT_PER_IN = 72
// Drop vertices closer than this to the previous one. 0.25pt is ~0.1mm: invisible, but it
// keeps the file from carrying sub-meter survey detail across a 6-foot page.
const MIN_STEP_PT = 0.25
// Rough vertical center of a Helvetica line, as a fraction of font size above the baseline.
const BASELINE_SHIFT = 0.35
// Leaflet's 1px four-way text-shadow halo, as a stroke width in CSS px.
const HALO_PX = 2.5
// Basemap raster density on paper. It's a soft gray background; 100 DPI keeps a 4x6 ft
// page around a thousand tile fetches.
const BASEMAP_DPI = 100
const TILE_CONCURRENCY = 12

function rings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

function thin(points) {
  const out = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]
    const [px, py] = out[out.length - 1]
    if (Math.abs(x - px) >= MIN_STEP_PT || Math.abs(y - py) >= MIN_STEP_PT) out.push(points[i])
  }
  return out
}

function rgb(css) {
  const m = css.match(/rgba?\(([^)]+)\)/)
  return m ? m[1].split(/[\s,/]+/).slice(0, 3).map(Number) : [0, 0, 0]
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Stitches basemap tiles for the crop into one canvas at BASEMAP_DPI; returns JPEG bytes. */
async function renderBasemap(map, cropPx, page, onProgress) {
  const screenZoom = map.getZoom()
  const pxW = Math.round((page.w / PT_PER_IN) * BASEMAP_DPI)
  const pxH = Math.round((page.h / PT_PER_IN) * BASEMAP_DPI)
  const z = Math.max(0, Math.min(BASEMAP.maxZoom, Math.round(screenZoom + Math.log2(pxW / cropPx.w))))

  const nw = map.project(map.containerPointToLatLng([cropPx.x, cropPx.y]), z)
  const se = map.project(map.containerPointToLatLng([cropPx.x + cropPx.w, cropPx.y + cropPx.h]), z)
  const sx = pxW / (se.x - nw.x)
  const sy = pxH / (se.y - nw.y)

  const canvas = document.createElement('canvas')
  canvas.width = pxW
  canvas.height = pxH
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  const T = BASEMAP.tileSize
  const queue = []
  for (let ty = Math.floor(nw.y / T); ty <= Math.floor(se.y / T); ty++) {
    for (let tx = Math.floor(nw.x / T); tx <= Math.floor(se.x / T); tx++) queue.push([tx, ty])
  }
  const total = queue.length
  let done = 0
  let failed = 0

  const worker = async () => {
    while (queue.length) {
      const [tx, ty] = queue.pop()
      const img = await loadImage(basemapTileUrl(tx, ty, z))
      if (img) {
        // Snap tile edges to whole pixels so neighbors abut with no hairline seams.
        const x0 = Math.round((tx * T - nw.x) * sx)
        const y0 = Math.round((ty * T - nw.y) * sy)
        const x1 = Math.round(((tx + 1) * T - nw.x) * sx)
        const y1 = Math.round(((ty + 1) * T - nw.y) * sy)
        ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0)
      } else {
        failed++
      }
      onProgress?.(`Basemap ${++done}/${total}`)
    }
  }
  await Promise.all(Array.from({ length: TILE_CONCURRENCY }, worker))

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  return { bytes: new Uint8Array(await blob.arrayBuffer()), failed, total }
}

function drawFeature(doc, layer, toPage, scale, page, gState) {
  const pageRings = rings(layer.feature.geometry).map((ring) => thin(ring.map(toPage)))

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of pageRings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0 || maxY < 0 || minX > page.w || minY > page.h) return

  const { stroke = true, color, weight, opacity = 1, fill = true, fillColor, fillOpacity = 0.2 } = layer.options
  const doStroke = stroke && weight > 0
  const doFill = fill && fillOpacity > 0
  if (!doStroke && !doFill) return

  for (const ring of pageRings) {
    if (ring.length < 3) continue
    doc.moveTo(ring[0][0], ring[0][1])
    for (let i = 1; i < ring.length; i++) doc.lineTo(ring[i][0], ring[i][1])
    doc.close()
  }

  doc.setGState(gState(doFill ? fillOpacity : 1, opacity))
  if (doFill) doc.setFillColor(fillColor || color)
  if (doStroke) {
    doc.setDrawColor(color)
    doc.setLineWidth(weight * scale)
  }
  if (doFill && doStroke) doc.fillStrokeEvenOdd()
  else if (doFill) doc.fillEvenOdd()
  else doc.stroke()
}

function drawLabel(doc, layer, crop, scale, page) {
  const el = layer.getTooltip?.()?.getElement?.()
  if (!el) return
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return

  const cx = (r.left + r.width / 2 - crop.left) * scale
  const cy = (r.top + r.height / 2 - crop.top) * scale
  if (cx < 0 || cy < 0 || cx > page.w || cy > page.h) return

  const lines = el.innerText.split('\n').map((s) => s.trim()).filter(Boolean)
  if (!lines.length) return

  const fontPx = parseFloat(cs.fontSize)
  const fs = fontPx * scale
  const lh = (parseFloat(cs.lineHeight) || fontPx * 1.2) * scale // 'normal' parses to NaN

  // CSS rotation is clockwise-positive; jsPDF's angle is counterclockwise.
  const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform)
  const angle = (-Math.atan2(m.b, m.a) * 180) / Math.PI
  const rad = (angle * Math.PI) / 180
  const dir = [Math.cos(rad), -Math.sin(rad)] // along the text, in y-down page space
  const down = [Math.sin(rad), Math.cos(rad)] // toward the next line

  const halo = cs.textShadow && cs.textShadow !== 'none'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fs)
  doc.setTextColor(...rgb(cs.color))
  doc.setDrawColor('#ffffff')
  doc.setLineWidth(HALO_PX * scale)

  lines.forEach((line, i) => {
    const w = doc.getTextWidth(line)
    const off = (i - (lines.length - 1) / 2) * lh + BASELINE_SHIFT * fs
    const x = cx - (dir[0] * w) / 2 + down[0] * off
    const y = cy - (dir[1] * w) / 2 + down[1] * off
    if (halo) doc.text(line, x, y, { angle, renderingMode: 'stroke' })
    doc.text(line, x, y, { angle, renderingMode: 'fill' })
  })
}

/**
 * @param {object} o
 * @param {import('leaflet').Map} o.map
 * @param {DOMRect | null} o.cropRect  screen rect to export; null = the whole map view
 * @param {number} o.widthIn  page width in inches; height follows the crop's aspect ratio
 * @param {string} o.bgColor
 * @param {boolean} [o.includeBasemap]
 * @param {(msg: string) => void} [o.onProgress]
 * @returns {Promise<{ doc: import('jspdf').jsPDF, filename: string, warning?: string }>}
 */
export async function buildVectorPdf({ map, cropRect, widthIn, bgColor, includeBasemap, onProgress }) {
  const { jsPDF } = await import('jspdf')

  const containerRect = map.getContainer().getBoundingClientRect()
  const crop = cropRect ?? containerRect
  const scale = (widthIn * PT_PER_IN) / crop.width
  const page = { w: crop.width * scale, h: crop.height * scale }
  const cropPx = { x: crop.left - containerRect.left, y: crop.top - containerRect.top, w: crop.width, h: crop.height }

  // Not latLngToContainerPoint: Leaflet rounds that to whole screen pixels, which the page
  // scale then blows up into a visible stair-step grid. Same math, minus the rounding.
  const zoom = map.getZoom()
  const origin = map.getPixelOrigin().add(map.containerPointToLayerPoint([0, 0]))
  const toPage = ([lng, lat]) => {
    const p = map.project([lat, lng], zoom)
    return [(p.x - origin.x - cropPx.x) * scale, (p.y - origin.y - cropPx.y) * scale]
  }

  const doc = new jsPDF({
    unit: 'pt',
    format: [page.w, page.h],
    orientation: page.w > page.h ? 'landscape' : 'portrait',
    compress: true,
  })

  const gStates = new Map()
  const gState = (fillAlpha, strokeAlpha) => {
    const key = `${fillAlpha}/${strokeAlpha}`
    if (!gStates.has(key)) gStates.set(key, new doc.GState({ opacity: fillAlpha, 'stroke-opacity': strokeAlpha }))
    return gStates.get(key)
  }

  doc.setFillColor(bgColor)
  doc.rect(0, 0, page.w, page.h, 'F')

  let warning
  if (includeBasemap) {
    const { bytes, failed, total } = await renderBasemap(map, cropPx, page, onProgress)
    doc.addImage(bytes, 'JPEG', 0, 0, page.w, page.h)
    if (failed) warning = `${failed} of ${total} basemap tiles failed to load and are blank.`
  }

  onProgress?.('Drawing boundaries')
  doc.setLineJoin('round')
  doc.setLineCap('round')

  const layers = []
  map.eachLayer((layer) => {
    if (layer.feature?.geometry) layers.push(layer)
  })

  for (const layer of layers) drawFeature(doc, layer, toPage, scale, page, gState)

  doc.setGState(gState(1, 1))
  for (const layer of layers) drawLabel(doc, layer, crop, scale, page)

  const heightIn = +(page.h / PT_PER_IN).toFixed(1)
  return { doc, filename: `seattle-neighborhoods-${widthIn}x${heightIn}in.pdf`, warning }
}

export async function exportVectorPdf(opts) {
  const { doc, filename, warning } = await buildVectorPdf(opts)
  doc.save(filename)
  return { warning }
}
