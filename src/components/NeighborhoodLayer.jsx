import { useState } from 'react'
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { fitLabel } from '../utils/labelFitting'

function NeighborhoodLayer({ geojson, styles, showLabels, labelSize, showSmallLabels }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())

  // Listen for zoom changes to refit labels
  useMapEvents({
    zoomend: () => setZoom(map.getZoom())
  })

  const styleFeature = () => ({
    fillColor: styles.fillColor,
    fillOpacity: styles.fillOpacity,
    color: styles.strokeColor,
    weight: styles.strokeWidth,
  })

  const onEachFeature = (feature, layer) => {
    if (showLabels && feature.properties?.name) {
      const name = feature.properties.name
      const config = fitLabel(feature.geometry, name, labelSize, map)

      // Build display text
      let displayText = name
      if (config.stack) {
        displayText = name.split(/\s+/).join('<br>')
      }

      // Build class names
      const classes = ['neighborhood-label']
      if (config.rotate) classes.push('rotated')
      if (config.isSmall) classes.push('small-label')

      layer.bindTooltip(displayText, {
        permanent: true,
        direction: 'center',
        className: classes.join(' '),
      })
    }
  }

  return (
    <GeoJSON
      key={`${styles.fillColor}-${styles.strokeColor}-${styles.fillOpacity}-${styles.strokeWidth}-${showLabels}-${labelSize}-${showSmallLabels}-${zoom}`}
      data={geojson}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  )
}

export default NeighborhoodLayer
