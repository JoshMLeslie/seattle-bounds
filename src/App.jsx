import { useState, useCallback } from 'react'
import Map from './components/Map'
import Controls from './components/Controls'
import ExportPanel from './components/ExportPanel'
import './App.css'

const DEFAULT_STYLES = {
  fillColor: '#3388ff',
  fillOpacity: 0.3,
  strokeColor: '#3388ff',
  strokeWidth: 2,
}

function App() {
  const [styles, setStyles] = useState(DEFAULT_STYLES)
  const [showLabels, setShowLabels] = useState(false)
  const [labelSize, setLabelSize] = useState(10)
  const [showSmallLabels, setShowSmallLabels] = useState(true)
  const [mapContainer, setMapContainer] = useState(null)
  const [showPrintArea, setShowPrintArea] = useState(false)
  const [printAspectRatio, setPrintAspectRatio] = useState(8.5 / 11) // default letter
  const [printAreaElement, setPrintAreaElement] = useState(null)

  const handleContainerRef = useCallback((el) => {
    setMapContainer(el)
  }, [])

  const handlePrintAreaRef = useCallback((el) => {
    setPrintAreaElement(el)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Seattle Neighborhoods</h1>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <Controls
            styles={styles}
            setStyles={setStyles}
            showLabels={showLabels}
            setShowLabels={setShowLabels}
            labelSize={labelSize}
            setLabelSize={setLabelSize}
            showSmallLabels={showSmallLabels}
            setShowSmallLabels={setShowSmallLabels}
          />
          <ExportPanel
            mapContainer={mapContainer}
            showPrintArea={showPrintArea}
            setShowPrintArea={setShowPrintArea}
            setPrintAspectRatio={setPrintAspectRatio}
            printAreaElement={printAreaElement}
          />
        </aside>

        <Map
          styles={styles}
          showLabels={showLabels}
          labelSize={labelSize}
          showSmallLabels={showSmallLabels}
          onContainerRef={handleContainerRef}
          showPrintArea={showPrintArea}
          printAspectRatio={printAspectRatio}
          onPrintAreaRef={handlePrintAreaRef}
        />
      </main>
    </div>
  )
}

export default App
