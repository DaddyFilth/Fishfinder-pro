import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchMarineConditions,
  fetchNwsWeather,
  fetchPressureTrend,
  fetchTideData,
  fetchUSGSWaterData,
} from './environmental'

describe('environmental fetchers (native fetch)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('fetches and converts NWS point + forecast weather using native fetch', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            properties: { forecast: 'https://api.weather.gov/gridpoints/OUN/95,95/forecast' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            properties: {
              periods: [
                {
                  temperature: 68,
                  temperatureUnit: 'F',
                  windSpeed: '10 mph',
                  windDirection: 'SSE',
                  shortForecast: 'Partly Cloudy',
                  isDaytime: true,
                  name: 'This Afternoon',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    const result = await fetchNwsWeather(35.5731, -97.6081)
    expect(result).toEqual({
      source: 'NOAA NWS',
      air_temp_c: 20,
      wind_speed_ms: 4.5,
      wind_direction: 'SSE',
      short_forecast: 'Partly Cloudy',
      is_daytime: true,
      period_name: 'This Afternoon',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe('error')
  })

  it('blocks SSRF when an NWS point response points outside api.weather.gov', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          properties: { forecast: 'https://evil.example.com/forecast' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await fetchNwsWeather(35.5731, -97.6081)
    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null cleanly on HTTP 404 or timeout errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }))
    expect(await fetchNwsWeather(35.57, -97.6)).toBeNull()

    const timeoutErr = new Error('The operation was aborted due to timeout')
    timeoutErr.name = 'TimeoutError'
    fetchMock.mockRejectedValueOnce(timeoutErr)
    expect(await fetchNwsWeather(35.57, -97.6)).toBeNull()
  })

  it('parses USGS, marine, pressure, and tide responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          value: {
            timeSeries: [
              {
                variable: { variableCode: [{ value: '00060' }] },
                values: [{ value: [{ value: '420.5' }] }],
              },
              {
                variable: { variableCode: [{ value: '00065' }] },
                values: [{ value: [{ value: '12.3' }] }],
              },
            ],
          },
        }),
        { status: 200 },
      ),
    )
    expect(await fetchUSGSWaterData('07159100')).toEqual({
      source: 'USGS Water Data',
      site_id: '07159100',
      flow_rate_cfs: 420.5,
      water_level_ft: 12.3,
    })

    const hours = Array.from({ length: 24 }, () => 0.4)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          hourly: {
            wave_height: hours,
            wave_period: hours,
            wave_direction: hours,
            sea_surface_temperature: hours,
            swell_wave_height: hours,
          },
        }),
        { status: 200 },
      ),
    )
    const marine = await fetchMarineConditions(29.3, -94.8)
    expect(marine?.wave_height_m).toBe(0.4)

    const nowIso = new Date().toISOString()
    const threeHoursAgoIso = new Date(Date.now() - 3 * 3600_000).toISOString()
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          current: { surface_pressure: 1018 },
          hourly: {
            time: [threeHoursAgoIso, threeHoursAgoIso, threeHoursAgoIso, nowIso],
            surface_pressure: [1015, 1016, 1017, 1018],
          },
        }),
        { status: 200 },
      ),
    )
    expect(await fetchPressureTrend(35.5, -97.6)).toEqual({
      currentPressure: 1018,
      referencePressure: 1015,
      trend: 'rising',
    })

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ t: '2026-10-30 12:00', v: '0.62' }],
        }),
        { status: 200 },
      ),
    )
    expect(await fetchTideData('8771450')).toEqual({
      source: 'NOAA Tides',
      station_id: '8771450',
      tide_height_m: 0.62,
      observation_time: '2026-10-30 12:00',
    })
  })
})
