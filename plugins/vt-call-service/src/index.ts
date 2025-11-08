import { registerPlugin } from '@capacitor/core';

export interface VTCallServicePlugin {
  getRecordingFileUrl(options: { filename: string }): Promise<{ url: string }>;
  showIncomingCallNotification(options: { callerName: string; callerNumber: string }): Promise<{ success: boolean }>;
  dismissIncomingCallNotification(): Promise<{ success: boolean }>;
  reportCallConnected(): Promise<{ success: boolean }>;
}

export const VTCallService = registerPlugin<VTCallServicePlugin>('VTCallService');

export default VTCallService;

