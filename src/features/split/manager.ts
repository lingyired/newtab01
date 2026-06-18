import type { SplitEngine, SplitLayout, SplitHandle } from './types';
import { IframeSplitEngine } from './iframe-engine';

class SplitEngineManager {
  private engines = new Map<string, SplitEngine>();
  private fallback = 'iframe';

  register(engine: SplitEngine): void {
    this.engines.set(engine.id, engine);
  }

  async open(urls: string[], layout: SplitLayout, prefer?: 'iframe' | 'native', title?: string): Promise<SplitHandle> {
    const id = prefer && this.engines.has(prefer) ? prefer : this.fallback;
    const engine = this.engines.get(id);
    if (!engine) {
      throw new Error(`Split engine "${id}" not registered`);
    }
    return engine.open(urls, layout, title);
  }

  async close(handle: SplitHandle): Promise<void> {
    const engine = this.engines.get(handle.kind === 'iframe-page' ? 'iframe' : 'native');
    if (!engine) {
      throw new Error(`Split engine for handle kind "${handle.kind}" not registered`);
    }
    return engine.close(handle);
  }
}

export const splitManager = new SplitEngineManager();

// Register default engine
splitManager.register(new IframeSplitEngine());
