// ============================================
// INOPAY COST OPTIMIZATION ENGINE
// Base de connaissances des services coûteux et alternatives Open Source
// ============================================

export interface CostlyServiceDefinition {
  id: string;
  name: string;
  category: "ai" | "vectordb" | "auth" | "search" | "realtime" | "email" | "storage" | "analytics" | "database";
  patterns: string[];
  envPatterns: string[];
  averageMonthlyCost: number;
  description: string;
  alternative: {
    name: string;
    dockerImage: string;
    dockerComposeSnippet: string;
    selfHostedCost: number;
    complexity: "low" | "medium" | "high";
    configTemplate: string;
    codeReplacement: {
      from: string[];
      to: string;
      instructions: string;
    };
  };
}

export interface CostlyServiceDetection {
  service: CostlyServiceDefinition;
  detectedIn: { file: string; line?: number; pattern: string; type: "dependency" | "import" | "env" | "code" }[];
  estimatedMonthlyCost: number;
}

export interface CostAnalysisResult {
  totalMonthlyCost: number;
  potentialSavings: number;
  yearlyProjection: number;
  detectedServices: CostlyServiceDetection[];
  savingsLevel: "none" | "low" | "medium" | "high";
  savingsScore: number; // 0-100
}

// Base de connaissances complète des services coûteux
export const COSTLY_SERVICES: CostlyServiceDefinition[] = [
  // =========== AI / LLM ===========
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    patterns: ["openai", "@openai/", "gpt-3", "gpt-4", "dall-e", "whisper"],
    envPatterns: ["OPENAI_API_KEY", "OPENAI_ORG_ID"],
    averageMonthlyCost: 50,
    description: "API de modèles de langage GPT-3/4, DALL-E, Whisper",
    alternative: {
      name: "Ollama",
      dockerImage: "ollama/ollama:latest",
      dockerComposeSnippet: `  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "OLLAMA_BASE_URL=http://ollama:11434",
      codeReplacement: {
        from: ["import OpenAI from 'openai'", "new OpenAI({", "openai.chat.completions.create"],
        to: "Ollama HTTP API",
        instructions: "Remplacer les appels OpenAI par des requêtes HTTP vers Ollama (/api/generate ou /api/chat)"
      }
    }
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    category: "ai",
    patterns: ["anthropic", "@anthropic-ai/", "claude-3", "claude-2"],
    envPatterns: ["ANTHROPIC_API_KEY"],
    averageMonthlyCost: 40,
    description: "API Claude d'Anthropic pour le traitement du langage",
    alternative: {
      name: "Ollama + Llama 3.1",
      dockerImage: "ollama/ollama:latest",
      dockerComposeSnippet: `  ollama:
    image: ollama/ollama:latest
    container_name: ollama-claude-alt
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "OLLAMA_BASE_URL=http://ollama:11434\nOLLAMA_MODEL=llama3.1:70b",
      codeReplacement: {
        from: ["@anthropic-ai/sdk", "Anthropic(", "anthropic.messages.create"],
        to: "Ollama HTTP API",
        instructions: "Utiliser Ollama avec un modèle Llama 3.1 comme alternative à Claude"
      }
    }
  },

  // =========== Vector DB ===========
  {
    id: "pinecone",
    name: "Pinecone",
    category: "vectordb",
    patterns: ["pinecone", "@pinecone-database/pinecone", "pinecone-client"],
    envPatterns: ["PINECONE_API_KEY", "PINECONE_ENVIRONMENT", "PINECONE_INDEX"],
    averageMonthlyCost: 70,
    description: "Base de données vectorielle cloud pour embeddings IA",
    alternative: {
      name: "PGVector (PostgreSQL)",
      dockerImage: "ankane/pgvector:latest",
      dockerComposeSnippet: `  postgres-vector:
    image: ankane/pgvector:latest
    container_name: pgvector
    restart: unless-stopped
    ports:
      - "5433:5432"
    volumes:
      - pgvector_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=vectordb
      - POSTGRES_PASSWORD=vectordb_secret
      - POSTGRES_DB=vectors`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "VECTOR_DATABASE_URL=postgresql://vectordb:vectordb_secret@postgres-vector:5432/vectors",
      codeReplacement: {
        from: ["@pinecone-database/pinecone", "PineconeClient", "pinecone.upsert", "pinecone.query"],
        to: "pg avec extension pgvector",
        instructions: "Utiliser PostgreSQL avec l'extension pgvector pour les recherches de similarité vectorielle"
      }
    }
  },
  {
    id: "weaviate",
    name: "Weaviate Cloud",
    category: "vectordb",
    patterns: ["weaviate", "weaviate-ts-client", "weaviate-client"],
    envPatterns: ["WEAVIATE_API_KEY", "WEAVIATE_URL"],
    averageMonthlyCost: 60,
    description: "Base de données vectorielle Weaviate cloud",
    alternative: {
      name: "Weaviate Self-hosted",
      dockerImage: "semitechnologies/weaviate:latest",
      dockerComposeSnippet: `  weaviate:
    image: semitechnologies/weaviate:latest
    container_name: weaviate
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - QUERY_DEFAULTS_LIMIT=25
      - AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true
      - PERSISTENCE_DATA_PATH=/var/lib/weaviate
    volumes:
      - weaviate_data:/var/lib/weaviate`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "WEAVIATE_URL=http://weaviate:8080",
      codeReplacement: {
        from: ["weaviate-ts-client"],
        to: "Weaviate self-hosted",
        instructions: "Pointer vers votre instance Weaviate self-hosted au lieu du cloud"
      }
    }
  },

  // =========== Auth ===========
  {
    id: "clerk",
    name: "Clerk",
    category: "auth",
    patterns: ["@clerk/", "clerk-sdk", "clerk.dev", "@clerk/nextjs", "@clerk/react"],
    envPatterns: ["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_CLERK"],
    averageMonthlyCost: 25,
    description: "Service d'authentification SaaS complet",
    alternative: {
      name: "Supabase Auth (Self-hosted)",
      dockerImage: "supabase/gotrue:latest",
      dockerComposeSnippet: `  auth:
    image: supabase/gotrue:v2.132.3
    container_name: supabase-auth
    restart: unless-stopped
    ports:
      - "9999:9999"
    environment:
      - GOTRUE_API_HOST=0.0.0.0
      - GOTRUE_API_PORT=9999
      - GOTRUE_DB_DRIVER=postgres
      - DATABASE_URL=postgres://supabase:secret@db:5432/supabase
      - GOTRUE_SITE_URL=http://localhost:3000
      - GOTRUE_JWT_SECRET=your-super-secret-jwt-token`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "SUPABASE_AUTH_URL=http://auth:9999\nSUPABASE_JWT_SECRET=your-super-secret",
      codeReplacement: {
        from: ["@clerk/react", "@clerk/nextjs", "useUser", "SignIn", "SignUp", "ClerkProvider"],
        to: "@supabase/supabase-js",
        instructions: "Remplacer Clerk par Supabase Auth avec useSession, signIn, signUp"
      }
    }
  },
  {
    id: "auth0",
    name: "Auth0",
    category: "auth",
    patterns: ["@auth0/", "auth0", "auth0-react", "auth0-spa-js"],
    envPatterns: ["AUTH0_SECRET", "AUTH0_CLIENT_ID", "AUTH0_DOMAIN"],
    averageMonthlyCost: 23,
    description: "Plateforme d'authentification Auth0 by Okta",
    alternative: {
      name: "PocketBase",
      dockerImage: "ghcr.io/pocketbase/pocketbase:latest",
      dockerComposeSnippet: `  pocketbase:
    image: ghcr.io/pocketbase/pocketbase:latest
    container_name: pocketbase
    restart: unless-stopped
    ports:
      - "8090:8090"
    volumes:
      - pocketbase_data:/pb_data
    command: serve --http=0.0.0.0:8090`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "POCKETBASE_URL=http://pocketbase:8090",
      codeReplacement: {
        from: ["@auth0/auth0-react", "useAuth0", "Auth0Provider"],
        to: "pocketbase SDK",
        instructions: "Utiliser PocketBase pour l'authentification avec pb.authWithPassword, pb.authWithOAuth2"
      }
    }
  },

  // =========== Search ===========
  {
    id: "algolia",
    name: "Algolia",
    category: "search",
    patterns: ["algoliasearch", "@algolia/", "instantsearch", "algolia-search"],
    envPatterns: ["ALGOLIA_API_KEY", "ALGOLIA_APP_ID", "ALGOLIA_ADMIN_KEY"],
    averageMonthlyCost: 35,
    description: "Service de recherche full-text cloud",
    alternative: {
      name: "Meilisearch",
      dockerImage: "getmeili/meilisearch:latest",
      dockerComposeSnippet: `  meilisearch:
    image: getmeili/meilisearch:latest
    container_name: meilisearch
    restart: unless-stopped
    ports:
      - "7700:7700"
    volumes:
      - meilisearch_data:/meili_data
    environment:
      - MEILI_MASTER_KEY=your-master-key
      - MEILI_ENV=production`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "MEILISEARCH_URL=http://meilisearch:7700\nMEILISEARCH_API_KEY=your-master-key",
      codeReplacement: {
        from: ["algoliasearch", "algoliaClient.initIndex", "index.search"],
        to: "meilisearch client",
        instructions: "Remplacer Algolia par Meilisearch - API très similaire"
      }
    }
  },
  {
    id: "elasticsearch",
    name: "Elastic Cloud",
    category: "search",
    patterns: ["@elastic/elasticsearch", "elasticsearch-js"],
    envPatterns: ["ELASTICSEARCH_API_KEY", "ELASTIC_CLOUD_ID"],
    averageMonthlyCost: 95,
    description: "Elasticsearch cloud managé",
    alternative: {
      name: "Elasticsearch Self-hosted",
      dockerImage: "docker.elastic.co/elasticsearch/elasticsearch:8.11.1",
      dockerComposeSnippet: `  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.1
    container_name: elasticsearch
    restart: unless-stopped
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "ELASTICSEARCH_URL=http://elasticsearch:9200",
      codeReplacement: {
        from: ["ELASTIC_CLOUD_ID"],
        to: "Elasticsearch self-hosted",
        instructions: "Pointer vers votre instance Elasticsearch locale"
      }
    }
  },

  // =========== Realtime / WebSockets ===========
  {
    id: "pusher",
    name: "Pusher",
    category: "realtime",
    patterns: ["pusher-js", "pusher", "@pusher/"],
    envPatterns: ["PUSHER_APP_KEY", "PUSHER_APP_SECRET", "PUSHER_APP_ID", "PUSHER_CLUSTER"],
    averageMonthlyCost: 49,
    description: "Service de WebSockets et messaging temps réel",
    alternative: {
      name: "Soketi",
      dockerImage: "quay.io/soketi/soketi:1.6-16-debian",
      dockerComposeSnippet: `  soketi:
    image: quay.io/soketi/soketi:1.6-16-debian
    container_name: soketi
    restart: unless-stopped
    ports:
      - "6001:6001"
      - "9601:9601"
    environment:
      - SOKETI_DEBUG=1
      - SOKETI_DEFAULT_APP_ID=app-id
      - SOKETI_DEFAULT_APP_KEY=app-key
      - SOKETI_DEFAULT_APP_SECRET=app-secret`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "PUSHER_HOST=soketi\nPUSHER_PORT=6001\nPUSHER_APP_KEY=app-key",
      codeReplacement: {
        from: ["pusher-js", "Pusher({"],
        to: "Soketi (Pusher-compatible)",
        instructions: "Soketi est 100% compatible Pusher - juste changer le host"
      }
    }
  },
  {
    id: "ably",
    name: "Ably",
    category: "realtime",
    patterns: ["ably", "ably-js", "@ably/"],
    envPatterns: ["ABLY_API_KEY"],
    averageMonthlyCost: 40,
    description: "Plateforme de messaging temps réel",
    alternative: {
      name: "Centrifugo",
      dockerImage: "centrifugo/centrifugo:v5",
      dockerComposeSnippet: `  centrifugo:
    image: centrifugo/centrifugo:v5
    container_name: centrifugo
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - ./centrifugo-config.json:/centrifugo/config.json
    command: centrifugo -c config.json`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "CENTRIFUGO_URL=http://centrifugo:8000\nCENTRIFUGO_API_KEY=your-key",
      codeReplacement: {
        from: ["ably-js", "Ably.Realtime"],
        to: "Centrifugo client",
        instructions: "Utiliser le client Centrifugo pour le messaging temps réel"
      }
    }
  },

  // =========== Email ===========
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "email",
    patterns: ["@sendgrid/mail", "@sendgrid/", "sendgrid"],
    envPatterns: ["SENDGRID_API_KEY"],
    averageMonthlyCost: 20,
    description: "Service d'envoi d'emails transactionnels",
    alternative: {
      name: "Mailpit + SMTP",
      dockerImage: "axllent/mailpit:latest",
      dockerComposeSnippet: `  mailpit:
    image: axllent/mailpit:latest
    container_name: mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "8025:8025"
    environment:
      - MP_SMTP_AUTH_ACCEPT_ANY=1
      - MP_SMTP_AUTH_ALLOW_INSECURE=1`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "SMTP_HOST=mailpit\nSMTP_PORT=1025\nSMTP_FROM=noreply@yourdomain.com",
      codeReplacement: {
        from: ["@sendgrid/mail", "sgMail.send"],
        to: "nodemailer avec SMTP",
        instructions: "Utiliser nodemailer avec un serveur SMTP self-hosted ou gratuit"
      }
    }
  },
  {
    id: "resend",
    name: "Resend",
    category: "email",
    patterns: ["resend", "@resend/"],
    envPatterns: ["RESEND_API_KEY"],
    averageMonthlyCost: 20,
    description: "API moderne d'envoi d'emails",
    alternative: {
      name: "Mailpit + SMTP",
      dockerImage: "axllent/mailpit:latest",
      dockerComposeSnippet: `  mailpit:
    image: axllent/mailpit:latest
    container_name: mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "8025:8025"`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "SMTP_HOST=mailpit\nSMTP_PORT=1025",
      codeReplacement: {
        from: ["resend", "resend.emails.send"],
        to: "nodemailer SMTP",
        instructions: "Utiliser nodemailer avec configuration SMTP"
      }
    }
  },

  // =========== Storage ===========
  {
    id: "cloudinary",
    name: "Cloudinary",
    category: "storage",
    patterns: ["cloudinary", "@cloudinary/"],
    envPatterns: ["CLOUDINARY_URL", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_CLOUD_NAME"],
    averageMonthlyCost: 45,
    description: "CDN et transformation d'images cloud",
    alternative: {
      name: "MinIO + ImgProxy",
      dockerImage: "minio/minio:latest",
      dockerComposeSnippet: `  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
  
  imgproxy:
    image: darthsim/imgproxy:latest
    container_name: imgproxy
    restart: unless-stopped
    ports:
      - "8888:8080"
    environment:
      - IMGPROXY_USE_S3=true
      - IMGPROXY_S3_ENDPOINT=http://minio:9000`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "S3_ENDPOINT=http://minio:9000\nS3_ACCESS_KEY=minioadmin\nS3_SECRET_KEY=minioadmin\nIMGPROXY_URL=http://imgproxy:8080",
      codeReplacement: {
        from: ["cloudinary", "cloudinary.uploader.upload"],
        to: "MinIO S3-compatible SDK",
        instructions: "Utiliser le SDK AWS S3 pointant vers MinIO pour le stockage"
      }
    }
  },
  {
    id: "uploadthing",
    name: "UploadThing",
    category: "storage",
    patterns: ["uploadthing", "@uploadthing/"],
    envPatterns: ["UPLOADTHING_SECRET", "UPLOADTHING_APP_ID"],
    averageMonthlyCost: 20,
    description: "Service de téléversement de fichiers",
    alternative: {
      name: "MinIO",
      dockerImage: "minio/minio:latest",
      dockerComposeSnippet: `  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "S3_ENDPOINT=http://minio:9000\nS3_ACCESS_KEY=minioadmin\nS3_SECRET_KEY=minioadmin",
      codeReplacement: {
        from: ["@uploadthing/react", "UploadButton", "UploadDropzone"],
        to: "react-dropzone + MinIO SDK",
        instructions: "Utiliser react-dropzone avec upload vers MinIO via SDK S3"
      }
    }
  },

  // =========== Analytics ===========
  {
    id: "mixpanel",
    name: "Mixpanel",
    category: "analytics",
    patterns: ["mixpanel", "mixpanel-browser"],
    envPatterns: ["MIXPANEL_TOKEN", "MIXPANEL_PROJECT_TOKEN"],
    averageMonthlyCost: 25,
    description: "Analytics produit et tracking utilisateurs",
    alternative: {
      name: "Plausible Analytics",
      dockerImage: "plausible/analytics:latest",
      dockerComposeSnippet: `  plausible:
    image: plausible/analytics:v2
    container_name: plausible
    restart: unless-stopped
    ports:
      - "8001:8000"
    environment:
      - BASE_URL=http://localhost:8001
      - SECRET_KEY_BASE=generate-a-secret-key
      - DATABASE_URL=postgres://postgres:postgres@plausible-db:5432/plausible
    depends_on:
      - plausible-db
  
  plausible-db:
    image: postgres:14-alpine
    container_name: plausible-db
    restart: unless-stopped
    volumes:
      - plausible_db_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=postgres`,
      selfHostedCost: 0,
      complexity: "medium",
      configTemplate: "PLAUSIBLE_URL=http://plausible:8000",
      codeReplacement: {
        from: ["mixpanel", "mixpanel.track"],
        to: "Plausible script",
        instructions: "Intégrer le script Plausible au lieu de Mixpanel"
      }
    }
  },
  {
    id: "amplitude",
    name: "Amplitude",
    category: "analytics",
    patterns: ["amplitude-js", "@amplitude/"],
    envPatterns: ["AMPLITUDE_API_KEY"],
    averageMonthlyCost: 0, // Free tier generous
    description: "Analytics produit Amplitude",
    alternative: {
      name: "Umami",
      dockerImage: "ghcr.io/umami-software/umami:postgresql-latest",
      dockerComposeSnippet: `  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: umami
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=postgresql://umami:umami@umami-db:5432/umami
    depends_on:
      - umami-db
  
  umami-db:
    image: postgres:14-alpine
    container_name: umami-db
    volumes:
      - umami_db_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=umami
      - POSTGRES_PASSWORD=umami
      - POSTGRES_DB=umami`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "UMAMI_URL=http://umami:3000",
      codeReplacement: {
        from: ["@amplitude/analytics-browser", "amplitude.track"],
        to: "Umami tracking",
        instructions: "Utiliser le script Umami pour le tracking"
      }
    }
  },

  // =========== Database ===========
  {
    id: "supabase_cloud",
    name: "Supabase Cloud",
    category: "database",
    patterns: [".supabase.co", "supabase.co/dashboard"],
    envPatterns: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    averageMonthlyCost: 25,
    description: "Backend Supabase cloud (base free dépassée)",
    alternative: {
      name: "Supabase Self-hosted",
      dockerImage: "supabase/postgres:15.1.0.117",
      dockerComposeSnippet: `# Voir: https://github.com/supabase/supabase/tree/master/docker
# Supabase self-hosted nécessite plusieurs services:
# - PostgreSQL avec extensions
# - GoTrue (auth)  
# - PostgREST
# - Realtime
# - Storage API
# Référez-vous à la doc officielle pour le docker-compose complet`,
      selfHostedCost: 0,
      complexity: "high",
      configTemplate: "SUPABASE_URL=http://localhost:8000\nSUPABASE_ANON_KEY=your-anon-key\nSUPABASE_SERVICE_KEY=your-service-key",
      codeReplacement: {
        from: [".supabase.co"],
        to: "Supabase self-hosted URL",
        instructions: "Pointer vers votre instance Supabase self-hosted"
      }
    }
  },
  {
    id: "planetscale",
    name: "PlanetScale",
    category: "database",
    patterns: ["@planetscale/database", "planetscale"],
    envPatterns: ["DATABASE_URL", "PLANETSCALE_"],
    averageMonthlyCost: 39,
    description: "Base MySQL serverless",
    alternative: {
      name: "Vitess Self-hosted",
      dockerImage: "vitess/lite:latest",
      dockerComposeSnippet: `  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: unless-stopped
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=app`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "DATABASE_URL=mysql://root:rootpassword@mysql:3306/app",
      codeReplacement: {
        from: ["@planetscale/database"],
        to: "mysql2 driver",
        instructions: "Utiliser le driver mysql2 standard avec votre MySQL self-hosted"
      }
    }
  },
  {
    id: "neon",
    name: "Neon",
    category: "database",
    patterns: ["@neondatabase/serverless", "neon.tech"],
    envPatterns: ["NEON_DATABASE_URL", "DATABASE_URL"],
    averageMonthlyCost: 19,
    description: "PostgreSQL serverless Neon",
    alternative: {
      name: "PostgreSQL Standard",
      dockerImage: "postgres:16-alpine",
      dockerComposeSnippet: `  postgres:
    image: postgres:16-alpine
    container_name: postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=app
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=app`,
      selfHostedCost: 0,
      complexity: "low",
      configTemplate: "DATABASE_URL=postgresql://app:secret@postgres:5432/app",
      codeReplacement: {
        from: ["@neondatabase/serverless", "neon("],
        to: "pg driver standard",
        instructions: "Utiliser le driver pg standard avec PostgreSQL self-hosted"
      }
    }
  }
];

