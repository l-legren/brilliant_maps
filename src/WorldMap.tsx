import { useEffect, useMemo, useRef, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'
import { createChoroplethScale } from './utils/colorScale'

type CountryProperties = { name: string }

const topology = world as unknown as Topology
const countries = feature(
  topology,
  topology.objects.countries as GeometryCollection<CountryProperties>,
).features.filter((country) => country.properties.name !== 'Antarctica')

// Mercator projects the poles to infinity, so we fit to the land itself
// rather than the full Sphere — this also crops the empty polar ocean.
const landExtent = { type: 'FeatureCollection', features: countries } as const

// A handful of disputed territories ship without a numeric id in this
// dataset, so fall back to their name to keep ids unique.
function countryId(country: { id?: string | number; properties: CountryProperties }) {
  return country.id !== undefined ? String(country.id) : country.properties.name
}

// Placeholder metric until a real per-country dataset (e.g. GDP) is wired in.
const placeholderData: Record<string, number> = Object.fromEntries(
  countries.map((country) => {
    const id = countryId(country)
    const seed = Number(country.id ?? 0)
    return [id, ((seed * 2654435761) % 1000) / 1000]
  }),
)

function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

export type WorldMapProps = {
  /** Country id (ISO numeric, as string) -> measured value, e.g. GDP. */
  data?: Record<string, number>
}

export function WorldMap({ data = placeholderData }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(
    null,
  )

  const { width, height } = useContainerSize(containerRef)
  const color = useMemo(() => createChoroplethScale(data), [data])

  // `fitSize` always shrinks to *contain* the map (letterboxing whenever the
  // container's aspect ratio doesn't match). We use the opposite as the base
  // fit: keep the map filling the container, cropping the overflowing edge
  // instead of shrinking the whole map — but we also compute the contain
  // scale as `minZoom`, so zooming out all the way still lets you see the
  // whole map (letterboxed) instead of stopping at the cropped view.
  const projectionInfo = useMemo(() => {
    if (!width || !height) return null
    const unitProjection = geoMercator().scale(1).translate([0, 0])
    const [[x0, y0], [x1, y1]] = geoPath(unitProjection).bounds(landExtent)
    const coverScale = Math.max(width / (x1 - x0), height / (y1 - y0))
    const containScale = Math.min(width / (x1 - x0), height / (y1 - y0))

    const projection = geoMercator()
      .scale(coverScale)
      .translate([
        width / 2 - (coverScale * (x0 + x1)) / 2,
        height / 2 - (coverScale * (y0 + y1)) / 2,
      ])

    // Mercator's x is directly proportional to longitude, so one full trip
    // around the globe is always exactly `scale * 2π` pixels wide — that's
    // the period we repeat world copies at, and the period we wrap panning
    // around for the infinite horizontal scroll.
    const worldWidth = coverScale * 2 * Math.PI
    const minZoom = containScale / coverScale
    // Sized for the most demanding case (fully zoomed out), so copies always
    // cover the container no matter the current zoom level.
    const copiesEachSide =
      Math.ceil(width / (worldWidth * minZoom) / 2) + 1

    return { path: geoPath(projection), worldWidth, minZoom, copiesEachSide }
  }, [width, height])

  const projectionInfoRef = useRef(projectionInfo)
  useEffect(() => {
    projectionInfoRef.current = projectionInfo
  }, [projectionInfo])

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return
    const svg = select(svgRef.current)
    const g = select(gRef.current)

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [-Infinity, 0],
        [Infinity, 0],
      ])
      .on('zoom', (event) => {
        const { x, y, k } = event.transform
        const worldWidth = projectionInfoRef.current?.worldWidth
        // Wrap the horizontal offset into a single period so panning loops
        // forever instead of hitting an edge; left/right world copies make
        // the wrap invisible.
        const period = worldWidth ? worldWidth * k : null
        const wrappedX = period ? ((x % period) + period) % period : x
        g.attr('transform', `translate(${wrappedX},${y}) scale(${k})`)
      })

    svg.call(zoomBehavior)
    zoomBehaviorRef.current = zoomBehavior

    return () => {
      svg.on('.zoom', null)
    }
  }, [])

  useEffect(() => {
    if (!zoomBehaviorRef.current || !projectionInfo) return
    zoomBehaviorRef.current
      .scaleExtent([projectionInfo.minZoom, 8])
      .translateExtent([
        [-Infinity, 0],
        [Infinity, height],
      ])
  }, [projectionInfo, height])

  function zoomBy(factor: number) {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    select(svgRef.current)
      .transition()
      .duration(200)
      .call(zoomBehaviorRef.current.scaleBy, factor)
  }

  function resetZoom() {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    select(svgRef.current)
      .transition()
      .duration(200)
      .call(zoomBehaviorRef.current.transform, zoomIdentity)
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-(--code-bg)"
    >
      <svg
        ref={svgRef}
        className="h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="World map"
      >
        <g ref={gRef}>
          {projectionInfo &&
            Array.from(
              { length: projectionInfo.copiesEachSide * 2 + 1 },
              (_, i) => i - projectionInfo.copiesEachSide,
            ).map((copy) => (
              <g
                key={copy}
                transform={`translate(${copy * projectionInfo.worldWidth},0)`}
              >
                {countries.map((country) => {
                  const id = countryId(country)
                  const value = data[id]
                  return (
                    <path
                      key={id}
                      className="stroke-(--bg) stroke-[0.5] hover:stroke-(--text-h) hover:stroke-1"
                      d={projectionInfo.path(country) ?? undefined}
                      fill={
                        value === undefined ? 'var(--border)' : color(value)
                      }
                    >
                      <title>{country.properties.name}</title>
                    </path>
                  )
                })}
              </g>
            ))}
        </g>
      </svg>

      <div className="absolute right-3 bottom-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomBy(1.4)}
          className="h-8 w-8 rounded border border-(--border) bg-(--bg) text-(--text-h) shadow-(--shadow) hover:bg-(--accent-bg)"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.4)}
          className="h-8 w-8 rounded border border-(--border) bg-(--bg) text-(--text-h) shadow-(--shadow) hover:bg-(--accent-bg)"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="h-8 w-8 rounded border border-(--border) bg-(--bg) text-xs text-(--text-h) shadow-(--shadow) hover:bg-(--accent-bg)"
          aria-label="Reset zoom"
        >
          ⟲
        </button>
      </div>
    </div>
  )
}
