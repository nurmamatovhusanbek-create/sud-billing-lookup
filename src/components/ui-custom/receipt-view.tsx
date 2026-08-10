/**
 * ReceiptView — stylized cheque/receipt rendering for bill usage history.
 *
 * v145 §5: Replaces the plain .usage-table in BillCard's expand section with
 * a vertical ticket that looks like an actual receipt. Monospace-first
 * (JetBrains Mono), serrated top/bottom edges, barcode-style case numbers,
 * dashed dividers between line items.
 *
 * This is the "signature element" — the one place to spend visual boldness.
 */
import { Copy, Eye, Receipt } from 'lucide-react'

interface ReceiptUsageItem {
  caseNumber: string | null
  caseId: number | null
  amount: number | null
  rolledBackAt: number | null
  courtType?: string
  invoiceStatus?: string | null
}

interface ReceiptViewProps {
  billNumber: string
  issued: number | null | undefined
  court: string | null | undefined
  purpose: string | null | undefined
  amount: number | null | undefined
  claimCaseNumber: string | null | undefined
  history: ReceiptUsageItem[]
  onViewCase: (caseNumber: string, courtType?: string) => void
  formatSum: (n: number | null | undefined) => string
  formatDate: (ts: number | null | undefined) => string
}

export function ReceiptView({
  billNumber,
  issued,
  court,
  purpose,
  amount,
  claimCaseNumber,
  history,
  onViewCase,
  formatSum,
  formatDate,
}: ReceiptViewProps) {
  return (
    <div className="receipt-view">
      {/* Serrated top edge */}
      <div className="receipt-edge receipt-edge-top" />

      <div className="receipt-body">
        {/* Header */}
        <div className="receipt-header">
          <Receipt className="receipt-header-icon" />
          <div className="receipt-header-text">
            <div className="receipt-title">KVITANSIYA</div>
            <div className="receipt-sub">Sud to'lov hujjati</div>
          </div>
        </div>

        {/* Barcode-style bill number */}
        <div className="receipt-barcode">
          <div className="receipt-barcode-bars">
            {billNumber.split('').map((digit, i) => (
              <div
                key={i}
                className="receipt-bar"
                style={{ height: `${8 + (parseInt(digit) || 0) * 3}px` }}
              />
            ))}
          </div>
          <div className="receipt-barcode-number">{billNumber}</div>
        </div>

        {/* Meta rows */}
        <div className="receipt-meta">
          {issued && (
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">Sana</span>
              <span className="receipt-meta-value mono">{formatDate(issued)}</span>
            </div>
          )}
          {court && (
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">Sud</span>
              <span className="receipt-meta-value">{court}</span>
            </div>
          )}
          {purpose && (
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">Maqsad</span>
              <span className="receipt-meta-value receipt-meta-value-wrap">{purpose}</span>
            </div>
          )}
          <div className="receipt-meta-row receipt-amount-row">
            <span className="receipt-meta-label">Summa</span>
            <span className="receipt-amount mono">{formatSum(amount)}</span>
            <span className="receipt-amount-unit">so'm</span>
          </div>
        </div>

        {/* Claim case number (if any) */}
        {claimCaseNumber && (
          <div className="receipt-claim">
            <span className="receipt-meta-label">№ Da'vo ish raqami</span>
            <div className="receipt-claim-row">
              <span className="receipt-claim-number mono">{claimCaseNumber}</span>
              <button
                type="button"
                className="korish-btn"
                onClick={() => onViewCase(claimCaseNumber, undefined)}
              >
                <Eye className="w-3.5 h-3.5" /> Ko'rish
              </button>
            </div>
          </div>
        )}

        {/* Usage history — line items like a real receipt */}
        {history.length > 0 && (
          <div className="receipt-items">
            <div className="receipt-items-header">
              Ishlatilgan ishlar ({history.length})
            </div>
            <div className="receipt-divider" />
            {history.map((h, i) => (
              <div key={i} className="receipt-item">
                <div className="receipt-item-top">
                  <span className="receipt-item-num mono">
                    {h.caseNumber || (h.caseId ? `#${h.caseId}` : '—')}
                  </span>
                  <span className={`badge ${h.rolledBackAt ? 'b-unpaid' : 'b-paid'}`}>
                    {h.rolledBackAt ? 'Qaytarilgan' : 'Ishlatilgan'}
                  </span>
                </div>
                <div className="receipt-item-bottom">
                  <span className="receipt-item-amount mono">
                    {formatSum(h.amount)}
                    <span className="receipt-item-unit"> so'm</span>
                  </span>
                  {h.caseNumber && (
                    <div className="receipt-item-actions">
                      <button
                        type="button"
                        className="korish-btn"
                        onClick={() => onViewCase(h.caseNumber!, h.courtType)}
                      >
                        <Eye className="w-3.5 h-3.5" /> Ko'rish
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="receipt-footer">
          Sud Billing Lookup tomonidan yaratilgan
        </div>
      </div>

      {/* Serrated bottom edge */}
      <div className="receipt-edge receipt-edge-bottom" />
    </div>
  )
}
