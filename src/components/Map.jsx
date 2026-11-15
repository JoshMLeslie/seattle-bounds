import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import PrintAreaOverlay from './PrintAreaOverlay'
import NeighborhoodLayer from './NeighborhoodLayer'
import { BASEMAP } from '../basemap'

const GEOJSON_URL = 'https://raw.githubusercontent.com/seattleio/seattle-boundaries-data/master/data/neighborhoods.geojson'

/** @type {[number, number]} Seattle center coordinates */
const SEATTLE_CENTER = [47.6062, -122.3321]

function Map({ styles, showLabels, labelSize, showSmallLabels, onContainerRef, showPrintArea, printAspectRatio, onPrintAreaRef }) {
  const printAreaRef = useRef(null)
  const [geojson, setGeojson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const containerRefCallback = useCallback((node) => {
    if (node && onContainerRef) {
      onContainerRef(node)
    }
  }, [onContainerRef])

  // Pass print area ref to parent
  useEffect(() => {
    if (onPrintAreaRef && printAreaRef.current) {
      onPrintAreaRef(printAreaRef.current)
    }
  }, [onPrintAreaRef, showPrintArea])

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch GeoJSON')
        return res.json()
      })
      .then(data => {
        setGeojson(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="map-loading">Loading neighborhoods...</div>
  if (error) return <div className="map-error">Error: {error}</div>

  return (
    <div ref={containerRefCallback} className="map-container">
      <MapContainer
        center={SEATTLE_CENTER}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomSnap={0.25}
        zoomDelta={0.25}
      >
        <TileLayer
          attribution={BASEMAP.attribution}
          url={BASEMAP.url}
          maxZoom={BASEMAP.maxZoom}
          crossOrigin="anonymous"
        />
        {geojson && (
          <NeighborhoodLayer
            geojson={geojson}
            styles={styles}
            showLabels={showLabels}
            labelSize={labelSize}
            showSmallLabels={showSmallLabels}
          />
        )}
      </MapContainer>
      {showPrintArea && (
        <PrintAreaOverlay
          aspectRatio={printAspectRatio}
          printAreaRef={printAreaRef}
        />
      )}
      <style>{`
        .neighborhood-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          font-size: ${labelSize}px !important;
          font-weight: 500;
          color: #333;
          text-shadow: 1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white;
          text-align: center;
        }
        .neighborhood-label.rotated {
          transform: rotate(-90deg);
        }
        .neighborhood-label.small-label {
          display: ${showSmallLabels ? 'block' : 'none'};
        }
      `}</style>
    </div>
  )
}

export default Map
