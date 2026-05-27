'use client'

export function RhythmWidget({ pctPsic, pctPac }: { pctPsic: number; pctPac: number }) {
  return (
    <div className="widget" data-widget-id="ritmo">
      <div className="widget-grip" aria-hidden="true">⠿</div>
      <div className="widget-title">Ritmo da conversa</div>
      <div className="rh-row">
        <span className="who">Psicóloga</span>
        <div className="rh-bar psic"><span style={{ width: `${pctPsic}%` }} /></div>
        <span className="rh-pct">{pctPsic}%</span>
      </div>
      <div className="rh-row">
        <span className="who">Paciente</span>
        <div className="rh-bar pac"><span style={{ width: `${pctPac}%` }} /></div>
        <span className="rh-pct">{pctPac}%</span>
      </div>
    </div>
  )
}
