export interface TriageEngineInput {
  title: string;
  description: string;
}

export interface TriageEngine {
  classify(input: TriageEngineInput): Promise<unknown>;
}
