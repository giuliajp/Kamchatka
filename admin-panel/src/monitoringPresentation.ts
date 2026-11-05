import { createContext } from 'react';
export interface SosDecision { outcome:'resolved'|'false_alarm'; reason:string }
export interface CheckpointEvidenceModel { checkpointId:number; arrivedAt:string; source:string; attachmentName:string; note:string }
export interface BatterySample { label:string; percent:number }
export interface MonitoringPresentation {
  resolveSos?: (alertId:number,decision:SosDecision)=>Promise<void>;
  checkpointEvidence?: { initial:CheckpointEvidenceModel; onDraft:(value:CheckpointEvidenceModel)=>void; onConfirm:(value:CheckpointEvidenceModel)=>Promise<void> };
  battery?: Record<number,BatterySample[]>;
  history?: {id:string;time:string;author:string;description:string}[];
}
// Only stories inject unsupported capabilities; the application uses the empty provider.
export const MonitoringPresentationContext = createContext<MonitoringPresentation>({});
