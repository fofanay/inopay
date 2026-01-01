/**
 * SOVEREIGN AI ADAPTER
 * ====================
 * Module unifiant toutes les IA open-source souveraines
 * 
 * Providers supportés:
 * - Ollama (recommandé)
 * - LM Studio
 * - Open WebUI
 * - API OpenAI-Compatible (LocalAI, vLLM, etc.)
 * 
 * API unifiée:
 * - generateCompletion(model, prompt, options)
 * - generateEmbedding(model, input)
 * 
 * Zéro dépendance cloud propriétaire.
 * © 2024 Inovaq Canada Inc.
 */

// ============= TYPES =============

export type SovereignProvider = 
  | 'ollama'
  | 'lmstudio'
  | 'openwebui'
  | 'openai-compatible'
  | 'vllm'
  | 'localai';

export interface ProviderConfig {
  provider: SovereignProvider;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  embeddingModel?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface CompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stop?: string[];
  stream?: boolean;
  format?: 'json' | 'text';
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: SovereignProvider;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'error';
  latencyMs: number;
}

export interface EmbeddingOptions {
  dimensions?: number;
  normalize?: boolean;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: SovereignProvider;
  usage: {
    totalTokens: number;
  };
  latencyMs: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  size?: string;
  quantization?: string;
  capabilities: ('completion' | 'embedding' | 'vision')[];
}

// ============= DEFAULT CONFIGURATIONS =============

const DEFAULT_PROVIDER_CONFIGS: Record<SovereignProvider, Omit<ProviderConfig, 'provider'>> = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    embeddingModel: 'nomic-embed-text',
    timeout: 120000,
    maxRetries: 3
  },
  lmstudio: {
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    embeddingModel: 'local-embedding',
    timeout: 120000,
    maxRetries: 3
  },
  openwebui: {
    baseUrl: 'http://localhost:3000',
    defaultModel: 'llama3.2',
    embeddingModel: 'nomic-embed-text',
    timeout: 120000,
    maxRetries: 3
  },
  'openai-compatible': {
    baseUrl: 'http://localhost:8080/v1',
    defaultModel: 'gpt-3.5-turbo',
    embeddingModel: 'text-embedding-3-small',
    timeout: 60000,
    maxRetries: 3
  },
  vllm: {
    baseUrl: 'http://localhost:8000/v1',
    defaultModel: 'mistral-7b',
    embeddingModel: 'e5-large-v2',
    timeout: 120000,
    maxRetries: 3
  },
  localai: {
    baseUrl: 'http://localhost:8080/v1',
    defaultModel: 'gpt-4',
    embeddingModel: 'text-embedding-ada-002',
    timeout: 120000,
    maxRetries: 3
  }
};

// ============= SOVEREIGN AI ADAPTER CLASS =============

export class SovereignAIAdapter {
  private config: ProviderConfig;
  private retryCount: number = 0;

  constructor(config: Partial<ProviderConfig> = {}) {
    const provider = config.provider || this.detectProvider();
    const defaults = DEFAULT_PROVIDER_CONFIGS[provider];
    
    this.config = {
      provider,
      baseUrl: config.baseUrl || defaults.baseUrl,
      apiKey: config.apiKey,
      defaultModel: config.defaultModel || defaults.defaultModel,
      embeddingModel: config.embeddingModel || defaults.embeddingModel,
      timeout: config.timeout || defaults.timeout,
      maxRetries: config.maxRetries || defaults.maxRetries
    };
  }

  // ============= PUBLIC API =============

