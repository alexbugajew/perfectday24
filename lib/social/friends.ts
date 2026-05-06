export type FriendshipRow = {
  id: string;
  requester_user_id: string;
  addressee_user_id: string;
  created_at?: string | null;
};

export type FriendProfileRow = {
  id?: string;
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  creator_type?: string | null;
};

export function friendshipPeerUserId(friendship: FriendshipRow, currentUserId: string) {
  return friendship.requester_user_id === currentUserId
    ? friendship.addressee_user_id
    : friendship.requester_user_id;
}
