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
    await query(
      `INSERT INTO agent_executions
        (id, request_id, content_request_id, agent_name, agent_type,
         status, tokens_used, duration_ms, error_message, created_at)
       VALUES ($1, $2, $2, $3, $3, $4, $5, $6, $7, NOW())`,
      [
        uuidv4(),
        requestId,
        agentName,
        status,
        data.tokensUsed ?? null,
        data.durationMs ?? null,
        data.errorMessage ?? null,
      ]
    );
  } catch (err) {
    logger.warn('Failed to log agent execution', { err, agentName });
  }
}

// ── Save Artifact ─────────────────────────────────────────────────────────────

async function saveArtifact(
  requestId: string,
  platform: string,
  contentType: string,
  body: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const id = uuidv4();

  try {
    await query(
      `INSERT INTO artifacts
        (id, request_id, platform, content_type, body, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'generated')`,
      [id, requestId, platform, contentType, body, JSON.stringify(metadata)]
    );
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

// ── Main Job Processor ────────────────────────────────────────────────────────

async function processContentJob(job: Job<ContentJobData>): Promise<void> {
  const { requestId, organizationId } = job.data;
  const startTime = Date.now();

  logger.info('🚀 Processing content job', {
    jobId: job.id,
    requestId,
    topic: job.data.topic?.slice(0, 50),
    attempt: job.attemptsMade + 1,
  });

  // Step 1: Mark as processing
  await updateRequestStatus(requestId, 'running');
  
  emitToOrg(organizationId, 'content:status', {
    requestId,
    status: 'running',
    step: 'initializing',
    progress: 5,
  });

  try {
    // Step 2: Wake up AI Engine
    emitToOrg(organizationId, 'content:status', {
      requestId,
      status: 'running',
      step: 'waking_ai_engine',
      progress: 10,
    });

    const isAwake = await wakeUpAIEngine();
    if (!isAwake) {
      throw new Error('AI Engine is not responding. Service may be down.');
    }

    // Step 3: Log start of canonical writing
    await logAgentExecution(requestId, 'canonical_writer', 'started');
    
    emitToOrg(organizationId, 'content:status', {
      requestId,
      status: 'running',
      step: 'generating_content',
      progress: 30,
    });

    // Step 4: Call full pipeline
    const pipelineStart = Date.now();
    const result = await callFullPipeline(job.data);
    const pipelineDuration = Date.now() - pipelineStart;

    logger.info('✅ Pipeline completed', {
      requestId,
      totalTokens: result.totalTokensUsed,
      artifactCount: result.artifacts.length,
      durationMs: pipelineDuration,
    });

    // Step 5: Log all agent executions
    await logAgentExecution(requestId, 'canonical_writer', 'completed', {
      tokensUsed: result.totalTokensUsed,
      durationMs: pipelineDuration,
    });

    emitToOrg(organizationId, 'content:status', {
      requestId,
      status: 'running',
      step: 'saving_results',
      progress: 90,
    });

    // Step 6: Save artifacts
    for (const artifact of result.artifacts) {
      // Canonical (once)
      if (artifact === result.artifacts[0]) {
        await saveArtifact(
          requestId,
          'canonical',
          'canonical',
          result.canonicalDraft
        );
      }

      // Platform variant
      await saveArtifact(
        requestId,
        artifact.platform,
        'platform_adapted',
        artifact.platformVariant
      );

      // Brand aligned
      await saveArtifact(
        requestId,
        artifact.platform,
        'brand_aligned',
        artifact.brandAligned
      );

      // Humanized
      if (artifact.humanized !== artifact.brandAligned) {
        await saveArtifact(
          requestId,
          artifact.platform,
          'humanized',
          artifact.humanized
        );
      }

      // Final (with QA metadata)
      await saveArtifact(
        requestId,
        artifact.platform,
        'qa_reviewed',
        artifact.finalContent,
        {
          qa: artifact.qa,
          overallScore: artifact.overallScore,
          passed: artifact.passed,
        }
      );
    }

    // Step 7: Update total tokens
    await query(
      `UPDATE content_requests
       SET total_tokens_used = $1
       WHERE id = $2`,
      [result.totalTokensUsed, requestId]
    );

    // Step 8: Mark complete
    await updateRequestStatus(requestId, 'awaiting_review');

    emitToOrg(organizationId, 'content:status', {
      requestId,
      status: 'completed',
      step: 'done',
      progress: 100,
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

    // Final attempt?
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
