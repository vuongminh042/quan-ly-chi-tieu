import mongoose, { Schema } from 'mongoose';

const adminActionSchema = new Schema({
  adminUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  adminEmail: { type: String, required: true, maxlength: 254 },
  targetEmail: { type: String, required: true, maxlength: 254 },
  action: { type: String, enum: ['account_restored'], required: true },
}, { timestamps: true });
adminActionSchema.index({ createdAt: -1 });

export const AdminAction = mongoose.models.AdminAction ?? mongoose.model('AdminAction', adminActionSchema);
