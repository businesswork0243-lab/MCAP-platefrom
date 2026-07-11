import { Worker, Job } from 'bullmq';
import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/connection';
import { logger } from '../../lib/logger';
import { ContentJobData } from '../queue';
import { emitToOrg } from '../../services/websocket';

// ── AI Engine Config ───────────────────────────────────────────────────────────

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 180_000; // 3 min

// ── Redis Connection ───────────────────────────────────────────────────────────

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return {
      url: redisUrl,
      enableReadyCheck: false,
      maxRetriesPerRequest: null as unknown as number,
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    enableReadyCheck: false,
    maxRetriesPerRequest: null as unknown as number,
  };
}

// ── Wake Up AI Engine (Free Tier Fix) ─────────────────────────────────────────

async function wakeUpAIEngine(): Promise<boolean> {
  logger.info('Pinging AI Engine to wake it up...');
  
  const maxAttempts = 6; // 6 attempts * 15s = 90 seconds max wait
  
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await axios.get(`${AI_ENGINE_URL}/health`, { timeout: 15_000 });
      logger.info(`✅ AI Engine is awake (attempt ${i})`);
      return true;
    } catch (err) {
      logger.warn(`⏳ AI Engine waking up... attempt ${i}/${maxAttempts}`);
      if (i < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 15_000));
      }
    }
  }
  
  logger.error('❌ AI Engine failed to wake up after 90s');
  return false;
}

// ── Update Status Helper ──────────────────────────────────────────────────────

async function updateRequestStatus(
  requestId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  try {
    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: unknown[] = [status, errorMessage ?? null, requestId];
    
    if (status === 'completed' || status === 'approved') {
      updates.push('completed_at = NOW()');
    }
    if (status === 'processing' || status === 'running') {
      updates.push(`processing_started_at = COALESCE(processing_started_at, NOW())`);
    }
    
    await query(
      `UPDATE content_requests
       SET ${updates.join(', ')},
           error_message = $2
       WHERE id = $3`,
      params
    );
  } catch (err) {
    logger.error('Failed to update status:', { requestId, status, err });
  }
}

// ── Log Agent Execution ───────────────────────────────────────────────────────

async function logAgentExecution(
  requestId: string,
  agentName: string,
  status: 'started' | 'completed' | 'failed',
  data: { tokensUsed?: number; durationMs?: number; errorMessage?: string } = {}
): Promise<void> {
  try {
    // ✅ FIXED: Explicit type casts to avoid type mismatch
    await query(
      `INSERT INTO agent_executions
        (id, content_request_id, request_id, agent_name, agent_type,
         status, tokens_used, duration_ms, error_message, created_at)
       VALUES ($1::uuid, $2::uuid, $2::uuid, $3::varchar, $3::text,
               $4::text, $5::integer, $6::integer, $7::text, NOW())`,
      [
        uuidv4(),
        requestId,
        agentName,           // Used for both agent_name and agent_type
        status,
        data.tokensUsed ?? null,
        data.durationMs ?? null,
        data.errorMessage ?? null,
      ]
    );
  } catch (err) {
    // Non-critical - just log warning
    logger.warn('Failed to log agent execution', { 
      err: err instanceof Error ? err.message : err, 
      agentName 
    });
  }
}

// ── Save Artifact (CRITICAL - includes platform in metadata) ─────────────────

async function saveArtifact(
  requestId: string,
  platform: string,
  contentType: string,
  body: string,
  extraMetadata: Record<string, unknown> = {}
): Promise<string> {
  const id = uuidv4();

  const metadata = {
    platform,           // ← CRITICAL: Store platform here
    contentType,        // ← Also store type
    ...extraMetadata,
  };

  try {
    await query(
      `INSERT INTO artifacts
        (id, content_request_id, agent_type, content, status, metadata, version)
       VALUES ($1, $2, $3, $4, 'generated', $5, 1)`,
      [
        id,
        requestId,
        contentType,                    // agent_type
        body,                           // content
        JSON.stringify(metadata),       // metadata (with platform!)
      ]
    );
    
    logger.debug('Artifact saved', { 
      id, 
      requestId, 
      platform, 
      contentType,
      bodyLength: body.length 
    });
    
    return id;
  } catch (err) {
    logger.error('Failed to save artifact:', { requestId, platform, err });
    throw err;
  }
}

// ── Call AI Engine (Full Pipeline) ────────────────────────────────────────────

interface PipelineResponse {
  artifacts: Array<{
    platform: string;
    finalContent: string;
    canonicalDraft: string;
    platformVariant: string;
    brandAligned: string;
    humanized: string;
    qa: Record<string, unknown>;
    overallScore: number;
    passed: boolean;
  }>;
  canonicalDraft: string;
  totalTokensUsed: number;
}

