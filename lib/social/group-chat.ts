export type GroupChatRow = {
  id: string;
  owner_user_id: string;
  plan_id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
  last_message_at?: string | null;
};

export type GroupChatMemberRow = {
  id: string;
  chat_id: string;
  member_user_id: string;
  created_at?: string | null;
  last_read_at?: string | null;
};

export type GroupChatMessageRow = {
  id: string;
  chat_id: string;
  sender_user_id: string;
  message_type?: "user" | "system" | string | null;
  body: string;
  created_at?: string | null;
};
