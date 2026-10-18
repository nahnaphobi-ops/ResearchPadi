import { chartData, niceTicks, tickLabel, timeRange } from '../../utils/careStudyCharts';
import type { ChartSpec, SectionEntries } from '../../types/careStudy';

const W = 720, H = 260, LEFT = 62, RIGHT = 34, TOP = 16, BOTTOM = 40;

/**
 * Charts plotted from the student's own numbers (never drawn by the AI). Shows
 * what the Word export will contain, and updates as the student types.
 */
export default function SeriesCharts({ specs, entries }: { specs: ChartSpec[]; entries: SectionEntries }) {
  return (
    <div className="space-y-6">
      {specs.map((spec) => {
        const data = chartData(spec, entries);
        const plottable = data.series.filter((s) => s.points.length >= 2);
        const range = plottable.length ? timeRange({ ...data, series: plottable }) : null;
        return (
          <figure key={spec.key} className="rounded-[10px] border border-rule p-4">
            <figcaption className="mb-3 text-sm font-bold text-navy">{spec.title}</figcaption>
            {!range ? (
              <p className="text-sm text-muted">Enter at least two readings with a date or time and a number to see the chart.</p>
            ) : (
              <div className="space-y-4">
                {plottable.map((s) => {
                  const [t0, t1] = range;
                  const plotW = W - LEFT - RIGHT, plotH = H - TOP - BOTTOM;
                  const x = (t: number) => LEFT + ((t - t0) / (t1 - t0)) * plotW;
                  const y = (v: number) => TOP + plotH - ((v - s.min) / (s.max - s.min)) * plotH;
                  const yTicks: number[] = [];
                  for (let v = s.min; v <= s.max + 1e-9; v += s.step) yTicks.push(v);
                  return (
                    <div key={s.field}>
                      <p className="mb-1 text-xs font-semibold text-ink">{s.label}</p>
                      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${spec.title}: ${s.label}, ${s.points.length} readings`} className="w-full max-w-[720px]">
                        {yTicks.map((v) => (
                          <g key={v}>
                            <line x1={LEFT} x2={LEFT + plotW} y1={y(v)} y2={y(v)} stroke="#E2E6F0" />
                            <text x={LEFT - 8} y={y(v) + 4} textAnchor="end" fontSize="13" fill="#283250">{v % 1 ? v.toFixed(1) : v}</text>
                          </g>
                        ))}
                        {niceTicks(t0, t1, data.mode).map((t) => (
                          <g key={t}>
                            <line x1={x(t)} x2={x(t)} y1={TOP} y2={TOP + plotH} stroke="#E2E6F0" />
                            <text x={x(t)} y={TOP + plotH + 22} textAnchor="middle" fontSize="13" fill="#283250">{tickLabel(t, data.mode)}</text>
                          </g>
                        ))}
                        <line x1={LEFT} x2={LEFT} y1={TOP} y2={TOP + plotH} stroke="#3C4664" strokeWidth="2" />
                        <line x1={LEFT} x2={LEFT + plotW} y1={TOP + plotH} y2={TOP + plotH} stroke="#3C4664" strokeWidth="2" />
                        <polyline fill="none" stroke="#1F4BD8" strokeWidth="3" points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} />
                        {s.points.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r="5" fill="#1F4BD8" />)}
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}
            {data.skipped > 0 && (
              <p className="mt-2 text-xs text-orange-700">{data.skipped} reading{data.skipped === 1 ? ' has' : 's have'} no date or time, so {data.skipped === 1 ? 'it is' : 'they are'} not plotted.</p>
            )}
            {spec.note && <p className="mt-3 text-xs italic text-muted">{spec.note}</p>}
          </figure>
        );
      })}
    </div>
  );
}
