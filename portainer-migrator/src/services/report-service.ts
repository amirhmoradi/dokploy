/**
 * Report Service - v1.2.0
 * Handles report generation in multiple formats (JSON, PDF, CSV, HTML)
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type {
  ReportConfig,
  ReportFormat,
  ReportTemplate,
  GeneratedReport,
  TrendData,
  ComparisonReport,
  Migration,
  MigrationStatistics,
} from "../types";

export class ReportService {
  private reportsDir: string;
  private templates: Map<string, ReportTemplate> = new Map();

  constructor(reportsDir: string = "./data/reports") {
    this.reportsDir = reportsDir;
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize report directory and templates
   */
  async initialize(): Promise<void> {
    await mkdir(this.reportsDir, { recursive: true });
  }

  /**
   * Generate a report
   */
  async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    const template = this.templates.get(config.templateId);
    if (!template) {
      throw new Error(`Template not found: ${config.templateId}`);
    }

    const data = await this.gatherReportData(config);
    const content = await this.renderReport(template, data, config);

    const id = this.generateId();
    const filename = `report-${template.type}-${id}.${this.getExtension(template.format)}`;
    const filePath = join(this.reportsDir, filename);

    await writeFile(filePath, content);

    const report: GeneratedReport = {
      id,
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      templateId: config.templateId,
      config,
      format: template.format,
      filePath,
      fileSize: Buffer.byteLength(content),
      generatedAt: new Date().toISOString(),
    };

    return report;
  }

  /**
   * Generate migration report
   */
  async generateMigrationReport(
    migrationId: string,
    format: ReportFormat = "json"
  ): Promise<GeneratedReport> {
    return this.generateReport({
      templateId: `migration-${format}`,
      migrationIds: [migrationId],
      includeDetails: true,
      includeLogs: true,
      includeCharts: format === "html" || format === "pdf",
    });
  }

  /**
   * Generate trend analysis report
   */
  async generateTrendReport(
    dateRange: { start: string; end: string },
    format: ReportFormat = "json"
  ): Promise<GeneratedReport> {
    return this.generateReport({
      templateId: `trend-${format}`,
      dateRange,
      includeDetails: true,
      includeLogs: false,
      includeCharts: true,
      groupBy: "date",
    });
  }

  /**
   * Generate comparison report
   */
  async generateComparisonReport(
    migrationIds: string[],
    format: ReportFormat = "json"
  ): Promise<GeneratedReport> {
    return this.generateReport({
      templateId: `comparison-${format}`,
      migrationIds,
      includeDetails: true,
      includeLogs: false,
      includeCharts: true,
    });
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(
    dateRange: { start: string; end: string },
    format: ReportFormat = "json"
  ): Promise<GeneratedReport> {
    return this.generateReport({
      templateId: `audit-${format}`,
      dateRange,
      includeDetails: true,
      includeLogs: true,
      includeCharts: false,
    });
  }

  /**
   * Get trend data
   */
  async getTrendData(
    dateRange: { start: string; end: string },
    granularity: "day" | "week" | "month" = "day"
  ): Promise<TrendData[]> {
    // This would query the database for trend data
    const trends: TrendData[] = [];

    // Generate sample trend data
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const current = new Date(start);

    while (current <= end) {
      trends.push({
        period: current.toISOString().split("T")[0],
        migrations: Math.floor(Math.random() * 10),
        successRate: 85 + Math.random() * 15,
        avgDuration: 1000 + Math.random() * 2000,
        itemsMigrated: Math.floor(Math.random() * 100),
        errorCount: Math.floor(Math.random() * 5),
      });

      switch (granularity) {
        case "day":
          current.setDate(current.getDate() + 1);
          break;
        case "week":
          current.setDate(current.getDate() + 7);
          break;
        case "month":
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return trends;
  }

  /**
   * Add custom template
   */
  addTemplate(template: ReportTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get all templates
   */
  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  // Private methods

  private initializeDefaultTemplates(): void {
    // JSON Templates
    this.templates.set("migration-json", {
      id: "migration-json",
      name: "Migration Report",
      type: "migration",
      format: "json",
      template: "",
      isDefault: true,
      createdAt: new Date().toISOString(),
    });

    // HTML Templates
    this.templates.set("migration-html", {
      id: "migration-html",
      name: "Migration Report (HTML)",
      type: "migration",
      format: "html",
      template: this.getHtmlMigrationTemplate(),
      styles: this.getDefaultStyles(),
      isDefault: true,
      createdAt: new Date().toISOString(),
    });

    // CSV Templates
    this.templates.set("migration-csv", {
      id: "migration-csv",
      name: "Migration Report (CSV)",
      type: "migration",
      format: "csv",
      template: "",
      isDefault: true,
      createdAt: new Date().toISOString(),
    });

    // Trend Templates
    this.templates.set("trend-json", {
      id: "trend-json",
      name: "Trend Analysis",
      type: "trend",
      format: "json",
      template: "",
      isDefault: true,
      createdAt: new Date().toISOString(),
    });

    this.templates.set("trend-html", {
      id: "trend-html",
      name: "Trend Analysis (HTML)",
      type: "trend",
      format: "html",
      template: this.getHtmlTrendTemplate(),
      styles: this.getDefaultStyles(),
      isDefault: true,
      createdAt: new Date().toISOString(),
    });

    // Audit Templates
    this.templates.set("audit-json", {
      id: "audit-json",
      name: "Audit Report",
      type: "audit",
      format: "json",
      template: "",
      isDefault: true,
      createdAt: new Date().toISOString(),
    });

    // Comparison Templates
    this.templates.set("comparison-json", {
      id: "comparison-json",
      name: "Comparison Report",
      type: "comparison",
      format: "json",
      template: "",
      isDefault: true,
      createdAt: new Date().toISOString(),
    });
  }

  private async gatherReportData(config: ReportConfig): Promise<ReportData> {
    const data: ReportData = {
      generatedAt: new Date().toISOString(),
      config,
      migrations: [],
      statistics: {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      trends: [],
      logs: [],
    };

    // Gather data based on config
    if (config.migrationIds?.length) {
      // Fetch specific migrations
      // data.migrations = await getMigrations(config.migrationIds);
    }

    if (config.dateRange) {
      data.trends = await this.getTrendData(config.dateRange);
    }

    return data;
  }

  private async renderReport(
    template: ReportTemplate,
    data: ReportData,
    config: ReportConfig
  ): Promise<string | Buffer> {
    switch (template.format) {
      case "json":
        return JSON.stringify(data, null, 2);

      case "csv":
        return this.renderCsv(data);

      case "html":
        return this.renderHtml(template, data);

      case "pdf":
        return this.renderPdf(template, data);

      default:
        return JSON.stringify(data);
    }
  }

  private renderCsv(data: ReportData): string {
    const rows: string[] = [];

    // Header
    rows.push("ID,Name,Status,Progress,Created At,Completed At,Items,Errors");

    // Data rows
    for (const migration of data.migrations) {
      rows.push(
        [
          migration.id,
          `"${migration.name}"`,
          migration.status,
          migration.progress,
          migration.createdAt,
          migration.completedAt || "",
          migration.itemCount || 0,
          migration.errorCount || 0,
        ].join(",")
      );
    }

    return rows.join("\n");
  }

  private renderHtml(template: ReportTemplate, data: ReportData): string {
    let html = template.template;

    // Replace placeholders
    html = html.replace("{{generatedAt}}", data.generatedAt);
    html = html.replace("{{totalMigrations}}", String(data.statistics.total));
    html = html.replace("{{completedMigrations}}", String(data.statistics.completed));
    html = html.replace("{{failedMigrations}}", String(data.statistics.failed));
    html = html.replace(
      "{{successRate}}",
      data.statistics.total > 0
        ? ((data.statistics.completed / data.statistics.total) * 100).toFixed(1)
        : "0"
    );

    // Generate migrations table
    const migrationsHtml = data.migrations
      .map(
        (m) => `
      <tr>
        <td>${m.id}</td>
        <td>${m.name}</td>
        <td><span class="status-${m.status}">${m.status}</span></td>
        <td>${m.progress}%</td>
        <td>${m.createdAt}</td>
      </tr>
    `
      )
      .join("");
    html = html.replace("{{migrationsTable}}", migrationsHtml);

    // Add styles
    html = html.replace("{{styles}}", template.styles || this.getDefaultStyles());

    return html;
  }

  private async renderPdf(template: ReportTemplate, data: ReportData): Promise<Buffer> {
    // For PDF generation, you would typically use a library like puppeteer or pdfkit
    // For now, we'll return the HTML as a buffer
    const html = this.renderHtml(template, data);
    return Buffer.from(html);
  }

  private getHtmlMigrationTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Migration Report</title>
  <style>{{styles}}</style>
</head>
<body>
  <div class="container">
    <h1>Migration Report</h1>
    <p class="generated-at">Generated: {{generatedAt}}</p>

    <div class="summary">
      <div class="stat-card">
        <h3>Total Migrations</h3>
        <p class="stat-value">{{totalMigrations}}</p>
      </div>
      <div class="stat-card">
        <h3>Completed</h3>
        <p class="stat-value success">{{completedMigrations}}</p>
      </div>
      <div class="stat-card">
        <h3>Failed</h3>
        <p class="stat-value error">{{failedMigrations}}</p>
      </div>
      <div class="stat-card">
        <h3>Success Rate</h3>
        <p class="stat-value">{{successRate}}%</p>
      </div>
    </div>

    <h2>Migrations</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        {{migrationsTable}}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }

  private getHtmlTrendTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Trend Analysis Report</title>
  <style>{{styles}}</style>
</head>
<body>
  <div class="container">
    <h1>Trend Analysis Report</h1>
    <p class="generated-at">Generated: {{generatedAt}}</p>

    <div class="chart-container">
      <canvas id="trendChart"></canvas>
    </div>

    <h2>Summary Statistics</h2>
    <div class="summary">
      <div class="stat-card">
        <h3>Total Migrations</h3>
        <p class="stat-value">{{totalMigrations}}</p>
      </div>
      <div class="stat-card">
        <h3>Avg Success Rate</h3>
        <p class="stat-value">{{successRate}}%</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getDefaultStyles(): string {
    return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; background: #fff; }
    h1 { margin-bottom: 0.5rem; color: #1a1a1a; }
    h2 { margin: 2rem 0 1rem; color: #333; }
    .generated-at { color: #666; margin-bottom: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; text-align: center; }
    .stat-card h3 { font-size: 0.875rem; color: #666; margin-bottom: 0.5rem; }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-value.success { color: #22c55e; }
    .stat-value.error { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f8f9fa; font-weight: 600; }
    .status-completed { color: #22c55e; }
    .status-failed { color: #ef4444; }
    .status-running { color: #3b82f6; }
    .status-pending { color: #f59e0b; }
  `;
  }

  private getExtension(format: ReportFormat): string {
    switch (format) {
      case "json":
        return "json";
      case "csv":
        return "csv";
      case "html":
        return "html";
      case "pdf":
        return "pdf";
      default:
        return "txt";
    }
  }

  private generateId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

interface ReportData {
  generatedAt: string;
  config: ReportConfig;
  migrations: MigrationReportData[];
  statistics: MigrationStatistics;
  trends: TrendData[];
  logs: unknown[];
}

interface MigrationReportData {
  id: string;
  name: string;
  status: string;
  progress: number;
  createdAt: string;
  completedAt?: string;
  itemCount?: number;
  errorCount?: number;
}

// Export singleton
export const reportService = new ReportService();
