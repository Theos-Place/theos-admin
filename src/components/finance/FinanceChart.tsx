'use client'
import { useState } from 'react'
import type { Payment, Donation } from '@/types/finance'
import { formatCRC } from '@/lib/format'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']

function getLast6Months(): { label: string; year: number; month: number }[] {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ label: MONTH_NAMES[d.getMonth()], year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return result
}

export function FinanceChart({ payments, donations }: { payments: Payment[]; donations: Donation[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; payments: number; donations: number; label: string } | null>(null)

  const months = getLast6Months()

  const data = months.map(({ label, year, month }) => {
    const pTotal = payments
      .filter(p => p.paid_at && p.status === 'paid')
      .filter(p => {
        const d = new Date(p.paid_at!)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      })
      .reduce((sum, p) => sum + p.amount, 0)

    const dTotal = donations
      .filter(d => {
        const dt = new Date(d.donation_date)
        return dt.getFullYear() === year && dt.getMonth() + 1 === month
      })
      .reduce((sum, d) => sum + d.amount, 0)

    return { label, payments: pTotal, donations: dTotal }
  })

  const maxVal = Math.max(...data.flatMap(d => [d.payments, d.donations]), 1)

  return (
    <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold font-display text-navy">
          Ingresos últimos 6 meses
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-navy" />
            <span className="text-[11px] font-body text-[rgba(22,20,64,0.55)]">Pagos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-teal-deep" />
            <span className="text-[11px] font-body text-[rgba(22,20,64,0.55)]">Donaciones</span>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Y-axis guides */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
          {[1, 0.75, 0.5, 0.25, 0].map(frac => (
            <div key={frac} className="flex items-center gap-2">
              <span className="text-[10px] w-12 text-right shrink-0 text-[rgba(22,20,64,0.30)] font-body">
                {frac === 0 ? '0' : `₡${Math.round(maxVal * frac / 1000)}k`}
              </span>
              <div className="flex-1 border-t border-[rgba(22,20,64,0.06)]" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="flex items-end gap-3 ml-14 h-[180px]">
          {data.map(({ label, payments: pv, donations: dv }) => {
            const pH = pv > 0 ? Math.max((pv / maxVal) * 156, 4) : 0
            const dH = dv > 0 ? Math.max((dv / maxVal) * 156, 4) : 0
            return (
              <div
                key={label}
                className="flex-1 flex flex-col items-center gap-0"
                onMouseEnter={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  setTooltip({ x: rect.left + rect.width / 2, y: rect.top, payments: pv, donations: dv, label })
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <div className="w-full flex items-end justify-center gap-1 h-[156px]">
                  <div
                    className="rounded-t-md transition-all duration-300 cursor-pointer w-[44%] bg-navy opacity-[0.85]"
                    style={{ height: pH }}
                    title={`Pagos: ${formatCRC(pv)}`}
                  />
                  <div
                    className="rounded-t-md transition-all duration-300 cursor-pointer w-[44%] bg-teal-deep opacity-[0.85]"
                    style={{ height: dH }}
                    title={`Donaciones: ${formatCRC(dv)}`}
                  />
                </div>
                <span className="text-[11px] mt-2 text-center font-body text-[rgba(22,20,64,0.60)]">
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-xl px-3 py-2 text-[12px] pointer-events-none -translate-x-1/2 bg-navy text-white shadow-[0_8px_24px_rgba(22,20,64,0.25)] font-body"
          style={{
            left: tooltip.x,
            top: tooltip.y - 80,
          }}
        >
          <p className="font-semibold mb-1">{tooltip.label}</p>
          <p className="text-[rgba(255,255,255,0.75)]">Pagos: {formatCRC(tooltip.payments)}</p>
          <p className="text-[rgba(255,255,255,0.75)]">Donaciones: {formatCRC(tooltip.donations)}</p>
        </div>
      )}
    </div>
  )
}
