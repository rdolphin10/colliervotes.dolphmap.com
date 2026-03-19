/**
 * PRECINCT-MAP.JS - Map Initialization + Dolph Base Styling
 *
 * Initializes the Mapbox map and applies the Dolph Map Company
 * custom color scheme to the base map tiles.
 *
 * Adapted from InteractiveMapProject/core/js/dolph-style.js
 */

/**
 * Dolph Map Company Color Palette
 */
const DOLPH_COLORS = {
    // Text/Labels
    cityTitles: '#ed1c24',
    roadTitles: '#000000',
    waterwayTitles: '#0072bc',

    // Water Features
    ocean: '#add3f0',
    mainWaterways: '#78b6e4',

    // Roads
    interstates: '#cd292c',
    highways: '#cd292c',
    mainRoads: '#cd292c',
    otherRoads: '#d3d3d3',

    // Background/Land
    background: '#fffef0',
    backgroundAlt: '#ffffff',

    // Land Use
    golfCourses: '#b3ddc0',
    parks: '#b3ddc0',
    airports: '#b3ddc0',

    // Cities/Places
    city1: '#fffcd5',
    city2: '#ffffff',
    city3: '#4f4f4f',

    // Boundaries
    zipCodes: '#5da9dd',
    countyLines: '#4a4a4a'
};

/**
 * Apply Dolph Map Company styling to the base map
 * @param {mapboxgl.Map} map - The Mapbox map instance
 */
