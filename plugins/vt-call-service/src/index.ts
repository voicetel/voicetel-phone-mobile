import { registerPlugin } from '@capacitor/core';

export interface VTCallServicePlugin {
  getRecordingFileUrl(options: { filename: string }): Promise<{ url: string }>
}

export const VTCallService = registerPlugin<VTCallServicePlugin>('VTCallService');

export default VTCallService;

