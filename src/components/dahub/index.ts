/**
 * DAHUB Components for VOYO
 *
 * Uses Command Center's Supabase for social data
 * VOYO filters to show only music activity (appContext='V')
 */

export { DahubCore } from './DahubCore';
export type { DahubCoreProps } from './DahubCore';
export { DirectMessageChat } from './DirectMessageChat';
export { VoyoDahub } from './VoyoDahub';
export { Dahub } from './Dahub'; // New unified DaHub

// Re-export API
export {
  friendsAPI,
  messagesAPI,
  presenceAPI,
  activityAPI,
  APP_CODES,
  APP_DISPLAY,
  getAppDisplay,
  formatActivity,
  isDahubConfigured
} from '../../lib/dahub/dahub-api';

export type {
  Friend,
  Message,
  Conversation,
  UserPresence,
  FriendActivity,
  AppCode,
  SharedAccountMember,
  SharedService
} from '../../lib/dahub/dahub-api';

export { SERVICE_DISPLAY } from '../../lib/dahub/dahub-api';
