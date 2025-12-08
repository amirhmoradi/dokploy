/**
 * Parallel Migration Service - v1.1.0
 * Handles concurrent migration operations for improved performance
 */

import type {
  MigrationConfig,
  PortainerStack,
  PortainerRegistry,
  PortainerEndpoint,
} from "../types";

export interface ParallelMigrationConfig {
  maxConcurrency: number; // Max concurrent operations
  batchSize: number; // Items per batch
  retryAttempts: number; // Retry failed items
  retryDelay: number; // Delay between retries (ms)
  timeout: number; // Operation timeout (ms)
  progressCallback?: (progress: MigrationProgress) => void;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  currentBatch: number;
  totalBatches: number;
  itemsPerSecond: number;
  estimatedTimeRemaining: number; // seconds
}

export interface MigrationItem<T = unknown> {
  id: string | number;
  type: "stack" | "registry" | "endpoint";
  data: T;
  status: "pending" | "in_progress" | "completed" | "failed";
  attempts: number;
  error?: string;
  result?: unknown;
}

export interface BatchResult {
  successful: MigrationItem[];
  failed: MigrationItem[];
  duration: number;
}

type MigrationHandler<T> = (item: T) => Promise<unknown>;

export class ParallelMigrationService {
  private config: ParallelMigrationConfig;
  private isRunning: boolean = false;
  private isCancelled: boolean = false;
  private startTime: number = 0;
  private completedCount: number = 0;

  constructor(config: Partial<ParallelMigrationConfig> = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || 5,
      batchSize: config.batchSize || 10,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 30000,
      progressCallback: config.progressCallback,
    };
  }

  /**
   * Execute migration with parallel processing
   */
  async executeMigration<T>(
    items: T[],
    handler: MigrationHandler<T>,
    type: "stack" | "registry" | "endpoint"
  ): Promise<BatchResult> {
    this.isRunning = true;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.completedCount = 0;

    const migrationItems: MigrationItem<T>[] = items.map((data, index) => ({
      id: index,
      type,
      data,
      status: "pending" as const,
      attempts: 0,
    }));

    const batches = this.createBatches(migrationItems, this.config.batchSize);
    const results: BatchResult = {
      successful: [],
      failed: [],
      duration: 0,
    };

    let currentBatch = 0;
    for (const batch of batches) {
      if (this.isCancelled) break;

      currentBatch++;
      const batchResult = await this.processBatch(batch, handler, currentBatch, batches.length);

      results.successful.push(...batchResult.successful);
      results.failed.push(...batchResult.failed);
    }

    results.duration = Date.now() - this.startTime;
    this.isRunning = false;

    return results;
  }

  /**
   * Process a batch of items in parallel
   */
  private async processBatch<T>(
    batch: MigrationItem<T>[],
    handler: MigrationHandler<T>,
    currentBatch: number,
    totalBatches: number
  ): Promise<BatchResult> {
    const results: BatchResult = {
      successful: [],
      failed: [],
      duration: 0,
    };

    const startTime = Date.now();

    // Create semaphore for concurrency control
    const semaphore = new Semaphore(this.config.maxConcurrency);

    const promises = batch.map(async (item) => {
      await semaphore.acquire();

      try {
        const result = await this.processItem(item, handler);
        if (result.status === "completed") {
          results.successful.push(result);
        } else {
          results.failed.push(result);
        }

        this.completedCount++;
        this.reportProgress(batch.length * totalBatches, currentBatch, totalBatches);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);

    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Process a single item with retry logic
   */
  private async processItem<T>(
    item: MigrationItem<T>,
    handler: MigrationHandler<T>
  ): Promise<MigrationItem<T>> {
    item.status = "in_progress";

    while (item.attempts < this.config.retryAttempts) {
      if (this.isCancelled) {
        item.status = "failed";
        item.error = "Migration cancelled";
        return item;
      }

      item.attempts++;

      try {
        const result = await this.withTimeout(
          handler(item.data),
          this.config.timeout
        );

        item.status = "completed";
        item.result = result;
        return item;
      } catch (error) {
        item.error = error instanceof Error ? error.message : "Unknown error";

        if (item.attempts < this.config.retryAttempts) {
          // Wait before retry with exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, item.attempts - 1);
          await this.sleep(delay);
        }
      }
    }

    item.status = "failed";
    return item;
  }

  /**
   * Create batches from items
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    });

    return Promise.race([promise, timeout]);
  }

  /**
   * Report progress to callback
   */
  private reportProgress(total: number, currentBatch: number, totalBatches: number): void {
    if (!this.config.progressCallback) return;

    const elapsed = (Date.now() - this.startTime) / 1000;
    const itemsPerSecond = this.completedCount / elapsed;
    const remaining = total - this.completedCount;
    const estimatedTimeRemaining = remaining / itemsPerSecond;

    this.config.progressCallback({
      total,
      completed: this.completedCount,
      failed: 0, // Updated after batch completes
      inProgress: this.config.maxConcurrency,
      currentBatch,
      totalBatches,
      itemsPerSecond: Math.round(itemsPerSecond * 100) / 100,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
    });
  }

  /**
   * Cancel running migration
   */
  cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Check if migration is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }
}

/**
 * Worker Pool for CPU-intensive operations
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Array<{
    task: unknown;
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private availableWorkers: Worker[] = [];

  constructor(workerScript: string, poolSize: number = 4) {
    // In browser environment with Web Workers
    // In Node.js, would use worker_threads
    for (let i = 0; i < poolSize; i++) {
      try {
        const worker = new Worker(workerScript);
        worker.onmessage = (event) => {
          this.handleWorkerMessage(worker, event.data);
        };
        worker.onerror = (error) => {
          console.error("Worker error:", error);
        };
        this.workers.push(worker);
        this.availableWorkers.push(worker);
      } catch {
        // Workers not supported
        break;
      }
    }
  }

  async execute<T, R>(task: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const worker = this.availableWorkers.pop();

      if (worker) {
        worker.postMessage(task);
        // Store task info for handling response
        (worker as any).__pending = { resolve, reject };
      } else {
        // Queue the task
        this.taskQueue.push({ task, resolve: resolve as any, reject });
      }
    });
  }

  private handleWorkerMessage(worker: Worker, result: unknown): void {
    const pending = (worker as any).__pending;
    if (pending) {
      pending.resolve(result);
      delete (worker as any).__pending;
    }

    // Check if there are queued tasks
    const nextTask = this.taskQueue.shift();
    if (nextTask) {
      worker.postMessage(nextTask.task);
      (worker as any).__pending = {
        resolve: nextTask.resolve,
        reject: nextTask.reject,
      };
    } else {
      this.availableWorkers.push(worker);
    }
  }

  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Wait for token to become available
    const waitTime = (1 / this.refillRate) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

// Export singleton
export const parallelMigrationService = new ParallelMigrationService();