async function callFullPipeline(
  jobData: ContentJobData
): Promise<PipelineResponse> {
  const payload = {
    topic:                 jobData.topic,
    objective:             jobData.objective || 'Build thought leadership',
    context:               jobData.context || '',
    audience:              jobData.audience || 'General Business',
    icp_description:       jobData.icp_description || '',
    perspective:           jobData.perspective || 'Founder',
    writing_structure:     jobData.writing_structure || 'thesis',
    cta:                   jobData.cta || '',
    targetPlatforms:       jobData.targetPlatforms || ['linkedin_post'],
    brandProfile:          jobData.brandProfile,
    enableHumanization:    jobData.enableHumanization ?? true,
    humanizationIntensity: jobData.humanizationIntensity || 'medium',
    enableQA:              jobData.enableQA ?? true,
    language:              jobData.language || 'English',
    keywords:              jobData.keywords || [],
    specialInstructions:   jobData.specialInstructions || '',
    seoEnabled:            jobData.seoEnabled ?? false,
    seoSettings:           jobData.seoSettings || {},
  };

  logger.info('Calling AI Engine /pipeline/run', {
    url: `${AI_ENGINE_URL}/pipeline/run`,
    topic: payload.topic.slice(0, 50),
    platforms: payload.targetPlatforms,
  });

  const response = await axios.post(
    `${AI_ENGINE_URL}/pipeline/run`,
    payload,
    {
      timeout: AI_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

// ── Progress Milestones ────────────────────────────────────────────────────────
const PROGRESS = {
  QUEUED:              5,
  WAKING_AI:           10,
  FETCHING_BRAND:      20,
  CANONICAL_START:     30,
  CANONICAL_DONE:      45,
  PLATFORM_START:      50,
  PLATFORM_DONE:       65,
  BRAND_START:         70,
  BRAND_DONE:          78,
  HUMANIZE_START:      82,
  HUMANIZE_DONE:       90,
  QA_START:            92,
  QA_DONE:             96,
  SAVING:              98,
  COMPLETE:            100,
} as const;

// Helper to emit progress
function emitProgress(
  orgId: string,
  requestId: string,
  progress: number,
  step: string,
  extra: Record<string, unknown> = {}
): void {
  emitToOrg(orgId, 'content:progress', {
    requestId,
    progress,
    step,
    ...extra,
  });
  
  logger.debug('Progress emitted', { requestId, progress, step });
}

// ── Main Job Processor (UPDATED) ──────────────────────────────────────────────

async function processContentJob(job: Job<ContentJobData>): Promise<void> {
  const { requestId, organizationId } = job.data;
  const startTime = Date.now();

  logger.info('🚀 Processing content job', {
    jobId: job.id,
    requestId,
    topic: job.data.topic?.slice(0, 50),
    attempt: job.attemptsMade + 1,
  });

  // Step 1: Queued
  await updateRequestStatus(requestId, 'running');
  emitProgress(organizationId, requestId, PROGRESS.QUEUED, 'initializing');

  try {
    // Step 2: Wake AI Engine
    emitProgress(organizationId, requestId, PROGRESS.WAKING_AI, 'waking_ai_engine');

    const isAwake = await wakeUpAIEngine();
    if (!isAwake) {
      throw new Error('AI Engine is not responding. Service may be down.');
    }

    // Step 3: Fetching context
    emitProgress(organizationId, requestId, PROGRESS.FETCHING_BRAND, 'fetching_brand_context');
    
    // Small delay for UI feedback
    await new Promise(r => setTimeout(r, 500));

    // Step 4: Start canonical writing
    emitProgress(organizationId, requestId, PROGRESS.CANONICAL_START, 'writing_canonical_draft');
    await logAgentExecution(requestId, 'canonical_writer', 'started');

    // Step 5: Call full pipeline (this takes ~30-40 seconds)
    const pipelineStart = Date.now();
    
    // Emit intermediate progress during pipeline call
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - pipelineStart;
      
      if (elapsed < 8000) {
        // 0-8s: Canonical writing (30-45%)
        emitProgress(organizationId, requestId, PROGRESS.CANONICAL_START + Math.floor(elapsed / 8000 * 15), 'writing_canonical_draft');
      } else if (elapsed < 15000) {
        // 8-15s: Platform optimization (50-65%)
        emitProgress(organizationId, requestId, PROGRESS.PLATFORM_START + Math.floor((elapsed - 8000) / 7000 * 15), 'platform_optimization');
      } else if (elapsed < 22000) {
        // 15-22s: Brand alignment (70-78%)
        emitProgress(organizationId, requestId, PROGRESS.BRAND_START + Math.floor((elapsed - 15000) / 7000 * 8), 'brand_alignment');
      } else if (elapsed < 30000) {
        // 22-30s: Humanization (82-90%)
        emitProgress(organizationId, requestId, PROGRESS.HUMANIZE_START + Math.floor((elapsed - 22000) / 8000 * 8), 'humanizing_content');
      } else {
        // 30s+: QA (92-96%)
        emitProgress(organizationId, requestId, Math.min(96, PROGRESS.QA_START + Math.floor((elapsed - 30000) / 10000 * 4)), 'quality_assurance');
      }
    }, 1500); // Update every 1.5 seconds

    let result;
    try {
      result = await callFullPipeline(job.data);
    } finally {
      clearInterval(progressInterval);
    }

    const pipelineDuration = Date.now() - pipelineStart;

    logger.info('✅ Pipeline completed', {
      requestId,
      totalTokens: result.totalTokensUsed,
      artifactCount: result.artifacts.length,
      durationMs: pipelineDuration,
    });

    await logAgentExecution(requestId, 'canonical_writer', 'completed', {
      tokensUsed: result.totalTokensUsed,
      durationMs: pipelineDuration,
    });

    // Step 6: Saving results
    emitProgress(organizationId, requestId, PROGRESS.SAVING, 'saving_results', {
      artifactCount: result.artifacts.length,
      totalTokens: result.totalTokensUsed,
    });

    // Save artifacts (existing code)
    for (const artifact of result.artifacts) {
      if (artifact === result.artifacts[0]) {
        await saveArtifact(requestId, 'canonical', 'canonical', result.canonicalDraft);
      }

      await saveArtifact(requestId, artifact.platform, 'platform_adapted', artifact.platformVariant);
      await saveArtifact(requestId, artifact.platform, 'brand_aligned', artifact.brandAligned);

      if (artifact.humanized !== artifact.brandAligned) {
        await saveArtifact(requestId, artifact.platform, 'humanized', artifact.humanized);
      }

      await saveArtifact(requestId, artifact.platform, 'qa_reviewed', artifact.finalContent, {
        qa: artifact.qa,
        overallScore: artifact.overallScore,
        passed: artifact.passed,
      });
    }

    // Update tokens
    await query(
      `UPDATE content_requests SET total_tokens_used = $1 WHERE id = $2`,
      [result.totalTokensUsed, requestId]
    );

    await updateRequestStatus(requestId, 'awaiting_review');

    // Step 7: Complete!
    emitProgress(organizationId, requestId, PROGRESS.COMPLETE, 'completed', {
      artifactCount: result.artifacts.length,
      totalTokens: result.totalTokensUsed,
    });

    emitToOrg(organizationId, 'content:completed', {
      requestId,
      artifactCount: result.artifacts.length,
      totalTokens: result.totalTokensUsed,
    });

    logger.info('🎉 Content job completed', {
      requestId,
      totalDurationMs: Date.now() - startTime,
      tokens: result.totalTokensUsed,
    });

  } catch (err) {
    const error = err as AxiosError;
    let errorMsg = 'Unknown error';

    if (error.isAxiosError) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorMsg = 'AI Engine timeout - taking too long to respond';
      } else if (error.response) {
        errorMsg = `AI Engine error [${error.response.status}]: ${
          typeof error.response.data === 'object'
            ? JSON.stringify(error.response.data).slice(0, 300)
            : String(error.response.data).slice(0, 300)
        }`;
      } else if (error.request) {
        errorMsg = 'AI Engine unreachable - service may be down';
      } else {
        errorMsg = error.message;
      }
    } else if (err instanceof Error) {
      errorMsg = err.message;
    }

    logger.error('❌ Content job failed', {
      requestId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      error: errorMsg,
    });

    await logAgentExecution(requestId, 'canonical_writer', 'failed', {
      errorMessage: errorMsg,
      durationMs: Date.now() - startTime,
    });

    const maxAttempts = job.opts.attempts || 3;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await updateRequestStatus(requestId, 'generation_failed', errorMsg);
      emitToOrg(organizationId, 'content:failed', {
        requestId,
        error: errorMsg,
      });
    } else {
      logger.info(`⏳ Will retry (${job.attemptsMade + 1}/${maxAttempts})`, { requestId });
    }

    throw err;
  }
}

// ── Start Worker ──────────────────────────────────────────────────────────────

export function startContentWorker(): void {
  const worker = new Worker<ContentJobData>(
    'content-generation',
    processContentJob,
    {
      connection: getRedisConnection(),
      concurrency: Number(process.env.WORKER_CONCURRENCY) || 2,
      limiter: {
        max: 5,
        duration: 60_000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info('Worker: Job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Worker: Job failed', {
      jobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Worker error:', { error: err.message });
  });

  worker.on('active', (job) => {
    logger.info('Worker: Job started', { jobId: job.id, requestId: job.data.requestId });
  });

  logger.info('✅ Content worker started', {
    concurrency: worker.opts.concurrency,
    aiEngineUrl: AI_ENGINE_URL,
    timeout: `${AI_TIMEOUT_MS}ms`,
  });

  process.on('SIGTERM', async () => {
    logger.info('Closing worker...');
    await worker.close();
  });
}
