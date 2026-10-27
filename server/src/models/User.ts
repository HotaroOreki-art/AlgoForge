import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    theme: { type: String, enum: ['after-dark', 'dreamscape', 'daylight'], default: 'after-dark' },
    learningGoals: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;

export const User: Model<UserAttrs> =
  (mongoose.models.User as Model<UserAttrs> | undefined) ?? mongoose.model<UserAttrs>('User', userSchema);

export function publicUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    theme: user.theme,
    learningGoals: user.learningGoals,
    createdAt: user.createdAt,
  };
}
