/**
 * Scheduler Service - v1.2.0
 * Handles scheduled migrations and cron jobs
 */

import type { ScheduledMigration, ScheduledMigrationRun, ScheduleFrequency } from "../types";

export class SchedulerService {
  private schedules: Map<string, ScheduledMigration> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private runningJobs: Set<string> = new Set();

  /**
   * Initialize scheduler and load existing schedules
   */
  async initialize(schedules: ScheduledMigration[]): Promise<void> {
    for (const schedule of schedules) {
      if (schedule.enabled) {
        this.schedules.set(schedule.id, schedule);
        this.scheduleNext(schedule);
      }
    }
  }

  /**
   * Create a new scheduled migration
   */
  createSchedule(schedule: ScheduledMigration): void {
    this.schedules.set(schedule.id, schedule);
    if (schedule.enabled) {
      this.scheduleNext(schedule);
    }
  }

  /**
   * Update a scheduled migration
   */
  updateSchedule(scheduleId: string, updates: Partial<ScheduledMigration>): void {
    const existing = this.schedules.get(scheduleId);
    if (!existing) return;

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.schedules.set(scheduleId, updated);

    // Cancel existing timer and reschedule
    this.cancelTimer(scheduleId);
    if (updated.enabled) {
      this.scheduleNext(updated);
    }
  }

  /**
   * Delete a scheduled migration
   */
  deleteSchedule(scheduleId: string): void {
    this.cancelTimer(scheduleId);
    this.schedules.delete(scheduleId);
  }

  /**
   * Enable or disable a schedule
   */
  setEnabled(scheduleId: string, enabled: boolean): void {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return;

    schedule.enabled = enabled;
    if (enabled) {
      this.scheduleNext(schedule);
    } else {
      this.cancelTimer(scheduleId);
    }
  }

  /**
   * Get next run time for a schedule
   */
  getNextRunTime(schedule: ScheduledMigration): Date | null {
    const now = new Date();

    switch (schedule.frequency) {
      case "once":
        if (schedule.scheduledAt) {
          const scheduledDate = new Date(schedule.scheduledAt);
          return scheduledDate > now ? scheduledDate : null;
        }
        return null;

      case "hourly":
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        return nextHour;

      case "daily":
        const nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        return nextDay;

      case "weekly":
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
        nextWeek.setHours(0, 0, 0, 0);
        return nextWeek;

      case "monthly":
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth;

      case "cron":
        return schedule.cronExpression
          ? this.getNextCronTime(schedule.cronExpression)
          : null;

      default:
        return null;
    }
  }

  /**
   * Parse cron expression and get next run time
   */
  private getNextCronTime(cronExpression: string): Date {
    const parts = cronExpression.split(" ");
    if (parts.length !== 5) {
      throw new Error("Invalid cron expression");
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Simple cron parsing - supports basic patterns
    // For production, use a library like 'cron-parser'

    // Parse minute
    if (minute !== "*") {
      next.setMinutes(parseInt(minute, 10));
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
    } else {
      next.setMinutes(0);
    }

    // Parse hour
    if (hour !== "*") {
      next.setHours(parseInt(hour, 10));
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }

    next.setSeconds(0);
    next.setMilliseconds(0);

    return next;
  }

  /**
   * Schedule the next run
   */
  private scheduleNext(schedule: ScheduledMigration): void {
    // Check max runs
    if (schedule.maxRuns && schedule.runCount >= schedule.maxRuns) {
      return;
    }

    const nextRunTime = this.getNextRunTime(schedule);
    if (!nextRunTime) return;

    // Check maintenance window
    if (schedule.maintenanceWindow && !this.isInMaintenanceWindow(nextRunTime, schedule.maintenanceWindow)) {
      // Find next time in maintenance window
      const adjustedTime = this.findNextMaintenanceWindow(nextRunTime, schedule.maintenanceWindow);
      if (adjustedTime) {
        schedule.nextRunAt = adjustedTime.toISOString();
      }
    } else {
      schedule.nextRunAt = nextRunTime.toISOString();
    }

    const delay = new Date(schedule.nextRunAt!).getTime() - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      this.executeSchedule(schedule);
    }, delay);

    this.timers.set(schedule.id, timer);
  }

  /**
   * Execute a scheduled migration
   */
  private async executeSchedule(schedule: ScheduledMigration): Promise<ScheduledMigrationRun> {
    if (this.runningJobs.has(schedule.id)) {
      return {
        id: this.generateId(),
        scheduleId: schedule.id,
        status: "skipped",
        errorMessage: "Previous run still in progress",
        retryCount: 0,
      };
    }

    this.runningJobs.add(schedule.id);

    const run: ScheduledMigrationRun = {
      id: this.generateId(),
      scheduleId: schedule.id,
      status: "running",
      startedAt: new Date().toISOString(),
      retryCount: 0,
    };

    try {
      // Execute migration
      const migrationId = await this.executeMigration(schedule);
      run.migrationId = migrationId;
      run.status = "completed";
      run.completedAt = new Date().toISOString();

      // Update schedule
      schedule.lastRunAt = run.startedAt;
      schedule.runCount++;
    } catch (error) {
      run.status = "failed";
      run.errorMessage = error instanceof Error ? error.message : "Unknown error";
      run.completedAt = new Date().toISOString();

      // Handle retry
      if (schedule.retryOnFailure && run.retryCount < schedule.maxRetries) {
        run.retryCount++;
        await this.sleep(Math.pow(2, run.retryCount) * 1000);
        return this.executeSchedule(schedule);
      }
    } finally {
      this.runningJobs.delete(schedule.id);
      // Schedule next run
      this.scheduleNext(schedule);
    }

    return run;
  }

  /**
   * Execute the actual migration
   */
  private async executeMigration(schedule: ScheduledMigration): Promise<string> {
    // This would call the migration service
    // For now, return a placeholder
    const migrationId = this.generateId();

    // TODO: Integrate with MigrationService
    // const migration = await migrationService.create(schedule.migrationConfig);
    // await migrationService.analyze(migration.id);
    // await migrationService.execute(migration.id);

    return migrationId;
  }

  /**
   * Check if time is within maintenance window
   */
  private isInMaintenanceWindow(
    time: Date,
    window: { startTime: string; endTime: string; daysOfWeek: number[] }
  ): boolean {
    const dayOfWeek = time.getDay();
    if (!window.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
    return timeStr >= window.startTime && timeStr <= window.endTime;
  }

  /**
   * Find next time within maintenance window
   */
  private findNextMaintenanceWindow(
    from: Date,
    window: { startTime: string; endTime: string; daysOfWeek: number[] }
  ): Date | null {
    const result = new Date(from);
    const [startHour, startMinute] = window.startTime.split(":").map(Number);

    for (let i = 0; i < 7; i++) {
      result.setDate(result.getDate() + 1);
      if (window.daysOfWeek.includes(result.getDay())) {
        result.setHours(startHour, startMinute, 0, 0);
        return result;
      }
    }

    return null;
  }

  /**
   * Cancel a timer
   */
  private cancelTimer(scheduleId: string): void {
    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(scheduleId);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll(): void {
    for (const [id] of this.timers) {
      this.cancelTimer(id);
    }
  }

  /**
   * Get all schedules
   */
  getAll(): ScheduledMigration[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get schedule by ID
   */
  get(id: string): ScheduledMigration | undefined {
    return this.schedules.get(id);
  }

  private generateId(): string {
    return `sch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton
export const schedulerService = new SchedulerService();
