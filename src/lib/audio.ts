let ctx: AudioContext | null = null

/** Debe llamarse dentro de un gesto del usuario para que iOS permita el audio después. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* noop */
  }
}

export function beep(times = 3) {
  if (!ctx) return
  for (let i = 0; i < times; i++) {
    const t = ctx.currentTime + i * 0.22
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = i === times - 1 ? 1175 : 880
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.2)
  }
}
