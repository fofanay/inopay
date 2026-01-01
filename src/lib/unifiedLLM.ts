/**
 * INOPAY UNIFIED LLM ADAPTER
 * ===========================
 * Adaptateur IA 100% Souverain
 * Supporte: Ollama, LM Studio, Open WebUI, API OpenAI-Compatible
 * 
 * Zéro dépendance cloud propriétaire.
 * © 2024 Inovaq Canada Inc.
 */

// Types IA Souverains
export type SovereignAIProvider = 
  | 'ollama'           // Ollama local (recommandé)
  | 'lmstudio'         // LM Studio
  | 'openwebui'        // Open WebUI  
  | 'openai-compatible' // API compatible OpenAI (self-hosted)
  | 'local'            // Modèle local embarqué
  | 'none';            // Sans IA

export interface UnifiedLLMConfig {
  provider: SovereignAIProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface UnifiedLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface UnifiedLLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: SovereignAIProvider;
  latencyMs: number;
}

export interface UnifiedLLMStreamChunk {
  content: string;
  done: boolean;
}

// Configuration par défaut selon le provider
const DEFAULT_CONFIGS: Record<SovereignAIProvider, Partial<UnifiedLLMConfig>> = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
    timeout: 60000,
  },
  lmstudio: {
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    timeout: 60000,
  },
  openwebui: {
    baseUrl: 'http://localhost:3000/api',
    model: 'llama3',
    timeout: 60000,
  },
  'openai-compatible': {
    baseUrl: 'http://localhost:8080/v1',
    model: 'gpt-3.5-turbo',
    timeout: 60000,
  },
  local: {
    baseUrl: '',
    model: 'embedded',
    timeout: 120000,
  },
  none: {
    baseUrl: '',
    model: '',
    timeout: 0,
  },
};

/**
 * Classe UnifiedLLM - Adaptateur unifié pour tous les providers IA souverains
 */
export class UnifiedLLM {
  private config: UnifiedLLMConfig;
  private retryCount: number = 0;

  constructor(config: Partial<UnifiedLLMConfig>) {
    const provider = config.provider || 'ollama';
    const defaults = DEFAULT_CONFIGS[provider];
    
    this.config = {
      provider,
      baseUrl: config.baseUrl || defaults.baseUrl || '',
      model: config.model || defaults.model || '',
      apiKey: config.apiKey,
      timeout: config.timeout || defaults.timeout || 60000,
      maxRetries: config.maxRetries || 3,
    };
  }

  /**
   * Génère une complétion simple
   */
  async complete(prompt: string, systemPrompt?: string): Promise<UnifiedLLMResponse> {
    const messages: UnifiedLLMMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    return this.chat(messages);
  }

