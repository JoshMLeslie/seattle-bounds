// Esri World Light Gray: keyless and CORS-enabled (Access-Control-Allow-Origin: *), so its
// tiles can be drawn into PNG and PDF exports. Note Esri's {z}/{y}/{x} order.
export const BASEMAP = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS',
  maxZoom: 16,
  tileSize: 256,
}

export const basemapTileUrl = (x, y, z) =>
  BASEMAP.url.replace('{z}', z).replace('{y}', y).replace('{x}', x)
