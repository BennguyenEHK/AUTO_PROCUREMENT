import { ProposalPrintView } from "./proposal-print-view";
import type { ProposalMode } from "@/types/proposal";

interface ProposalPrintPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProposalPrintPage({ searchParams }: ProposalPrintPageProps) {
  const params = await searchParams;
  const rawRfqId = Array.isArray(params.rfqId) ? params.rfqId[0] : params.rfqId;
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const rawAutoPrint = Array.isArray(params.autoprint) ? params.autoprint[0] : params.autoprint;
  const rfqId = Number(rawRfqId);
  const mode: ProposalMode = rawMode === "commercial" ? "commercial" : "technical";

  return (
    <ProposalPrintView
      rfqId={Number.isFinite(rfqId) && rfqId > 0 ? rfqId : null}
      mode={mode}
      autoPrint={rawAutoPrint === "1"}
    />
  );
}
