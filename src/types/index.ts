export interface ToolContext {
  userId: string;
  guildId: string | null;
  channelId: string;
  sandboxPath: string;
}

export interface MessageContext {
  userId: string;
  username: string;
  guildId: string | null;
  channelId: string;
  content: string;
}
