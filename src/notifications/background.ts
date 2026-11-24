import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadMedications, loadProfiles, loadSettings } from '@/db/repository';
import { notifyLowStock, rescheduleAllNotifications } from '@/notifications/scheduler';

export const BACKGROUND_REFRESH_TASK = 'tabletka-background-refresh';

TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  try {
    const settings = await loadSettings();
    const profiles = await loadProfiles();
    const active =
      profiles.find((profile) => profile.id === settings.activeProfileId) ?? profiles[0];
    if (!active) return BackgroundTask.BackgroundTaskResult.Success;
    const meds = await loadMedications(active.id);
    await rescheduleAllNotifications(meds, settings);
    await notifyLowStock(meds, settings);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);
    if (registered) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, {
      minimumInterval: 6 * 60,
    });
  } catch {
    // background tasks are a best-effort safety net
  }
}
