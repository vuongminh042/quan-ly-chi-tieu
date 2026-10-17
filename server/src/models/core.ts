import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    emailVerified: { type: Boolean, default: true, index: true },
    emailVerificationTokenHash: {
      type: String,
      select: false,
      unique: true,
      sparse: true,
    },
    emailVerificationExpiresAt: { type: Date, select: false },
    isActive: { type: Boolean, default: true, index: true },
    avatar: { type: String, maxlength: 2048 },
    avatarPublicId: { type: String, maxlength: 255 },
    passwordHash: { type: String, select: false },
  },
  { timestamps: true },
);

const accountSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: ["cash", "bank", "ewallet"], default: "cash" },
    openingBalance: { type: Number, default: 0 },
    color: { type: String, default: "#087F6A", match: /^#[0-9a-fA-F]{6}$/ },
  },
  { timestamps: true },
);
accountSchema.index({ userId: 1, name: 1 }, { unique: true });

const categorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    kind: { type: String, enum: ["income", "expense"], required: true },
    icon: { type: String, default: "circle" },
    color: { type: String, default: "#087F6A", match: /^#[0-9a-fA-F]{6}$/ },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);
categorySchema.index({ userId: 1, name: 1, kind: 1 }, { unique: true });

export type UserRecord = InferSchemaType<typeof userSchema>;
export type AccountRecord = InferSchemaType<typeof accountSchema>;
export type CategoryRecord = InferSchemaType<typeof categorySchema>;

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
export const Account =
  mongoose.models.Account ?? mongoose.model("Account", accountSchema);
export const Category =
  mongoose.models.Category ?? mongoose.model("Category", categorySchema);
