import { LLMAdapter, LLMGenerateParams, LLMStreamParams } from './types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIAdapter implements LLMAdapter {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(params: LLMGenerateParams): Promise<string> {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: params.prompt }],
        max_tokens: params.maxTokens ?? 800
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${error}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message?.content ?? '';
  }

  async stream(params: LLMStreamParams): Promise<string> {
    // v0: stream just calls generate, then feeds tokens in chunks.
    const content = await this.generate({ prompt: params.prompt });
    const tokens = content.split(/(\s+)/).filter(Boolean);
    for (const token of tokens) {
      await params.onToken(token);
    }
    return content;
  }
}
