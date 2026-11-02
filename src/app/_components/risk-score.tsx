export const HIGH_RISK_THRESHOLD = 60;

export function isHighRisk(score: number) {
  return score >= HIGH_RISK_THRESHOLD;
}

/** Risk score (0–100); scores at or above the threshold are highlighted. */
export function RiskScore({ score }: { score: number }) {
  return isHighRisk(score) ? (
    <span className="font-semibold text-rose-700" title={`High risk (≥ ${HIGH_RISK_THRESHOLD})`}>
      {score}
    </span>
  ) : (
    <span className="text-slate-700">{score}</span>
  );
}
