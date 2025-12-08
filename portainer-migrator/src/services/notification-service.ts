/**
 * Notification Service - v1.1.0
 * Handles email, webhook, Slack, Discord, and Teams notifications
 */

import type {
  NotificationConfig,
  NotificationEvent,
  NotificationChannel,
  EmailConfig,
  WebhookConfig,
  SlackConfig,
  DiscordConfig,
  TeamsConfig,
  Migration,
  MigrationItem,
} from "../types";

export class NotificationService {
  private configs: Map<string, NotificationConfig> = new Map();

  /**
   * Send notification for an event
   */
  async sendNotification(
    event: NotificationEvent,
    data: NotificationPayload
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const applicableConfigs = this.getConfigsForEvent(event);

    for (const config of applicableConfigs) {
      if (!config.enabled) continue;

      try {
        const result = await this.sendToChannel(config, event, data);
        results.push({
          configId: config.id,
          channel: config.channel,
          success: true,
          sentAt: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          configId: config.id,
          channel: config.channel,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(
    config: NotificationConfig,
    event: NotificationEvent,
    data: NotificationPayload
  ): Promise<void> {
    const message = this.formatMessage(event, data, config.templateId);

    switch (config.channel) {
      case "email":
        await this.sendEmail(config.config as EmailConfig, message);
        break;
      case "webhook":
        await this.sendWebhook(config.config as WebhookConfig, event, data);
        break;
      case "slack":
        await this.sendSlack(config.config as SlackConfig, message);
        break;
      case "discord":
        await this.sendDiscord(config.config as DiscordConfig, message);
        break;
      case "teams":
        await this.sendTeams(config.config as TeamsConfig, message);
        break;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(config: EmailConfig, message: FormattedMessage): Promise<void> {
    // Using nodemailer-compatible approach
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: config.toAddresses.join(", "),
      cc: config.ccAddresses?.join(", "),
      subject: message.subject || "Portainer Migrator Notification",
      text: message.text,
      html: message.html,
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    config: WebhookConfig,
    event: NotificationEvent,
    data: NotificationPayload
  ): Promise<void> {
    const body = config.bodyTemplate
      ? this.interpolateTemplate(config.bodyTemplate, { event, ...data })
      : JSON.stringify({ event, ...data, timestamp: new Date().toISOString() });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Add signature if secret key is configured
    if (config.secretKey) {
      const crypto = await import("crypto");
      const signature = crypto
        .createHmac("sha256", config.secretKey)
        .update(body)
        .digest("hex");
      headers["X-Signature"] = `sha256=${signature}`;
    }

    let lastError: Error | null = null;
    const maxRetries = config.retryCount || 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(config.url, {
          method: config.method,
          headers,
          body: config.method !== "GET" ? body : undefined,
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError;
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(config: SlackConfig, message: FormattedMessage): Promise<void> {
    const payload: Record<string, unknown> = {
      text: message.text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: message.text,
          },
        },
      ],
    };

    if (config.channel) payload.channel = config.channel;
    if (config.username) payload.username = config.username;
    if (config.iconEmoji) payload.icon_emoji = config.iconEmoji;

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscord(config: DiscordConfig, message: FormattedMessage): Promise<void> {
    const payload: Record<string, unknown> = {
      content: message.text,
      embeds: [
        {
          title: message.subject || "Portainer Migrator",
          description: message.text,
          color: this.getColorForMessage(message),
          timestamp: new Date().toISOString(),
        },
      ],
    };

    if (config.username) payload.username = config.username;
    if (config.avatarUrl) payload.avatar_url = config.avatarUrl;

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }
  }

  /**
   * Send Microsoft Teams notification
   */
  private async sendTeams(config: TeamsConfig, message: FormattedMessage): Promise<void> {
    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor: this.getColorForMessage(message).toString(16),
      summary: message.subject || "Portainer Migrator Notification",
      sections: [
        {
          activityTitle: message.subject || "Portainer Migrator",
          text: message.text,
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.status}`);
    }
  }

  /**
   * Format message based on event and data
   */
  private formatMessage(
    event: NotificationEvent,
    data: NotificationPayload,
    templateId?: string
  ): FormattedMessage {
    const templates: Record<NotificationEvent, MessageTemplate> = {
      "migration.started": {
        subject: "Migration Started: {{migrationName}}",
        text: "Migration '{{migrationName}}' has started.\n\nSource: {{sourceType}}\nItems to migrate: {{totalItems}}",
      },
      "migration.completed": {
        subject: "Migration Completed: {{migrationName}}",
        text: "Migration '{{migrationName}}' completed successfully!\n\nCompleted: {{completedItems}}/{{totalItems}}\nDuration: {{duration}}",
      },
      "migration.failed": {
        subject: "Migration Failed: {{migrationName}}",
        text: "Migration '{{migrationName}}' failed!\n\nError: {{errorMessage}}\nCompleted: {{completedItems}}/{{totalItems}}",
      },
      "migration.cancelled": {
        subject: "Migration Cancelled: {{migrationName}}",
        text: "Migration '{{migrationName}}' was cancelled.\n\nCompleted before cancel: {{completedItems}}/{{totalItems}}",
      },
      "analysis.completed": {
        subject: "Analysis Completed: {{migrationName}}",
        text: "Analysis for '{{migrationName}}' is complete.\n\nEndpoints: {{endpoints}}\nStacks: {{stacks}}\nRegistries: {{registries}}",
      },
      "item.failed": {
        subject: "Migration Item Failed: {{itemName}}",
        text: "Item '{{itemName}}' ({{itemType}}) failed to migrate.\n\nError: {{errorMessage}}\nMigration: {{migrationName}}",
      },
      "license.expiring": {
        subject: "License Expiring Soon",
        text: "Your Portainer Migrator license will expire on {{expiresAt}}.\n\nPlease renew to continue using the service.",
      },
    };

    const template = templates[event];
    const text = this.interpolateTemplate(template.text, data);
    const subject = this.interpolateTemplate(template.subject, data);

    return {
      subject,
      text,
      html: `<div style="font-family: sans-serif;">${text.replace(/\n/g, "<br>")}</div>`,
      level: this.getLevelForEvent(event),
    };
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(data[key] ?? "");
    });
  }

  /**
   * Get color based on message level
   */
  private getColorForMessage(message: FormattedMessage): number {
    switch (message.level) {
      case "error":
        return 0xff0000; // Red
      case "warning":
        return 0xffa500; // Orange
      case "success":
        return 0x00ff00; // Green
      default:
        return 0x0099ff; // Blue
    }
  }

  /**
   * Get level for event
   */
  private getLevelForEvent(event: NotificationEvent): "info" | "success" | "warning" | "error" {
    if (event.includes("failed")) return "error";
    if (event.includes("completed")) return "success";
    if (event.includes("expiring")) return "warning";
    return "info";
  }

  /**
   * Get configs that handle a specific event
   */
  private getConfigsForEvent(event: NotificationEvent): NotificationConfig[] {
    return Array.from(this.configs.values()).filter(
      (config) => config.enabled && config.events.includes(event)
    );
  }

  /**
   * Add notification configuration
   */
  addConfig(config: NotificationConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Remove notification configuration
   */
  removeConfig(configId: string): void {
    this.configs.delete(configId);
  }

  /**
   * Update notification configuration
   */
  updateConfig(configId: string, updates: Partial<NotificationConfig>): void {
    const existing = this.configs.get(configId);
    if (existing) {
      this.configs.set(configId, { ...existing, ...updates });
    }
  }

  /**
   * Test notification configuration
   */
  async testConfig(config: NotificationConfig): Promise<boolean> {
    try {
      await this.sendToChannel(config, "migration.started", {
        migrationName: "Test Migration",
        sourceType: "api",
        totalItems: 10,
      });
      return true;
    } catch (error) {
      console.error("Notification test failed:", error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Types
interface NotificationPayload {
  migrationName?: string;
  migrationId?: string;
  sourceType?: string;
  totalItems?: number;
  completedItems?: number;
  failedItems?: number;
  duration?: string;
  errorMessage?: string;
  itemName?: string;
  itemType?: string;
  endpoints?: number;
  stacks?: number;
  registries?: number;
  expiresAt?: string;
  [key: string]: unknown;
}

interface NotificationResult {
  configId: string;
  channel: NotificationChannel;
  success: boolean;
  sentAt?: string;
  error?: string;
}

interface FormattedMessage {
  subject?: string;
  text: string;
  html?: string;
  level: "info" | "success" | "warning" | "error";
}

interface MessageTemplate {
  subject: string;
  text: string;
}

// Export singleton
export const notificationService = new NotificationService();
