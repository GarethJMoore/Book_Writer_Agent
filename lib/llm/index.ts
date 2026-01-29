import { LLMAdapter } from './types';
import { OpenAIAdapter } from './openai';
import { MockAdapter } from './mock';

export function createLLMAdapter(): LLMAdapter {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    return new OpenAIAdapter(apiKey);
  }
  return new MockAdapter();
}
