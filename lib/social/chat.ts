export type DirectConversationRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_by_user_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  last_message_at?: string | null;
};

export type DirectMessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_at?: string | null;
};

export function sortUserPair(a: string, b: string) {
  return [a, b].sort() as [string, string];
}

export function conversationPeerUserId(
  conversation: Pick<DirectConversationRow, "user_a_id" | "user_b_id">,
  currentUserId: string
) {
  return conversation.user_a_id === currentUserId
    ? conversation.user_b_id
    : conversation.user_a_id;
}
