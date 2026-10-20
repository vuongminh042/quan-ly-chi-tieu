import mongoose, { Schema } from 'mongoose';

const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['income', 'expense'], required: true, index: true },
  amount: { type: Number, required: true, min: 1, max: 1_000_000_000_000 },
  date: { type: Date, required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  note: { type: String, default: '', trim: true, maxlength: 500 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'ewallet', 'other'], default: 'cash' },
}, { timestamps: true });
transactionSchema.index({ userId: 1, date: -1 });

const goalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  targetAmount: { type: Number, required: true, min: 1 },
  savedAmount: { type: Number, default: 0, min: 0 },
  deadline: { type: Date },
  icon: { type: String, default: 'target' },
  color: { type: String, default: '#087F6A', match: /^#[0-9a-fA-F]{6}$/ },
}, { timestamps: true });

export const Transaction = mongoose.models.Transaction ?? mongoose.model('Transaction', transactionSchema);
export const Goal = mongoose.models.Goal ?? mongoose.model('Goal', goalSchema);