  /**
   * Génère une complétion de texte
   */
  async generateCompletion(
    model: string | null,
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<CompletionResponse> {
    const targetModel = model || this.config.defaultModel || 'llama3.2';
    const startTime = Date.now();
    
    try {
      const response = await this.executeCompletionRequest(targetModel, prompt, options);
      return {
        ...response,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      if (this.retryCount < (this.config.maxRetries || 3)) {
        this.retryCount++;
        console.warn(`[SovereignAI] Retry ${this.retryCount}/${this.config.maxRetries}...`);
        await this.delay(1000 * this.retryCount);
        return this.generateCompletion(model, prompt, options);
      }
      this.retryCount = 0;
      throw error;
    }
  }

  /**
   * Génère des embeddings vectoriels
   */
  async generateEmbedding(
    model: string | null,
    input: string | string[],
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResponse> {
    const targetModel = model || this.config.embeddingModel || 'nomic-embed-text';
    const inputs = Array.isArray(input) ? input : [input];
    const startTime = Date.now();
    
    try {
      const response = await this.executeEmbeddingRequest(targetModel, inputs, options);
      return {
        ...response,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      if (this.retryCount < (this.config.maxRetries || 3)) {
        this.retryCount++;
        console.warn(`[SovereignAI] Embedding retry ${this.retryCount}/${this.config.maxRetries}...`);
        await this.delay(1000 * this.retryCount);
        return this.generateEmbedding(model, input, options);
      }
      this.retryCount = 0;
      throw error;
    }
  }

  /**
   * Génère une complétion en streaming
   */
  async *streamCompletion(
    model: string | null,
    prompt: string,
    options: CompletionOptions = {}
  ): AsyncGenerator<StreamChunk> {
    const targetModel = model || this.config.defaultModel || 'llama3.2';
    const endpoint = this.getCompletionEndpoint();
    const body = this.buildCompletionBody(targetModel, prompt, { ...options, stream: true });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Stream error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

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
        if (chunk) yield chunk;
      }
    }
  }

  /**
   * Vérifie la disponibilité du provider
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.getHealthEndpoint(), {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Liste les modèles disponibles
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const endpoint = this.getModelsEndpoint();
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) return [];
      
      const data = await response.json();
      return this.parseModelsResponse(data);
    } catch {
      return [];
    }
  }

  /**
   * Change le provider dynamiquement
   */
  setProvider(provider: SovereignProvider, config?: Partial<ProviderConfig>): void {
    const defaults = DEFAULT_PROVIDER_CONFIGS[provider];
    this.config = {
      ...this.config,
      provider,
      baseUrl: config?.baseUrl || defaults.baseUrl,
      defaultModel: config?.defaultModel || defaults.defaultModel,
      embeddingModel: config?.embeddingModel || defaults.embeddingModel,
      ...config
    };
  }

  /**
   * Retourne la configuration actuelle
   */
  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  // ============= PRIVATE METHODS =============

  private async executeCompletionRequest(
    model: string,
    prompt: string,
    options: CompletionOptions
  ): Promise<Omit<CompletionResponse, 'latencyMs'>> {
    const endpoint = this.getCompletionEndpoint();
    const body = this.buildCompletionBody(model, prompt, options);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 120000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Completion error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return this.parseCompletionResponse(data, model);
  }

  private async executeEmbeddingRequest(
    model: string,
    inputs: string[],
    options: EmbeddingOptions
  ): Promise<Omit<EmbeddingResponse, 'latencyMs'>> {
    const endpoint = this.getEmbeddingEndpoint();
    const body = this.buildEmbeddingBody(model, inputs, options);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 60000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return this.parseEmbeddingResponse(data, model);
  }

  private getCompletionEndpoint(): string {
    const { baseUrl, provider } = this.config;
    
    switch (provider) {
      case 'ollama':
        return `${baseUrl}/api/chat`;
      case 'lmstudio':
      case 'openai-compatible':
      case 'vllm':
      case 'localai':
        return `${baseUrl}/chat/completions`;
      case 'openwebui':
        return `${baseUrl}/api/chat/completions`;
      default:
        return `${baseUrl}/v1/chat/completions`;
    }
  }

  private getEmbeddingEndpoint(): string {
    const { baseUrl, provider } = this.config;
    
    switch (provider) {
      case 'ollama':
        return `${baseUrl}/api/embeddings`;
      case 'lmstudio':
      case 'openai-compatible':
      case 'vllm':
      case 'localai':
        return `${baseUrl}/embeddings`;
      case 'openwebui':
        return `${baseUrl}/api/embeddings`;
      default:
        return `${baseUrl}/v1/embeddings`;
    }
  }

  private getHealthEndpoint(): string {
    const { baseUrl, provider } = this.config;
    
    switch (provider) {
      case 'ollama':
        return `${baseUrl}/api/tags`;
      case 'openwebui':
        return `${baseUrl}/api/health`;
      default:
        return `${baseUrl}/models`;
    }
  }

  private getModelsEndpoint(): string {
    const { baseUrl, provider } = this.config;
    
    switch (provider) {
      case 'ollama':
        return `${baseUrl}/api/tags`;
      case 'openwebui':
        return `${baseUrl}/api/models`;
      default:
        return `${baseUrl}/models`;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    return headers;
  }

  private buildCompletionBody(
    model: string,
    prompt: string,
    options: CompletionOptions
  ): Record<string, unknown> {
    const { provider } = this.config;
    
    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const baseBody: Record<string, unknown> = {
      model,
      messages,
      stream: options.stream || false
    };

    // Options communes
    if (options.temperature !== undefined) baseBody.temperature = options.temperature;
    if (options.maxTokens !== undefined) baseBody.max_tokens = options.maxTokens;
    if (options.topP !== undefined) baseBody.top_p = options.topP;
    if (options.stop) baseBody.stop = options.stop;
    
    // Options spécifiques Ollama
    if (provider === 'ollama') {
      const ollamaOptions: Record<string, unknown> = {};
      if (options.topK !== undefined) ollamaOptions.top_k = options.topK;
      if (Object.keys(ollamaOptions).length > 0) {
        baseBody.options = ollamaOptions;
      }
      if (options.format === 'json') {
        baseBody.format = 'json';
      }
    }

    // Format JSON pour OpenAI-compatible
    if (options.format === 'json' && provider !== 'ollama') {
      baseBody.response_format = { type: 'json_object' };
    }

    return baseBody;
  }

  private buildEmbeddingBody(
    model: string,
    inputs: string[],
    options: EmbeddingOptions
  ): Record<string, unknown> {
    const { provider } = this.config;

    // Ollama format
    if (provider === 'ollama') {
      return {
        model,
        prompt: inputs.length === 1 ? inputs[0] : inputs
      };
    }

    // OpenAI-compatible format
    const body: Record<string, unknown> = {
      model,
      input: inputs.length === 1 ? inputs[0] : inputs
    };

    if (options.dimensions) {
      body.dimensions = options.dimensions;
    }

    return body;
  }

  private parseCompletionResponse(
    data: Record<string, unknown>,
    model: string
  ): Omit<CompletionResponse, 'latencyMs'> {
    const { provider } = this.config;

    // Ollama format
    if (provider === 'ollama') {
      const message = data.message as { content: string } | undefined;
      return {
        content: message?.content || '',
        model: (data.model as string) || model,
        provider,
        usage: {
          promptTokens: (data.prompt_eval_count as number) || 0,
          completionTokens: (data.eval_count as number) || 0,
          totalTokens: ((data.prompt_eval_count as number) || 0) + ((data.eval_count as number) || 0)
        },
        finishReason: (data.done as boolean) ? 'stop' : 'length'
      };
    }

    // OpenAI-compatible format
    const choices = (data.choices as Array<{
      message: { content: string };
      finish_reason: string;
    }>) || [];
    const usage = data.usage as {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } | undefined;

    return {
      content: choices[0]?.message?.content || '',
      model: (data.model as string) || model,
      provider,
      usage: {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0
      },
      finishReason: (choices[0]?.finish_reason === 'stop' ? 'stop' : 'length') as 'stop' | 'length'
    };
  }

  private parseEmbeddingResponse(
    data: Record<string, unknown>,
    model: string
  ): Omit<EmbeddingResponse, 'latencyMs'> {
    const { provider } = this.config;

    // Ollama format
    if (provider === 'ollama') {
      const embedding = data.embedding as number[] | undefined;
      return {
        embeddings: embedding ? [embedding] : [],
        model: (data.model as string) || model,
        provider,
        usage: {
          totalTokens: 0 // Ollama doesn't return token count for embeddings
        }
      };
    }

    // OpenAI-compatible format
    const embeddingData = (data.data as Array<{
      embedding: number[];
      index: number;
    }>) || [];
    const usage = data.usage as { total_tokens: number } | undefined;

    return {
      embeddings: embeddingData
        .sort((a, b) => a.index - b.index)
        .map(e => e.embedding),
      model: (data.model as string) || model,
      provider,
      usage: {
        totalTokens: usage?.total_tokens || 0
      }
    };
  }

  private parseStreamLine(line: string): StreamChunk | null {
    if (!line.trim()) return null;
    
    // SSE format
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        return { content: '', done: true };
      }
      try {
        const json = JSON.parse(data);
        
        // Ollama format
        if (json.message?.content !== undefined) {
          return { content: json.message.content, done: json.done || false };
        }
        
        // OpenAI format
        const content = json.choices?.[0]?.delta?.content || '';
        const done = json.choices?.[0]?.finish_reason === 'stop';
        return { content, done };
      } catch {
        return null;
      }
    }
    
    // Ollama native JSON format
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

  private parseModelsResponse(data: Record<string, unknown>): ModelInfo[] {
    // Ollama format
    if (Array.isArray(data.models)) {
      return data.models.map((m: Record<string, unknown>) => ({
        id: (m.name as string) || '',
        name: (m.name as string) || '',
        size: m.size ? this.formatSize(m.size as number) : undefined,
        quantization: (m.details as Record<string, unknown>)?.quantization_level as string | undefined,
        capabilities: this.detectCapabilities(m)
      }));
    }
    
    // OpenAI format
    if (Array.isArray(data.data)) {
      return data.data.map((m: Record<string, unknown>) => ({
        id: (m.id as string) || '',
        name: (m.id as string) || '',
        capabilities: this.detectCapabilities(m)
      }));
    }
    
    return [];
  }

  private detectCapabilities(model: Record<string, unknown>): ModelInfo['capabilities'] {
    const caps: ModelInfo['capabilities'] = ['completion'];
    const name = ((model.name || model.id) as string || '').toLowerCase();
    
    // Detect embedding models
    if (name.includes('embed') || name.includes('e5') || name.includes('bge')) {
      caps.push('embedding');
    }
    
    // Detect vision models
    if (name.includes('vision') || name.includes('llava') || name.includes('bakllava')) {
      caps.push('vision');
    }
    
    return caps;
  }

  private formatSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)}GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  }

  private detectProvider(): SovereignProvider {
    // Try to detect from environment
    const envProvider = (
      typeof import.meta !== 'undefined' 
        ? import.meta.env?.VITE_AI_PROVIDER 
        : undefined
    ) as SovereignProvider | undefined;
    
    if (envProvider && Object.keys(DEFAULT_PROVIDER_CONFIGS).includes(envProvider)) {
      return envProvider;
    }
    
    // Default to Ollama
    return 'ollama';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============= FACTORY FUNCTIONS =============

/**
 * Crée un adaptateur avec configuration auto-détectée
 */
export function createSovereignAI(config?: Partial<ProviderConfig>): SovereignAIAdapter {
  const envConfig: Partial<ProviderConfig> = {};
  
  if (typeof import.meta !== 'undefined') {
    envConfig.provider = import.meta.env?.VITE_AI_PROVIDER as SovereignProvider;
    envConfig.baseUrl = import.meta.env?.VITE_AI_BASE_URL;
    envConfig.apiKey = import.meta.env?.VITE_AI_API_KEY;
    envConfig.defaultModel = import.meta.env?.VITE_AI_MODEL;
    envConfig.embeddingModel = import.meta.env?.VITE_AI_EMBEDDING_MODEL;
  }

  return new SovereignAIAdapter({ ...envConfig, ...config });
}

/**
 * Détecte automatiquement le provider disponible
 */
export async function detectAvailableSovereignProvider(): Promise<SovereignProvider | null> {
  const providers: SovereignProvider[] = ['ollama', 'lmstudio', 'openwebui', 'openai-compatible', 'vllm', 'localai'];
  
  for (const provider of providers) {
    const adapter = new SovereignAIAdapter({ provider });
    if (await adapter.isAvailable()) {
      return provider;
    }
  }
  
  return null;
}

/**
 * Raccourci pour générer une complétion
 */
export async function generateCompletion(
  model: string | null,
  prompt: string,
  options?: CompletionOptions & Partial<ProviderConfig>
): Promise<CompletionResponse> {
  const { provider, baseUrl, apiKey, ...completionOptions } = options || {};
  const adapter = new SovereignAIAdapter({ provider, baseUrl, apiKey });
  return adapter.generateCompletion(model, prompt, completionOptions);
}

/**
 * Raccourci pour générer des embeddings
 */
export async function generateEmbedding(
  model: string | null,
  input: string | string[],
  options?: EmbeddingOptions & Partial<ProviderConfig>
): Promise<EmbeddingResponse> {
  const { provider, baseUrl, apiKey, ...embeddingOptions } = options || {};
  const adapter = new SovereignAIAdapter({ provider, baseUrl, apiKey });
  return adapter.generateEmbedding(model, input, embeddingOptions);
}

// ============= SINGLETON INSTANCE =============

let defaultAdapter: SovereignAIAdapter | null = null;

export function getDefaultAdapter(): SovereignAIAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createSovereignAI();
  }
  return defaultAdapter;
}

export function resetDefaultAdapter(): void {
  defaultAdapter = null;
}

// Default export
export default SovereignAIAdapter;
