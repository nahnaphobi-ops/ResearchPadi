import { childLogger } from './logger';

const log = childLogger('circuit-breaker');

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttempt: number;
}

export class CircuitBreaker {
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMax: number;

  constructor(
    failureThreshold = 5,
    resetTimeoutMs = 30000,
    halfOpenMax = 1,
  ) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMax = halfOpenMax;
  }

  private getState(key: string): CircuitBreakerState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        nextAttempt: 0,
      });
    }
    return this.circuits.get(key)!;
  }

  canExecute(key: string): boolean {
    const state = this.getState(key);

    if (state.state === 'closed') return true;

    if (state.state === 'open') {
      if (Date.now() >= state.nextAttempt) {
        state.state = 'half-open';
        log.info({ key }, 'Circuit half-open, allowing probe request');
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(key: string): void {
    const state = this.getState(key);
    if (state.state === 'half-open') {
      log.info({ key }, 'Circuit closed after successful probe');
    }
    state.failures = 0;
    state.state = 'closed';
  }

  recordFailure(key: string): void {
    const state = this.getState(key);
    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= this.failureThreshold) {
      state.state = 'open';
      state.nextAttempt = Date.now() + this.resetTimeoutMs;
      log.warn(
        { key, failures: state.failures, nextAttempt: new Date(state.nextAttempt).toISOString() },
        'Circuit opened due to consecutive failures',
      );
    }
  }

  getStateInfo(key: string): CircuitBreakerState {
    return { ...this.getState(key) };
  }
}

export const aiCircuitBreaker = new CircuitBreaker(3, 60_000, 1);
