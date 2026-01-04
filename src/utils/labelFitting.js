/**
 * Calculate optimal label fit for a polygon boundary
 */

const AVG_CH_WIDTH_RATIO = 0.75;
const LINE_HEIGHT_RATIO = 1.4;

/**
 * Get bounding box from GeoJSON geometry coordinates
 */
function getBbox(geometry) {
	let minLat = Infinity,
		maxLat = -Infinity;
	let minLng = Infinity,
		maxLng = -Infinity;

	const processCoords = (coords) => {
		if (typeof coords[0] === 'number') {
			// [lng, lat] point
			minLng = Math.min(minLng, coords[0]);
			maxLng = Math.max(maxLng, coords[0]);
			minLat = Math.min(minLat, coords[1]);
			maxLat = Math.max(maxLat, coords[1]);
		} else {
			coords.forEach(processCoords);
		}
	};

	processCoords(geometry.coordinates);
	return {minLat, maxLat, minLng, maxLng};
}

/**
 * Estimate text dimensions based on font size
 */
function estimateTextSize(text, fontSize) {
	const avgCharWidth = fontSize * AVG_CH_WIDTH_RATIO;
	const lineHeight = fontSize * LINE_HEIGHT_RATIO;
	return {
		width: text.length * avgCharWidth,
		height: lineHeight,
	};
}

/**
 * Estimate stacked text dimensions (split on whitespace)
 */
function estimateStackedSize(text, fontSize) {
	const words = text.split(/\s+/);
	const avgCharWidth = fontSize * AVG_CH_WIDTH_RATIO;
	const lineHeight = fontSize * LINE_HEIGHT_RATIO;
	const maxWordLength = Math.max(...words.map((w) => w.length));
	return {
		width: maxWordLength * avgCharWidth,
		height: words.length * lineHeight,
	};
}

/**
 * Check if dimensions fit within bounds with padding
 * Default padding of 0.7 leaves ~15% margin on each side
 */
function fits(textWidth, textHeight, boundsWidth, boundsHeight, padding = 0.7) {
	return (
		textWidth < boundsWidth * padding && textHeight < boundsHeight * padding
	);
}

/**
 * Calculate optimal label configuration for a polygon
 * @param {object} geometry - GeoJSON geometry
 * @param {string} text - Label text
 * @param {number} fontSize - Font size in pixels
 * @param {object} map - Leaflet map instance
 * @returns {{ rotate: boolean, stack: boolean, isSmall: boolean }}
 */
export function fitLabel(geometry, text, fontSize, map) {
	if (!geometry || !text || !map) {
		return {rotate: false, stack: false, isSmall: false};
	}

	// Get polygon bbox in lat/lng
	const bbox = getBbox(geometry);

	// Convert to screen pixels
	const topLeft = map.latLngToContainerPoint([bbox.maxLat, bbox.minLng]);
	const bottomRight = map.latLngToContainerPoint([bbox.minLat, bbox.maxLng]);

	const boundsWidth = Math.abs(bottomRight.x - topLeft.x);
	const boundsHeight = Math.abs(bottomRight.y - topLeft.y);

	// Estimate text sizes
	const horizontal = estimateTextSize(text, fontSize);
	const stacked = estimateStackedSize(text, fontSize);

	// Try fits in priority order
	// 1. Horizontal
	if (fits(horizontal.width, horizontal.height, boundsWidth, boundsHeight)) {
		return {rotate: false, stack: false, isSmall: false};
	}

	// 2. Rotated (swap width/height for bounds check)
	if (fits(horizontal.width, horizontal.height, boundsHeight, boundsWidth)) {
		return {rotate: true, stack: false, isSmall: false};
	}

	// 3. Stacked (only if multiple words)
	if (text.includes(' ')) {
		if (fits(stacked.width, stacked.height, boundsWidth, boundsHeight)) {
			return {rotate: false, stack: true, isSmall: false};
		}

		// 4. Stacked + Rotated
		if (fits(stacked.width, stacked.height, boundsHeight, boundsWidth)) {
			return {rotate: true, stack: true, isSmall: false};
		}
	}

	// Doesn't fit well - mark as small
	// Still try to pick the best option
	const horizontalOverflow = Math.max(
		horizontal.width / boundsWidth,
		horizontal.height / boundsHeight
	);
	const rotatedOverflow = Math.max(
		horizontal.width / boundsHeight,
		horizontal.height / boundsWidth
	);

	if (text.includes(' ')) {
		const stackedOverflow = Math.max(
			stacked.width / boundsWidth,
			stacked.height / boundsHeight
		);
		const stackedRotatedOverflow = Math.max(
			stacked.width / boundsHeight,
			stacked.height / boundsWidth
		);

		const minOverflow = Math.min(
			horizontalOverflow,
			rotatedOverflow,
			stackedOverflow,
			stackedRotatedOverflow
		);

		if (minOverflow === stackedRotatedOverflow) {
			return {rotate: true, stack: true, isSmall: true};
		}
		if (minOverflow === stackedOverflow) {
			return {rotate: false, stack: true, isSmall: true};
		}
	}

	if (rotatedOverflow < horizontalOverflow) {
		return {rotate: true, stack: false, isSmall: true};
	}

	return {rotate: false, stack: false, isSmall: true};
}
