/**
 * CONFIG.JS - Collier County Precinct Map Configuration
 *
 * All map settings in one place. Update these values to customize the map.
 */
const CONFIG = {
    mapbox: {
        accessToken: 'pk.eyJ1IjoicnlhbmRvbHBoanIiLCJhIjoiY21nenN1bGR1MDkwcWFtcHV3MTl6bWRodSJ9.VnbaNeUpr7ixd2knIEdEhg',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-81.58, 26.14],
        zoom: 9.2,
        minZoom: 8.5,
        maxZoom: 16,
        // Bounds: SW corner, NE corner — tight around precinct extents
        maxBounds: [[-82.0, 25.65], [-80.7, 26.7]]
    },
    data: {
        geojsonPath: 'data/precincts.geojson'
    },
    precinctColor: '#1a5276'
};
