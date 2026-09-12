import type { ToolCall, UsageMeter } from "@/types";

/** Running tally behind the credit-burn meter the UI shows. */
export class Usage {
  private exaSpentUsd = 0;
  private exaSearches = 0;
  private llmCalls = 0;
  private hits = 0;
  private misses = 0;
  readonly calls: ToolCall[] = [];

  record(call: ToolCall) {
    this.calls.push(call);
    if (this.calls.length > 200) this.calls.shift();
    if (call.tool === "exa_search") {
      this.exaSearches += 1;
      this.exaSpentUsd += call.costUsd ?? 0;
    }
    if (call.tool === "llm") this.llmCalls += 1;
    if (call.cached) this.hits += 1;
    else this.misses += 1;
  }

  snapshot(budgetUsd: number): UsageMeter {
    const total = this.hits + this.misses;
    return {
      exaSpentUsd: Math.round(this.exaSpentUsd * 1000) / 1000,
      exaBudgetUsd: budgetUsd,
      exaSearches: this.exaSearches,
      llmCalls: this.llmCalls,
      cacheHitRate: total === 0 ? 0 : Math.round((this.hits / total) * 100) / 100,
    };
  }
}
