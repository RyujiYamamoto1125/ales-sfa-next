import mongoose, { Schema, Document } from "mongoose";

export interface ITarget extends Document {
  year: number;
  month: number;
  targetCount: number;
}

const TargetSchema = new Schema<ITarget>(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    targetCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

TargetSchema.index({ year: 1, month: 1 }, { unique: true });

export default mongoose.models.Target || mongoose.model<ITarget>("Target", TargetSchema);
