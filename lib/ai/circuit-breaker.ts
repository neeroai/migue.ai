/**
 * @file circuit-breaker.ts
 * @description Circuit breaker pattern for multi-provider resilience
 * @module lib/ai
 * @exports CircuitBreaker, circuitBreaker
 * @date 2026-01-30 14:00
 * @updated 2026-01-30 14:00
 */

type Provider = 'google' | 'cohere' | 'openai' | 'deepseek' | 'mistral' | 'anthropic';

interface CircuitState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
}

/**
 * Circuit breaker for provider failure management
 *
 * Behavior:
 * - Track failures per provider
 * - Open circuit after 3 failures in 5 min window
 * - Auto-reset after 10 min cooldown
 * - Switch to fallback when circuit open
 */
export class CircuitBreaker {
  private circuits: Map<Provider, CircuitState>;
  private readonly FAILURE_THRESHOLD = 3;
  private readonly FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly RESET_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.circuits = new Map();
  }

  /**
   * Check if provider can handle requests
   *
   * @param provider - Provider name
   * @returns true if circuit closed (can use), false if open (use fallback)
   */
  canRequest(provider: Provider): boolean {
    const state = this.getState(provider);

    // Circuit closed - allow request
    if (!state.isOpen) {
      return true;
    }

    // Check if reset timeout elapsed
    if (state.lastFailure && Date.now() - state.lastFailure > this.RESET_TIMEOUT_MS) {
      this.resetCircuit(provider);
      return true;
    }

    // Circuit still open
    return false;
  }

  /**
   * Record successful request
   *
   * @param provider - Provider name
   */
  recordSuccess(provider: Provider): void {
    const state = this.getState(provider);

    // Reset failures on success
    state.failures = 0;
    state.isOpen = false;

    this.circuits.set(provider, state);
  }

  /**
   * Record failed request
   *
   * @param provider - Provider name
   */
  recordFailure(provider: Provider): void {
    const state = this.getState(provider);
    const now = Date.now();

    // Reset if outside failure window
    if (state.lastFailure && now - state.lastFailure > this.FAILURE_WINDOW_MS) {
      state.failures = 1;
    } else {
      state.failures += 1;
    }

    state.lastFailure = now;

    // Open circuit if threshold exceeded
    if (state.failures >= this.FAILURE_THRESHOLD) {
      state.isOpen = true;
      console.warn(`[Circuit Breaker] Circuit OPEN for ${provider} (${state.failures} failures)`);
    }

    this.circuits.set(provider, state);
  }

  /**
   * Manually reset circuit
   *
   * @param provider - Provider name
   */
  resetCircuit(provider: Provider): void {
    this.circuits.set(provider, {
      failures: 0,
      lastFailure: null,
      isOpen: false
    });

    console.log(`[Circuit Breaker] Circuit RESET for ${provider}`);
  }

  /**
   * Get circuit state for provider
   *
   * @param provider - Provider name
   * @returns Current circuit state
   */
  private getState(provider: Provider): CircuitState {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        failures: 0,
        lastFailure: null,
        isOpen: false
      });
    }

    return this.circuits.get(provider)!;
  }

  /**
   * Get all circuit states (for monitoring)
   *
   * @returns Map of provider to circuit state
   */
  getCircuitStates(): Map<Provider, CircuitState> {
    return new Map(this.circuits);
  }

  /**
   * Get health status for provider
   *
   * @param provider - Provider name
   * @returns Health status object
   */
  getHealthStatus(provider: Provider): {
    status: 'healthy' | 'degraded' | 'down';
    failures: number;
    isOpen: boolean;
  } {
    const state = this.getState(provider);

    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (state.isOpen) {
      status = 'down';
    } else if (state.failures > 0) {
      status = 'degraded';
    }

    return {
      status,
      failures: state.failures,
      isOpen: state.isOpen
    };
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker();
