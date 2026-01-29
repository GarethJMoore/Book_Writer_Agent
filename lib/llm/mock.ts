import { LLMAdapter, LLMGenerateParams, LLMStreamParams } from './types';

export class MockAdapter implements LLMAdapter {
  async generate(params: LLMGenerateParams): Promise<string> {
    return this.generateMock(params.prompt);
  }

  async stream(params: LLMStreamParams): Promise<string> {
    const content = this.generateMock(params.prompt);
    const tokens = content.split(/(\s+)/).filter(Boolean);
    for (const token of tokens) {
      await params.onToken(token);
    }
    return content;
  }

  private generateMock(prompt: string) {
    if (prompt.includes('OUTLINE')) {
      return [
        '1. Opening: Why this idea matters',
        '2. Core Concepts and Definitions',
        '3. Practical Strategies and Examples',
        '4. Common Pitfalls and Fixes',
        '5. Closing: Roadmap and Next Steps'
      ].join('\n');
    }
    if (prompt.includes('DIFF_SUMMARY')) {
      return 'Adjusted banned phrases, added citations placeholders, shortened long sentences.';
    }
    return [
      'This chapter delivers a structured exploration of the topic, using clear headings and short paragraphs.',
      'It includes practical guidance, narrative examples, and a focused tone aligned with the style guide.',
      'Factual claims use inline citations like [S1] when needed.'
    ].join('\n\n');
  }
}
