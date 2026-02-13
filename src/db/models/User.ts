import mongoose from 'mongoose';

export interface IUser extends mongoose.Document {
  discordId: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
