export type LLMGenerateParams = {
  prompt: string;
  maxTokens?: number;
};

export type LLMStreamParams = {
  prompt: string;
  onToken: (token: string) => Promise<void> | void;
};

export interface LLMAdapter {
  generate(params: LLMGenerateParams): Promise<string>;
  stream(params: LLMStreamParams): Promise<string>;
}
