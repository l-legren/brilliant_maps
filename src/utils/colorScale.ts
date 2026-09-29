import { extent } from 'd3-array'
import { scaleSequential } from 'd3-scale'
import { interpolateRdYlGn } from 'd3-scale-chromatic'

/**
 * Builds a choropleth color scale calibrated to a dataset's own min/max,
 * so the scale always spans richest (green) to poorest (red) regardless
 * of the metric (GDP, life expectancy, etc).
 */
export function createChoroplethScale(
  data: Record<string, number>,
  interpolator: (t: number) => string = interpolateRdYlGn,
) {
  const [min, max] = extent(Object.values(data))
  return scaleSequential(interpolator).domain([min ?? 0, max ?? 1])
}