  /**
   * Génère une complétion en mode chat
   */
  async chat(messages: UnifiedLLMMessage[]): Promise<UnifiedLLMResponse> {
    if (this.config.provider === 'none') {
      return this.createEmptyResponse();
    }

    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest(messages);
      const latencyMs = Date.now() - startTime;
      
      return {
        ...response,
        latencyMs,
        provider: this.config.provider,
      };
    } catch (error) {
      if (this.retryCount < (this.config.maxRetries || 3)) {
        this.retryCount++;
        console.warn(`[UnifiedLLM] Retry ${this.retryCount}/${this.config.maxRetries}...`);
        await this.delay(1000 * this.retryCount);
        return this.chat(messages);
      }
      throw error;
    }
  }

  /**
   * Génère une complétion en streaming
   */
  async *stream(messages: UnifiedLLMMessage[]): AsyncGenerator<UnifiedLLMStreamChunk> {
    if (this.config.provider === 'none') {
      yield { content: '', done: true };
      return;
    }

    const endpoint = this.getStreamEndpoint();
    const body = this.buildRequestBody(messages, true);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Stream error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        yield { content: '', done: true };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const chunk = this.parseStreamLine(line);
        if (chunk) {
          yield chunk;
        }
      }
    }
  }

  /**
   * Vérifie si le provider est disponible
   */
  async isAvailable(): Promise<boolean> {
    if (this.config.provider === 'none') {
      return false;
    }

    try {
      const healthEndpoint = this.getHealthEndpoint();
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Liste les modèles disponibles
   */
  async listModels(): Promise<string[]> {
    if (this.config.provider === 'none') {
      return [];
    }

    try {
      const endpoint = this.getModelsEndpoint();
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return this.parseModelsResponse(data);
    } catch {
      return [];
    }
  }

  // ============= Méthodes privées =============

  private async makeRequest(messages: UnifiedLLMMessage[]): Promise<Omit<UnifiedLLMResponse, 'latencyMs' | 'provider'>> {
    const endpoint = this.getCompletionEndpoint();
    const body = this.buildRequestBody(messages, false);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 60000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  private getCompletionEndpoint(): string {
    const { baseUrl, provider } = this.config;
    
    switch (provider) {
      case 'ollama':
        return `${baseUrl}/api/chat`;
      case 'lmstudio':
      case 'openai-compatible':
        return `${baseUrl}/chat/completions`;
      case 'openwebui':
        return `${baseUrl}/chat/completions`;
      default:
        return `${baseUrl}/v1/chat/completions`;
    }
  }

  private getStreamEndpoint(): string {
    return this.getCompletionEndpoint();
  }

  private getHealthEndpoint(): string {
    const { baseUrl, provider } = this.config;
    
    switch (provider) {
      case 'ollama':
        return `${baseUrl}/api/tags`;
      case 'lmstudio':
      case 'openai-compatible':
        return `${baseUrl}/models`;
      default:
        return `${baseUrl}/health`;
    }
  }

  private getModelsEndpoint(): string {
    const { baseUrl, provider } = this.config;
    
    switch (provider) {
      case 'ollama':
        return `${baseUrl}/api/tags`;
      case 'lmstudio':
      case 'openai-compatible':
        return `${baseUrl}/models`;
      default:
        return `${baseUrl}/v1/models`;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private buildRequestBody(messages: UnifiedLLMMessage[], stream: boolean): Record<string, unknown> {
    const { provider, model } = this.config;

    switch (provider) {
      case 'ollama':
        return {
          model,
          messages,
          stream,
        };
      case 'lmstudio':
      case 'openai-compatible':
      case 'openwebui':
      default:
        return {
          model,
          messages,
          stream,
          temperature: 0.7,
          max_tokens: 4096,
        };
    }
  }

  private parseResponse(data: Record<string, unknown>): Omit<UnifiedLLMResponse, 'latencyMs' | 'provider'> {
    const { provider, model } = this.config;

    switch (provider) {
      case 'ollama':
        return {
          content: (data.message as { content: string })?.content || '',
          usage: {
            promptTokens: (data.prompt_eval_count as number) || 0,
            completionTokens: (data.eval_count as number) || 0,
            totalTokens: ((data.prompt_eval_count as number) || 0) + ((data.eval_count as number) || 0),
          },
          model: (data.model as string) || model,
        };
      default:
        const choices = (data.choices as Array<{ message: { content: string } }>) || [];
        const usage = data.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
        return {
          content: choices[0]?.message?.content || '',
          usage: {
            promptTokens: usage?.prompt_tokens || 0,
            completionTokens: usage?.completion_tokens || 0,
            totalTokens: usage?.total_tokens || 0,
          },
          model: (data.model as string) || model,
        };
    }
  }

  private parseStreamLine(line: string): UnifiedLLMStreamChunk | null {
    if (!line.trim()) return null;
    
    // Format SSE standard
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        return { content: '', done: true };
      }
      try {
        const json = JSON.parse(data);
        
        // Format Ollama
        if (json.message?.content !== undefined) {
          return { content: json.message.content, done: json.done || false };
        }
        
        // Format OpenAI-compatible
        const content = json.choices?.[0]?.delta?.content || '';
        const done = json.choices?.[0]?.finish_reason === 'stop';
        return { content, done };
      } catch {
        return null;
      }
    }
    
    // Format Ollama natif (JSON par ligne)
    try {
      const json = JSON.parse(line);
      if (json.message?.content !== undefined) {
        return { content: json.message.content, done: json.done || false };
      }
    } catch {
      return null;
    }
    
    return null;
  }

  private parseModelsResponse(data: Record<string, unknown>): string[] {
    // Format Ollama
    if (Array.isArray(data.models)) {
      return data.models.map((m: { name?: string }) => m.name || '').filter(Boolean);
    }
    
    // Format OpenAI-compatible
    if (Array.isArray(data.data)) {
      return data.data.map((m: { id?: string }) => m.id || '').filter(Boolean);
    }
    
    return [];
  }

  private createEmptyResponse(): UnifiedLLMResponse {
    return {
      content: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'none',
      provider: 'none',
      latencyMs: 0,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============= Factory & Helpers =============

/**
 * Crée une instance UnifiedLLM avec configuration auto-détectée
 */
export function createUnifiedLLM(config?: Partial<UnifiedLLMConfig>): UnifiedLLM {
  const envConfig: Partial<UnifiedLLMConfig> = {
    provider: (import.meta.env.VITE_AI_PROVIDER as SovereignAIProvider) || 'ollama',
    baseUrl: import.meta.env.VITE_AI_BASE_URL || 'http://localhost:11434',
    model: import.meta.env.VITE_AI_MODEL || 'llama3',
    apiKey: import.meta.env.VITE_AI_API_KEY,
  };

  return new UnifiedLLM({ ...envConfig, ...config });
}

/**
 * Détecte automatiquement le provider disponible
 */
export async function detectAvailableProvider(): Promise<SovereignAIProvider | null> {
  const providers: SovereignAIProvider[] = ['ollama', 'lmstudio', 'openwebui', 'openai-compatible'];
  
  for (const provider of providers) {
    const llm = new UnifiedLLM({ provider });
    if (await llm.isAvailable()) {
      return provider;
    }
  }
  
  return null;
}

/**
 * Instance singleton pour usage global
 */
let defaultInstance: UnifiedLLM | null = null;

export function getDefaultLLM(): UnifiedLLM {
  if (!defaultInstance) {
    defaultInstance = createUnifiedLLM();
  }
  return defaultInstance;
}

export function resetDefaultLLM(): void {
  defaultInstance = null;
}

export default UnifiedLLM;
