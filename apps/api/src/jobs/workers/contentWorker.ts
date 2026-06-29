import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queue';
import { pool } from '../../db/connection';
import axios from 'axios';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

interface ContentJobData {
  requestId: string;
  topic: string;
  context?: string;
  targetPlatform: string;
  brandProfileId: string;
  projectId?: string;
  organizationId: string;
  createdBy: string;
}

async function updateStatus(requestId: string, status: string, metadata?: object) {
  await pool.query(
    `UPDATE content_requests SET status = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb, updated_at = NOW() WHERE id = $3`,
    [status, JSON.stringify(metadata ?? {}), requestId]
  );
}

async function processContentJob(job: Job<ContentJobData>) {
  const { requestId, topic, context, brandProfileId, organizationId } = job.data;

  // Fetch full content request from DB
  const reqResult = await pool.query('SELECT * FROM content_requests WHERE id = $1', [requestId]);
  const req = reqResult.rows[0];
  if (!req) throw new Error(`Content request ${requestId} not found`);

  // Fetch brand profile
  let brandProfile = null;
  if (brandProfileId) {
    const bpResult = await pool.query(
      'SELECT * FROM brand_profiles WHERE id = $1 AND organization_id = $2',
      [brandProfileId, organizationId]
    );
    brandProfile = bpResult.rows[0] ?? null;
  }

  await updateStatus(requestId, 'running');
  await job.updateProgress(10);

  const platforms: string[] = Array.isArray(req.platforms)
    ? req.platforms
    : JSON.parse(req.platforms || `["${job.data.targetPlatform}"]`);

  const pipelinePayload = {
    topic,
    objective: req.objective || 'Build thought leadership',
    context: context || '',
    audience: req.audience || 'General Business',
    icp_description: req.audience_description || '',
    perspective: req.narrative_perspective || 'Founder',
    writing_structure: req.writing_structure || 'thesis',
    cta: req.cta_type || '',
    targetPlatforms: platforms,
    brandProfile: brandProfile ? {
      name: brandProfile.name,
      mission: brandProfile.mission || '',
      tone: {
        formality: brandProfile.tone_formality,
        technical: brandProfile.tone_technical,
        confidence: brandProfile.tone_confidence,
        emotion: brandProfile.tone_emotion,
        humor: brandProfile.tone_humor,
        storytelling: brandProfile.tone_storytelling,
        persuasiveness: brandProfile.tone_persuasiveness,
        assertiveness: brandProfile.tone_assertiveness,
      },
      preferred_terms: brandProfile.preferred_terms ?? [],
      banned_phrases: brandProfile.banned_phrases ?? [],
    } : null,
    enableHumanization: req.humanization_enabled ?? true,
    humanizationIntensity: req.humanization_level || 'medium',
    enableQA: req.qa_enabled ?? true,
    language: req.language || 'English',
    specialInstructions: req.special_instructions || '',
  };

  let pipelineRes: any;
  try {
    pipelineRes = await axios.post(`${AI_ENGINE_URL}/pipeline/run`, pipelinePayload, {
      timeout: 300_000, // 5 min — AI can be slow on free tier
    });
  } catch (err: any) {
    const detail = err.response?.data?.detail || err.message;
    console.error(`Pipeline HTTP error for ${requestId}:`, detail);
    await updateStatus(requestId, 'failed', { error: detail });
    throw new Error(detail);
  }

  await job.updateProgress(90);

  const { artifacts, totalTokensUsed } = pipelineRes.data;

  // Save each platform artifact
  for (const artifact of artifacts ?? []) {
    await pool.query(
      `INSERT INTO artifacts (content_request_id, agent_type, content, version, status, quality_score)
       VALUES ($1, $2, $3, 1, 'ready', $4)`,
      [
        requestId,
        artifact.platform,
        artifact.finalContent,
        artifact.qa ? JSON.stringify(artifact.qa) : null,
      ]
    );
  }

  // Log the pipeline execution
  await pool.query(
    `INSERT INTO agent_executions (content_request_id, agent_type, status, tokens_used)
     VALUES ($1, 'pipeline', 'completed', $2)`,
    [requestId, totalTokensUsed ?? 0]
  );

  const needsApproval = req.requires_approval;
  await updateStatus(requestId, needsApproval ? 'awaiting_approval' : 'ready', {
    totalTokensUsed,
    artifactCount: artifacts?.length ?? 0,
  });

  await job.updateProgress(100);
}

export function startContentWorker() {
  const worker = new Worker<ContentJobData>(
    'content-generation',
    processContentJob,
    {
      connection: redisConnection as any,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3', 10),
    }
  );

  worker.on('completed', (job) => {
    console.log(`Content job ${job.id} completed — request ${job.data.requestId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Content job ${job?.id} failed:`, err.message);
  });

  return worker;
}
