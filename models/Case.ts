import mongoose, { Schema, Document } from "mongoose";

export const STATUS_OPTIONS = [
  "未実行",
  "見込み（高）",
  "見込み（中）",
  "見込み（低）",
  "申し込みフォーム返送待ち",
  "NG",
  "契約",
] as const;

export type Status = (typeof STATUS_OPTIONS)[number];

export interface ICase extends Document {
  customerName: string;
  status: Status;
  nextMeeting?: Date;
  salesPerson?: string;
  appointer?: string;
  notes?: string;
  contractedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema = new Schema<ICase>(
  {
    customerName: { type: String, required: true },
    status: { type: String, enum: STATUS_OPTIONS, default: "未実行" },
    nextMeeting: { type: Date },
    salesPerson: { type: String },
    appointer: { type: String },
    notes: { type: String },
    contractedAt: { type: Date },
  },
  { timestamps: true }
);

CaseSchema.index({ status: 1 });
CaseSchema.index({ appointer: 1 });
CaseSchema.index({ salesPerson: 1 });
CaseSchema.index({ contractedAt: 1 });

export default mongoose.models.Case || mongoose.model<ICase>("Case", CaseSchema);
