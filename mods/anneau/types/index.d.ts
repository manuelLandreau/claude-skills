export type Tone = 'ok' | 'warn' | 'crit'

export type Attention = 'touche' | 'plan' | 'bloque' | 'perime' | 'fini'

export type Camarade = {
  name: string
  ticket?: string
  stateLabel: string
  summary?: string
  ageMin?: number
  pane?: string
  session?: string
  herdrStatus?: string
  attention?: Attention
  tone: Tone
}

declare module 'claude-code' {
  interface PluginState {
    anneau: { camarades: Camarade[] }
  }
}
