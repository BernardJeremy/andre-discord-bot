import mongoose from 'mongoose';

interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface UserList {
  name: string;
  items: ListItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ILists extends mongoose.Document {
  userId: string;
  lists: Record<string, UserList>;
  updatedAt: Date;
}

const listItemSchema = new mongoose.Schema<ListItem>(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const userListSchema = new mongoose.Schema<UserList>(
  {
    name: {
      type: String,
      required: true,
    },
    items: [listItemSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const listsSchema = new mongoose.Schema<ILists>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lists: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Lists = mongoose.model<ILists>('Lists', listsSchema);