// Catégories avec icônes et couleurs
export const COST_CATEGORIES = {
  ai: { label: "IA / LLM", icon: "🤖", color: "purple" },
  vectordb: { label: "Base Vectorielle", icon: "🧮", color: "blue" },
  auth: { label: "Authentification", icon: "🔐", color: "green" },
  search: { label: "Recherche", icon: "🔍", color: "yellow" },
  realtime: { label: "Temps Réel", icon: "⚡", color: "orange" },
  email: { label: "Email", icon: "📧", color: "pink" },
  storage: { label: "Stockage", icon: "💾", color: "cyan" },
  analytics: { label: "Analytics", icon: "📊", color: "indigo" },
  database: { label: "Base de données", icon: "🗄️", color: "gray" }
} as const;

/**
 * Analyse les fichiers pour détecter les services coûteux
 */
export function analyzeCostlyServices(
  files: Map<string, string>,
  packageJsonContent?: string
): CostAnalysisResult {
  const detectedServices: CostlyServiceDetection[] = [];
  const detectedServiceIds = new Set<string>();

  // Analyser package.json pour les dépendances
  if (packageJsonContent) {
    try {
      const pkg = JSON.parse(packageJsonContent);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      for (const service of COSTLY_SERVICES) {
        for (const pattern of service.patterns) {
          const matchingDeps = Object.keys(allDeps).filter(dep => 
            dep.toLowerCase().includes(pattern.toLowerCase())
          );
          
          for (const dep of matchingDeps) {
            if (!detectedServiceIds.has(service.id)) {
              detectedServices.push({
                service,
                detectedIn: [{ file: "package.json", pattern: dep, type: "dependency" }],
                estimatedMonthlyCost: service.averageMonthlyCost
              });
              detectedServiceIds.add(service.id);
            } else {
              const existing = detectedServices.find(d => d.service.id === service.id);
              if (existing) {
                existing.detectedIn.push({ file: "package.json", pattern: dep, type: "dependency" });
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error parsing package.json for cost analysis:", e);
    }
  }

  // Analyser les fichiers sources
  files.forEach((content, filePath) => {
    const lines = content.split("\n");
    
    for (const service of COSTLY_SERVICES) {
      // Check import patterns
      for (const pattern of service.patterns) {
        lines.forEach((line, lineIndex) => {
          if (line.includes(pattern)) {
            if (!detectedServiceIds.has(service.id)) {
              detectedServices.push({
                service,
                detectedIn: [{ 
                  file: filePath, 
                  line: lineIndex + 1, 
                  pattern, 
                  type: line.includes("import") ? "import" : "code" 
                }],
                estimatedMonthlyCost: service.averageMonthlyCost
              });
              detectedServiceIds.add(service.id);
            } else {
              const existing = detectedServices.find(d => d.service.id === service.id);
              if (existing && !existing.detectedIn.some(d => d.file === filePath && d.line === lineIndex + 1)) {
                existing.detectedIn.push({ 
                  file: filePath, 
                  line: lineIndex + 1, 
                  pattern, 
                  type: line.includes("import") ? "import" : "code" 
                });
              }
            }
          }
        });
      }

      // Check env patterns (in .env.example or source files)
      for (const envPattern of service.envPatterns) {
        if (content.includes(envPattern)) {
          if (!detectedServiceIds.has(service.id)) {
            detectedServices.push({
              service,
              detectedIn: [{ file: filePath, pattern: envPattern, type: "env" }],
              estimatedMonthlyCost: service.averageMonthlyCost
            });
            detectedServiceIds.add(service.id);
          }
        }
      }
    }
  });

  // Calculer les totaux
  const totalMonthlyCost = detectedServices.reduce((sum, s) => sum + s.estimatedMonthlyCost, 0);
  const potentialSavings = totalMonthlyCost; // 100% savings with self-hosting
  const yearlyProjection = potentialSavings * 12;

  // Déterminer le niveau d'économies
  let savingsLevel: CostAnalysisResult["savingsLevel"] = "none";
  if (potentialSavings >= 100) savingsLevel = "high";
  else if (potentialSavings >= 50) savingsLevel = "medium";
  else if (potentialSavings > 0) savingsLevel = "low";

  // Calculer le score (0-100)
  // Plus il y a de services coûteux, plus le score est bas
  // Un projet sans services coûteux a un score de 100
  const maxPossibleSavings = 500; // Cap pour le calcul du score
  const savingsScore = Math.max(0, Math.round(100 - (potentialSavings / maxPossibleSavings) * 100));

  return {
    totalMonthlyCost,
    potentialSavings,
    yearlyProjection,
    detectedServices,
    savingsLevel,
    savingsScore
  };
}

/**
 * Génère le docker-compose.yml pour les alternatives
 */
export function generateDockerComposeAlternatives(services: CostlyServiceDetection[]): string {
  const volumeNames = new Set<string>();
  const serviceSnippets: string[] = [];

  for (const detection of services) {
    serviceSnippets.push(detection.service.alternative.dockerComposeSnippet);
    
    // Extract volume names from snippet
    const volumeMatches = detection.service.alternative.dockerComposeSnippet.match(/(\w+_data):/g);
    if (volumeMatches) {
      volumeMatches.forEach(match => volumeNames.add(match.replace(":", "")));
    }
  }

  const volumes = Array.from(volumeNames).map(name => `  ${name}:`).join("\n");

  return `version: "3.8"

# ============================================
# INOPAY - Alternatives Open Source
# Généré automatiquement par le Conseiller en Économies
# ============================================

services:
${serviceSnippets.join("\n\n")}

volumes:
${volumes}

# ============================================
# Instructions de déploiement:
# 1. Copiez ce fichier dans votre projet
# 2. Lancez: docker-compose -f docker-compose.alternatives.yml up -d
# 3. Mettez à jour vos variables d'environnement
# ============================================
`;
}

/**
 * Génère les instructions de configuration pour le .env
 */
export function generateEnvTemplate(services: CostlyServiceDetection[]): string {
  const configs: string[] = [
    "# ============================================",
    "# INOPAY - Configuration des alternatives Open Source",
    "# Remplacez vos anciennes clés API par ces valeurs",
    "# ============================================",
    ""
  ];

  for (const detection of services) {
    configs.push(`# ${detection.service.name} → ${detection.service.alternative.name}`);
    configs.push(detection.service.alternative.configTemplate);
    configs.push("");
  }

  return configs.join("\n");
}
