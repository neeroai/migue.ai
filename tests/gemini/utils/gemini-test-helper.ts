import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export type GeminiModelName = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro';

export function getGeminiTestClient(model: GeminiModelName = 'gemini-2.5-flash'): GenerativeModel {
  const apiKey: string | undefined = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not set in .env.local');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

export async function measureLatency<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latency: number }> {
  const start = Date.now();
  const result = await fn();
  const latency = Date.now() - start;
  return { result, latency };
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate limit helper (10 RPM = 1 request cada 6 segundos)
export async function respectRateLimit() {
  await delay(6000); // 6 segundos entre requests
}

export interface TestMetrics {
  passed: number;
  failed: number;
  totalLatency: number;
  avgLatency: number;
  errors: string[];
}

export class MetricsCollector {
  private metrics: TestMetrics = {
    passed: 0,
    failed: 0,
    totalLatency: 0,
    avgLatency: 0,
    errors: []
  };

  recordSuccess(latency: number) {
    this.metrics.passed++;
    this.metrics.totalLatency += latency;
    this.updateAverage();
  }

  recordFailure(error: string, latency: number | undefined = undefined) {
    this.metrics.failed++;
    if (latency !== undefined) {
      this.metrics.totalLatency += latency;
    }
    this.metrics.errors.push(error);
    this.updateAverage();
  }

  private updateAverage() {
    const total = this.metrics.passed + this.metrics.failed;
    this.metrics.avgLatency = this.metrics.totalLatency / total;
  }

  getReport(): TestMetrics {
    return { ...this.metrics };
  }

  printReport() {
    console.log('\n=== Test Metrics Report ===');
    console.log(`Passed: ${this.metrics.passed}`);
    console.log(`Failed: ${this.metrics.failed}`);
    console.log(`Success Rate: ${(this.metrics.passed / (this.metrics.passed + this.metrics.failed) * 100).toFixed(1)}%`);
    console.log(`Avg Latency: ${this.metrics.avgLatency.toFixed(0)}ms`);

    if (this.metrics.errors.length > 0) {
      console.log('\nErrors:');
      this.metrics.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
    }
  }
}
