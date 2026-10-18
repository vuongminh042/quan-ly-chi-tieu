import mongoose, { Schema, type InferSchemaType } from "mongoose";

const supportConversationSchema = new Schema(
  {
    visitorName: { type: String, required: true, trim: true, maxlength: 80 },
    visitorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    visitorTokenHash: { type: String, required: true, select: false },
    accountUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    lastMessage: { type: String, required: true, maxlength: 2000 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unreadByAdmin: { type: Number, default: 1 },
    unreadByVisitor: { type: Number, default: 0 },
  },
  { timestamps: true },
);
supportConversationSchema.index(
  { accountUserId: 1 },
  { unique: true, sparse: true },
);

const supportMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "SupportConversation",
      required: true,
      index: true,
    },
    senderRole: { type: String, enum: ["visitor", "admin"], required: true },
    senderName: { type: String, required: true, maxlength: 80 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    deliveryStatus: {
      type: String,
      enum: ["sent", "received", "read"],
      default: "sent",
      index: true,
    },
    receivedAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
supportMessageSchema.index({ conversationId: 1, createdAt: 1 });
supportMessageSchema.index({ deliveryStatus: 1, createdAt: 1 });

export type SupportConversationRecord = InferSchemaType<
  typeof supportConversationSchema
>;
export type SupportMessageRecord = InferSchemaType<typeof supportMessageSchema>;

export const SupportConversation =
  (mongoose.models.SupportConversation as
    | mongoose.Model<SupportConversationRecord>
    | undefined) ??
  mongoose.model<SupportConversationRecord>(
    "SupportConversation",
    supportConversationSchema,
  );
export const SupportMessage =
  (mongoose.models.SupportMessage as
    | mongoose.Model<SupportMessageRecord>
    | undefined) ??
  mongoose.model<SupportMessageRecord>("SupportMessage", supportMessageSchema);