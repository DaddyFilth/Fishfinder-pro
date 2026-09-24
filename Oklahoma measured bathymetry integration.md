# Oklahoma measured bathymetry integration

Fishfinder now loads measured lake depth contours from the official [Oklahoma Water Resources Board bathymetric mapping program](https://oklahoma.gov/owrb/data-and-maps/bathymetric-mapping.html). OWRB describes the program as using GPS and acoustic depth-sounding instruments to produce lake-bottom surface models and contour maps.

## Source dataset

The application uses the OWRB [Lakes of Oklahoma ArcGIS REST service](https://owrb-dev.csa.ou.edu/server/rest/services/Surface_Water/LOK_Lakes/MapServer), specifically its `Contours` feature layer (`/MapServer/2`). The service identifies itself as an OWRB map service for the Lakes of Oklahoma atlas and supports GeoJSON queries.

Each contour feature includes:

| Field | Meaning |
|---|---|
| `lake` | OWRB lake name |
| `depth` | Contour depth in feet; the source encodes depths as negative values, so the UI displays the absolute value as depth below the surface |
| `elevation` | Contour elevation in feet |
| `source` | Survey/data source, currently OWRB for the integrated layer |
| `year` | Survey year when provided |

The service reports a maximum record count of 2,000 and supports spatial queries, GeoJSON, and output in WGS 84 coordinates. The app requests only the current map viewport through a server-side proxy rather than copying the entire statewide dataset into the repository.

## Application behavior

The public route `/api/bathymetry` validates a WGS 84 bounding box, queries the OWRB contour layer, caches the response for one hour, and returns GeoJSON. The map requests a new viewport-bounded set of contours when the user pans or zooms while **Measured depth contours** is enabled.

Contour styling is independent of water temperature. The map uses a light-to-dark blue ramp: light blue represents shallower contours and dark blue represents deeper contours. Hovering a contour displays the lake name, depth in feet, and survey year when available. Water temperature continues to use its separate cold-to-warm palette.

## Verification

A live production smoke test of the proxy over the Oklahoma City area returned 57 contour features with depths from 0 to 90 feet, including Arcadia contours at 5- and 10-foot intervals. TypeScript, ESLint, all 157 tests, the production build, and `git diff --check` passed after integration.

## Important interpretation note

These are survey-derived contour lines, not a real-time sonar surface. Survey year and lake-level conditions matter when interpreting them. The displayed depth is the source contour depth and should be treated as planning information rather than a navigation guarantee; users should follow current lake, boating, and access advisories.
