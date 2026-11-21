/** Linear undo/redo over immutable snapshots. */
export class History<T> {
  private readonly stack: T[];
  private index = 0;
  private readonly limit: number;

  constructor(initial: T, limit = 200) {
    this.stack = [initial];
    this.limit = limit;
  }

  get current(): T {
    return this.stack[this.index];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  /** Record a new state, discarding anything that had been undone. */
  push(state: T): void {
    if (state === this.current) return;
    this.stack.length = this.index + 1;
    this.stack.push(state);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  undo(): T | null {
    if (!this.canUndo) return null;
    return this.stack[--this.index];
  }

  redo(): T | null {
    if (!this.canRedo) return null;
    return this.stack[++this.index];
  }
}
