function Controls({ styles, setStyles, showLabels, setShowLabels, labelSize, setLabelSize, showSmallLabels, setShowSmallLabels }) {
  const handleChange = (key, value) => {
    setStyles(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="controls">
      <h3>Style Controls</h3>

      <div className="style-grid">
        <div className="control-group">
          <label>Fill</label>
          <input
            type="color"
            value={styles.fillColor}
            onChange={e => handleChange('fillColor', e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>Stroke</label>
          <input
            type="color"
            value={styles.strokeColor}
            onChange={e => handleChange('strokeColor', e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>Opacity</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={styles.fillOpacity}
            onChange={e => handleChange('fillOpacity', parseFloat(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Width</label>
          <input
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            value={styles.strokeWidth}
            onChange={e => handleChange('strokeWidth', parseFloat(e.target.value))}
          />
        </div>
      </div>

      <hr />

      <div className="label-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={e => setShowLabels(e.target.checked)}
          />
          Show Labels
        </label>
        <div className="label-size">
          <label>Size</label>
          <input
            type="number"
            min="8"
            max="24"
            step="1"
            value={labelSize}
            onChange={e => setLabelSize(parseInt(e.target.value))}
            disabled={!showLabels}
          />
        </div>
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showSmallLabels}
            onChange={e => setShowSmallLabels(e.target.checked)}
            disabled={!showLabels}
          />
          Show Small Labels
        </label>
      </div>
    </div>
  )
}

export default Controls
