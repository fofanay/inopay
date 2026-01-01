# 🚀 Inopay Liberator API Documentation

## Overview

The Inopay Liberator API provides RESTful endpoints for liberating projects from proprietary platforms. It enables automated scanning, cleaning, and packaging of projects for sovereign self-hosting.

## Base URL

```
https://izqveyvcebolrqpqlmho.supabase.co/functions/v1
```

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### POST /liberate

Initiates a new liberation job for a project.

#### Request

```bash
curl -X POST \
  https://izqveyvcebolrqpqlmho.supabase.co/functions/v1/liberate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "github",
    "data": "https://github.com/user/repo",
    "projectName": "my-project",
    "options": {
      "removeProprietaryImports": true,
      "removeProprietaryFiles": true,
      "removeTelemetry": true,
      "generatePolyfills": true,
      "includeDockerConfig": true
    }
  }'
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Source type: `zip`, `github`, or `local` |
| `data` | string | Conditional | Base64 ZIP data (for zip) or GitHub URL (for github) |
| `projectName` | string | No | Name for the project (auto-generated if not provided) |
| `options` | object | No | Liberation options (see below) |

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `removeProprietaryImports` | boolean | true | Remove proprietary import statements |
| `removeProprietaryFiles` | boolean | true | Remove proprietary config files |
| `removeTelemetry` | boolean | true | Remove telemetry/analytics code |
| `generatePolyfills` | boolean | true | Generate polyfills for removed hooks |
| `includeDockerConfig` | boolean | true | Include Dockerfile and docker-compose.yml |

#### Response

```json
{
  "success": true,
  "liberationId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Liberation job created. Use GET /audit/:id to check progress."
}
```

---

### GET /audit/:id

Retrieves the audit report and status of a liberation job.

#### Request

```bash
curl -X GET \
  "https://izqveyvcebolrqpqlmho.supabase.co/functions/v1/audit?id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "projectName": "my-project",
  "sourceType": "github",
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:32:15Z",
  "audit": {
    "score": 95,
    "grade": "A",
    "issues": {
      "critical": 0,
      "major": 2,
      "minor": 5
    },
    "recommendations": [
      "Migrate telemetry to self-hosted solution",
      "Replace cloud AI provider with local alternative"
    ],
    "owaspScore": 92,
    "sovereigntyScore": 98
  },
  "stats": {
    "filesCount": 156,
    "filesCleaned": 12,
    "proprietaryRemoved": 3
  },
  "downloadUrl": "https://..."
}
```

#### Status Values

| Status | Description |
|--------|-------------|
| `pending` | Job is queued |
| `processing` | Job is being processed |
| `cleaning` | Files are being cleaned |
| `auditing` | Audit report is being generated |
| `generating` | Liberation pack is being generated |
| `completed` | Job completed successfully |
| `failed` | Job failed (see error field) |

---

### GET /download-liberation/:id

Downloads the liberated project package.

#### Request

```bash
curl -X GET \
  "https://izqveyvcebolrqpqlmho.supabase.co/functions/v1/download-liberation?id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -o liberation-pack.zip
```

#### Response

Returns a ZIP file containing:
- Cleaned source code
- Dockerfile
- docker-compose.yml
- DEPLOY.md (deployment guide)
- liberation-report.json (audit report)
- SOVEREIGNTY_MANIFEST.json

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 404 | Not Found - Job not found or access denied |
| 500 | Internal Server Error |

## Rate Limits

- 10 liberation jobs per hour per user
- 100 audit requests per hour per user

---

## Webhooks (Coming Soon)

Configure webhooks to receive notifications when liberation jobs complete:

```json
{
  "event": "liberation.completed",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "score": 95
}
```

---

## Example: Complete Liberation Flow

```bash
# 1. Start liberation
RESPONSE=$(curl -s -X POST \
  "https://izqveyvcebolrqpqlmho.supabase.co/functions/v1/liberate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source": "github", "data": "https://github.com/user/repo"}')

JOB_ID=$(echo $RESPONSE | jq -r '.liberationId')

# 2. Poll for completion
while true; do
  STATUS=$(curl -s \
    "https://izqveyvcebolrqpqlmho.supabase.co/functions/v1/audit?id=$JOB_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  
  sleep 5
done

# 3. Download if completed
if [ "$STATUS" = "completed" ]; then
  curl -o liberation-pack.zip \
    "https://izqveyvcebolrqpqlmho.supabase.co/functions/v1/download-liberation?id=$JOB_ID" \
    -H "Authorization: Bearer $TOKEN"
fi
```

---

## Support

- Documentation: https://inopay.app/docs
- Issues: https://github.com/inopay/liberator/issues
- Email: support@inopay.app

---

*© 2024 Inovaq Canada Inc. - Libérez votre code.*
