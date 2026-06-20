import { useState, useEffect, useCallback } from 'react'

export interface AISettings {
  enabled: boolean
  apiKey: string
  provider: 'deepseek' | 'openai'
  model: string
}

const LS_KEY = 'tm-ai-settings'

const DEFAULTS: AISettings = {
  enabled: false,
  apiKey: '',
  provider: 'deepseek',
  model: 'deepseek-chat',
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) return { ...DEFAULTS, ...JSON.parse(stored) }
    } catch { /* ignore corrupt data */ }
    return DEFAULTS
  })

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(settings))
  }, [settings])

  const update = useCallback((partial: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  const getBaseUrl = useCallback(() => {
    if (settings.provider === 'openai') return 'https://api.openai.com/v1'
    return 'https://api.deepseek.com/v1'
  }, [settings.provider])

  return { aiSettings: settings, updateAISettings: update, getAIBaseUrl: getBaseUrl }
}
