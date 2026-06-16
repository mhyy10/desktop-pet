import { useState, useEffect } from 'react'
import { ChatEngine } from '../ai'

interface WeatherPanelProps {
  chatEngine: ChatEngine
  onClose: () => void
}

interface WeatherData {
  city: string
  temp: string
  desc: string
  humidity: string
  wind: string
  icon: string
}

const CITY_LIST = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆']

export function WeatherPanel({ chatEngine, onClose }: WeatherPanelProps) {
  const [city, setCity] = useState('北京')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchWeather()
  }, [])

  const fetchWeather = async (cityName?: string) => {
    const target = cityName ?? city
    setLoading(true)
    setError('')
    setWeather(null)

    try {
      // 使用 wttr.in 免费天气 API（无需 key）
      const resp = await fetch(`https://wttr.in/${encodeURIComponent(target)}?format=j1`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!resp.ok) throw new Error('API error')

      const data = await resp.json()
      const current = data.current_condition?.[0]
      const area = data.nearest_area?.[0]

      if (!current) throw new Error('no data')

      setWeather({
        city: area?.areaName?.[0]?.value ?? target,
        temp: `${current.temp_C}°C`,
        desc: current.lang_zh?.[0]?.value ?? current.weatherDesc?.[0]?.value ?? '未知',
        humidity: `${current.humidity}%`,
        wind: `${current.windspeedKmph} km/h`,
        icon: weatherIcon(current.weatherCode),
      })
    } catch {
      // fallback: 用 LLM 查天气
      try {
        const answer = await chatEngine.search(`${target}今天天气怎么样？请简要回答温度、天气状况、是否适合出门。`)
        setWeather({
          city: target,
          temp: '--',
          desc: answer,
          humidity: '--',
          wind: '--',
          icon: '🌤',
        })
      } catch {
        setError('获取天气失败，请稍后重试 🥺')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCityClick = (c: string) => {
    setCity(c)
    fetchWeather(c)
  }

  return (
    <>
      <div className="tool-panel-overlay" onClick={onClose} />
      <div className="tool-panel">
        <div className="tool-panel-header">
          <span className="tool-panel-title">🌤 天气</span>
          <button className="tool-panel-close" onClick={onClose}>✕</button>
        </div>

        {/* 城市选择 */}
        <div className="weather-cities">
          {CITY_LIST.map((c) => (
            <button
              key={c}
              className={`tool-panel-btn ${city === c ? 'primary' : ''}`}
              style={{ fontSize: 11, padding: '3px 7px' }}
              onClick={() => handleCityClick(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 天气结果 */}
        <div className="tool-panel-body" style={{ marginTop: 10 }}>
          {loading && (
            <div className="result-box loading">查询中… ✨</div>
          )}
          {error && (
            <div className="result-box" style={{ color: '#E17055' }}>{error}</div>
          )}
          {weather && !loading && (
            <div className="weather-card">
              <div className="weather-main">
                <span className="weather-icon">{weather.icon}</span>
                <span className="weather-temp">{weather.temp}</span>
              </div>
              <div className="weather-city">{weather.city}</div>
              <div className="weather-desc">{weather.desc}</div>
              {weather.humidity !== '--' && (
                <div className="weather-detail">
                  💧 {weather.humidity} &nbsp; 🌬 {weather.wind}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function weatherIcon(code: string): string {
  const n = parseInt(code, 10)
  if (n === 113) return '☀️'
  if (n === 116) return '⛅'
  if (n <= 122) return '☁️'
  if (n <= 200) return '🌧'
  if (n <= 232) return '⛈'
  if (n <= 330) return '❄️'
  if (n <= 395) return '🌨'
  return '🌤'
}