function applyDolphStyle(map) {
    if (!map.isStyleLoaded()) {
        map.once('style.load', function() {
            applyDolphStyle(map);
        });
        return;
    }

    try {
        const layers = map.getStyle().layers;

        // Water
        if (map.getLayer('water')) {
            map.setPaintProperty('water', 'fill-color', DOLPH_COLORS.ocean);
        }
        if (map.getLayer('waterway')) {
            map.setPaintProperty('waterway', 'line-color', DOLPH_COLORS.mainWaterways);
        }
        if (map.getLayer('waterway-label')) {
            map.setPaintProperty('waterway-label', 'text-color', DOLPH_COLORS.waterwayTitles);
            map.setLayoutProperty('waterway-label', 'text-transform', 'uppercase');
        }

        // Background / Land
        layers.forEach(function(layer) {
            if (layer.id.includes('background') || layer.id === 'land') {
                try {
                    if (layer.type === 'background') {
                        map.setPaintProperty(layer.id, 'background-color', DOLPH_COLORS.background);
                    } else if (layer.type === 'fill') {
                        map.setPaintProperty(layer.id, 'fill-color', DOLPH_COLORS.background);
                    }
                } catch (e) { /* skip */ }
            }
        });

        // Roads
        layers.forEach(function(layer) {
            if (layer.type !== 'line') return;
            if (!layer.id.includes('road') &&
                !layer.id.includes('motorway') &&
                !layer.id.includes('trunk') &&
                !layer.id.includes('primary') &&
                !layer.id.includes('secondary') &&
                !layer.id.includes('tertiary') &&
                !layer.id.includes('street')) return;

            try {
                if (layer.id.includes('motorway') || layer.id.includes('trunk')) {
                    map.setPaintProperty(layer.id, 'line-color', DOLPH_COLORS.interstates);
                } else if (layer.id.includes('primary')) {
                    map.setPaintProperty(layer.id, 'line-color', DOLPH_COLORS.mainRoads);
                } else if (layer.id.includes('secondary') ||
                           layer.id.includes('tertiary') ||
                           layer.id.includes('street')) {
                    map.setPaintProperty(layer.id, 'line-color', DOLPH_COLORS.otherRoads);
                }

                const currentWidth = map.getPaintProperty(layer.id, 'line-width');
                if (typeof currentWidth === 'number' && currentWidth > 0) {
                    map.setPaintProperty(layer.id, 'line-width', currentWidth * 0.8);
                }
            } catch (e) { /* skip */ }
        });

        // Road labels
        layers.forEach(function(layer) {
            if (layer.id.includes('road') && layer.id.includes('label') && layer.type === 'symbol') {
                try {
                    map.setPaintProperty(layer.id, 'text-color', DOLPH_COLORS.roadTitles);
                    map.setLayoutProperty(layer.id, 'text-transform', 'uppercase');
                } catch (e) { /* skip */ }
            }
        });

        // Parks, golf courses, airports
        layers.forEach(function(layer) {
            if (layer.type !== 'fill') return;
            try {
                if (layer.id.includes('park') || layer.id.includes('pitch')) {
                    map.setPaintProperty(layer.id, 'fill-color', DOLPH_COLORS.parks);
                }
                if (layer.id.includes('golf')) {
                    map.setPaintProperty(layer.id, 'fill-color', DOLPH_COLORS.golfCourses);
                }
                if (layer.id.includes('airport') || layer.id.includes('aeroway')) {
                    map.setPaintProperty(layer.id, 'fill-color', DOLPH_COLORS.airports);
                }
            } catch (e) { /* skip */ }
        });

        // Place labels — cities, towns
        layers.forEach(function(layer) {
            if (layer.type !== 'symbol') return;
            if (layer.id.includes('place') ||
                layer.id.includes('settlement') ||
                layer.id.includes('city') ||
                layer.id.includes('town') ||
                layer.id.includes('village')) {
                try {
                    map.setPaintProperty(layer.id, 'text-color', DOLPH_COLORS.cityTitles);
                    map.setLayoutProperty(layer.id, 'text-transform', 'uppercase');
                    map.setLayoutProperty(layer.id, 'text-font', ['DIN Pro Bold', 'Arial Unicode MS Bold']);
                } catch (e) { /* skip */ }
            }
        });

        // Boundaries
        layers.forEach(function(layer) {
            if (layer.type !== 'line') return;
            if (layer.id.includes('admin') && layer.id.includes('2')) {
                try {
                    map.setPaintProperty(layer.id, 'line-color', DOLPH_COLORS.countyLines);
                } catch (e) { /* skip */ }
            }
        });

        // All other labels — uppercase
        layers.forEach(function(layer) {
            if (layer.type !== 'symbol') return;
            if (layer.id.includes('place') ||
                layer.id.includes('settlement') ||
                layer.id.includes('city') ||
                layer.id.includes('town') ||
                layer.id.includes('village') ||
                layer.id.includes('road') ||
                layer.id.includes('waterway')) return;
            try {
                map.setLayoutProperty(layer.id, 'text-transform', 'uppercase');
            } catch (e) { /* skip */ }
        });

        // Hide commercial POI labels
        if (map.getLayer('poi-label')) {
            map.setFilter('poi-label', [
                '!in', 'class',
                'commercial_services',
                'food_and_drink',
                'food_and_drink_stores',
                'lodging',
                'store_like'
            ]);
        }

    } catch (error) {
        console.error('Error applying Dolph styling:', error);
    }
}

/**
 * Initialize the map
 */
let map;

document.addEventListener('DOMContentLoaded', function() {
    if (typeof mapboxgl === 'undefined') {
        console.error('Mapbox GL JS not loaded');
        return;
    }

    mapboxgl.accessToken = CONFIG.mapbox.accessToken;

    map = new mapboxgl.Map({
        container: 'map',
        style: CONFIG.mapbox.style,
        center: CONFIG.mapbox.center,
        zoom: CONFIG.mapbox.zoom,
        minZoom: CONFIG.mapbox.minZoom,
        maxZoom: CONFIG.mapbox.maxZoom,
        maxBounds: CONFIG.mapbox.maxBounds
    });

    // Controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

    map.on('load', function() {
        applyDolphStyle(map);
        document.dispatchEvent(new CustomEvent('mapReady', { detail: { map: map } }));
    });
});

/**
 * Get the map instance (for use by other modules)
 */
function getMap() {
    return map;
}
