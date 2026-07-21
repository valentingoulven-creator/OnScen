import { request } from './core';

export const dmApi = {
  getDmPresence: (token: string) =>
    request<{
      onlineUserIds: string[];
      liveUserIds: string[];
      liveViewersByUserId: Record<string, number>;
    }>('/dm/presence', {}, token),

  getConversations: (token: string) =>
    request<{ conversations: import('../../types').Conversation[]; unreadCount: number }>(
      '/dm/conversations/list',
      {},
      token
    ),

  getDmUnreadCount: (token: string) =>
    request<{ unreadCount: number }>('/dm/unread-count', {}, token),

  markDmThreadRead: (token: string, userId: string, at?: number) =>
    request<{ ok: boolean; unreadCount: number }>(`/dm/thread/${userId}/read`, {
      method: 'POST',
      body: JSON.stringify(at != null ? { at } : {}),
    }, token),

  getDmContacts: (token: string) =>
    request<{ contacts: import('../../types').DmContact[] }>('/dm/contacts/list', {}, token),

  blockUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/block/${userId}`, { method: 'POST' }, token),

  unblockUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/block/${userId}`, { method: 'DELETE' }, token),

  getBlockedUsers: (token: string) =>
    request<{ blocked: import('../../types').DmContact[] }>('/dm/blocks/list', {}, token),

  getMutedUserIds: (token: string) =>
    request<{ mutedUserIds: string[] }>('/dm/mutes/list', {}, token),

  muteUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/mute/${userId}`, { method: 'POST' }, token),

  unmuteUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/mute/${userId}`, { method: 'DELETE' }, token),

  getDmThread: (token: string, userId: string) =>
    request<{
      messages: import('../../types').DirectMessage[];
      otherUser: import('../../types').DmContact;
      isBlockedByMe?: boolean;
      isBlockedByThem?: boolean;
    }>(`/dm/thread/${userId}`, {}, token),

  hideDmConversation: (token: string, userId: string) =>
    request<{ ok: boolean; hiddenCount: number }>(`/dm/thread/${userId}`, { method: 'DELETE' }, token),

  sendDm: (
    token: string,
    userId: string,
    content: string,
    attachment?: {
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: number;
      attachmentMimeType?: string;
    }
  ) =>
    request<{ message: import('../../types').DirectMessage; status?: 'accepted' | 'pending'; delivered?: boolean }>(
      `/dm/thread/${userId}`,
      { method: 'POST', body: JSON.stringify({ content, ...attachment }) },
      token
    ),

  reactToDmMessage: (token: string, messageId: string, emoji: string) =>
    request<{ ok: boolean; added: boolean; reactions: Record<string, string[]> }>(
      `/dm/messages/${messageId}/react`,
      { method: 'POST', body: JSON.stringify({ emoji }) },
      token
    ),

  getDmRequests: (token: string) =>
    request<{ requests: import('../../types').DmRequest[] }>('/dm/requests/list', {}, token),

  acceptDmRequest: (token: string, senderId: string) =>
    request<{ ok: boolean }>(`/dm/requests/${senderId}/accept`, { method: 'POST' }, token),

  refuseDmRequest: (token: string, senderId: string) =>
    request<{ ok: boolean }>(`/dm/requests/${senderId}/refuse`, { method: 'POST' }, token),

  deleteDmMessage: (token: string, messageId: string, forAll = false) =>
    request<{ ok: boolean; messageId: string; scope: 'hidden' | 'all' }>(
      `/dm/messages/${messageId}${forAll ? '?forAll=true' : ''}`,
      { method: 'DELETE' },
      token
    ),

  createMessageGroup: (token: string, name: string, memberIds: string[]) =>
    request<{ group: import('../../types').MessageGroupDetail }>(
      '/dm/groups',
      { method: 'POST', body: JSON.stringify({ name, memberIds }) },
      token
    ),

  getGroupThread: (token: string, groupId: string) =>
    request<{
      messages: import('../../types').GroupMessage[];
      group: import('../../types').MessageGroupDetail;
    }>(`/dm/groups/${groupId}/thread`, {}, token),

  sendGroupMessage: (token: string, groupId: string, content: string) =>
    request<{ message: import('../../types').GroupMessage }>(
      `/dm/groups/${groupId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token
    ),

  markGroupThreadRead: (token: string, groupId: string, at?: number) =>
    request<{ ok: boolean; unreadCount: number }>(`/dm/groups/${groupId}/read`, {
      method: 'POST',
      body: JSON.stringify(at != null ? { at } : {}),
    }, token),

  deleteGroupMessage: (token: string, messageId: string, forAll = false) =>
    request<{ ok: boolean; messageId: string; scope: 'hidden' | 'all' }>(
      `/dm/groups/messages/${messageId}${forAll ? '?forAll=true' : ''}`,
      { method: 'DELETE' },
      token
    ),

  addGroupMember: (token: string, groupId: string, userId: string) =>
    request<{ group: import('../../types').MessageGroupDetail }>(
      `/dm/groups/${groupId}/members`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ),

  removeGroupMember: (token: string, groupId: string, userId: string) =>
    request<{ group: import('../../types').MessageGroupDetail; removedUserId: string }>(
      `/dm/groups/${groupId}/members/${userId}`,
      { method: 'DELETE' },
      token
    ),

  renameMessageGroup: (token: string, groupId: string, name: string) =>
    request<{ group: import('../../types').MessageGroupDetail }>(
      `/dm/groups/${groupId}`,
      { method: 'PATCH', body: JSON.stringify({ name }) },
      token
    ),

  deleteMessageGroup: (token: string, groupId: string) =>
    request<{ ok: boolean; groupId: string }>(
      `/dm/groups/${groupId}`,
      { method: 'DELETE' },
      token
    ),

  transferGroupCreator: (token: string, groupId: string, userId: string) =>
    request<{ group: import('../../types').MessageGroupDetail }>(
      `/dm/groups/${groupId}/transfer-creator`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ),

  deleteChatMessage: (
    token: string,
    roomType: 'salon' | 'live',
    roomId: string,
    messageId: string
  ) =>
    request<{ ok: boolean; messageId: string }>(
      `/chat/${roomType}/${roomId}/messages/${messageId}`,
      { method: 'DELETE' },
      token
    ),

  /**
   * Envoie une pièce jointe (data: URL) au backend, qui la stocke localement et
   * renvoie une URL https utilisable comme attachmentUrl dans un message
   * DM / salon / live. Obligatoire avant tout envoi : le backend rejette les
   * data: URL brutes dans attachmentUrl.
   */
  uploadChatAttachment: (token: string, dataUrl: string, name?: string) =>
    request<{
      attachmentUrl: string;
      attachmentMimeType: string;
      attachmentSize: number;
      attachmentName?: string;
    }>(
      '/chat/attachment',
      { method: 'POST', body: JSON.stringify({ dataUrl, name }) },
      token
    ),
} as const;
