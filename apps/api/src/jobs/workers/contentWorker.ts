import { Worker, Job } from 'bullmq';
import { createHash } from 'crypto';
import { redisConnection, addHumanizationJob, addQAJob } from '../queue';
import { pool } from '../../db/connection';
import axios from 'axios';

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

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

async function updateRequestStatus(requestId: string, status: string, metadata?: object) {
  await pool.query(
    `UPDATE content_requests SET status = $1, metadata = metadata || $2::jsonb, updated_at = NOW()
     WHERE id = $3`,
    [status, JSON.stringify(metadata || {}), requestId]
  );
}

async function saveArtifact(
  requestId: string,
  agentType: string,
  content: string,
  version = 1
) {
  const result = await pool.query(
    `INSERT INTO artifacts (content_request_id, agent_type, content, version, status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING id`,
    [requestId, agentType, content, version]
  );
  return result.rows[0].id;
}

async function logAgentExecution(
  requestId: string,
  agentType: string,
  status: string,
  tokensUsed: number,
  durationMs: number,
  inputHash?: string,
  outputHash?: string,
) {
  await pool.query(
    `INSERT INTO agent_executions
       (content_request_id, agent_type, status, tokens_used, duration_ms, input_hash, output_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [requestId, agentType, status, tokensUsed, durationMs, inputHash ?? null, outputHash ?? null]
  );
}

async function processContentJob(job: Job<ContentJobData>) {
  const { requestId, topic, context, targetPlatform, brandProfileId, organizationId } = job.data;

  // Fetch brand profile
  const brandResult = await pool.query(
    'SELECT * FROM brand_profiles WHERE id = $1 AND organization_id = $2',
    [brandProfileId, organizationId]
  );
  const brandProfile = brandResult.rows[0];

  await updateRequestStatus(requestId, 'running');

  // Step 1 — Agent 1: Canonical Writer (via PDL pipeline)
  await job.updateProgress(10);
  const agent1Start = Date.now();
  let canonicalDraft = '';
  const inputPayload = { topic, context, targetPlatform, brandProfileId, organizationId };
  const inputHash = sha256(JSON.stringify(inputPayload));
  try {
    const res = await axios.post(`${AI_ENGINE_URL}/agents/canonical-writer`, {
      topic,
      context,
      targetPlatform,
      brandProfile,
    });
    canonicalDraft = res.data.content;
    const tokens = res.data.tokensUsed || 0;
    const outputHash = sha256(canonicalDraft);
    await saveArtifact(requestId, 'canonical_writer', canonicalDraft);
    await logAgentExecution(requestId, 'canonical_writer', 'completed', tokens, Date.now() - agent1Start, inputHash, outputHash);
  } catch (err) {
    await logAgentExecution(requestId, 'canonical_writer', 'failed', 0, Date.now() - agent1Start, inputHash);
    await updateRequestStatus(requestId, 'failed', { failedAgent: 'canonical_writer' });
    throw err;
  }

  // Step 2 — Agent 2: Platform Optimizer
  await job.updateProgress(35);
  const agent2Start = Date.now();
  let platformVariant = '';
  try {
    const res = await axios.post(`${AI_ENGINE_URL}/agents/platform-optimizer`, {
      canonicalDraft,
      targetPlatform,
    });
    platformVariant = res.data.content;
    const tokens = res.data.tokensUsed || 0;
    await saveArtifact(requestId, 'platform_optimizer', platformVariant);
    await logAgentExecution(requestId, 'platform_optimizer', 'completed', tokens, Date.now() - agent2Start);
  } catch (err) {
    await logAgentExecution(requestId, 'platform_optimizer', 'failed', 0, Date.now() - agent2Start);
    await updateRequestStatus(requestId, 'failed', { failedAgent: 'platform_optimizer' });
    throw err;
  }

  // Step 3 — Agent 3: Brand Alignment
  await job.updateProgress(55);
  const agent3Start = Date.now();
  let brandAligned = '';
  try {
    const res = await axios.post(`${AI_ENGINE_URL}/agents/brand-optimizer`, {
      content: platformVariant,
      brandProfile,
    });
    brandAligned = res.data.content;
    const tokens = res.data.tokensUsed || 0;
    await saveArtifact(requestId, 'brand_optimizer', brandAligned);
    await logAgentExecution(requestId, 'brand_optimizer', 'completed', tokens, Date.now() - agent3Start);
  } catch (err) {
    await logAgentExecution(requestId, 'brand_optimizer', 'failed', 0, Date.now() - agent3Start);
    await updateRequestStatus(requestId, 'failed', { failedAgent: 'brand_optimizer' });
    throw err;
  }

  // Step 4 — Agent 4: Humanization
  await job.updateProgress(75);
  const humanizedArtifactId = await saveArtifact(requestId, 'humanizer', brandAligned);
  await addHumanizationJob(requestId, humanizedArtifactId);

  // Step 5 — QA (triggered after humanization completes)
  await addQAJob(requestId, humanizedArtifactId);

  await updateRequestStatus(requestId, 'awaiting_qa');
  await job.updateProgress(90);
}

export function startContentWorker() {
  const worker = new Worker<ContentJobData>(
    'content-generation',
    processContentJob,
    {
      connection: redisConnection as any,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    }
  );

  worker.on('completed', (job) => {
    console.log(`Content job ${job.id} completed for request ${job.data.requestId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Content job ${job?.id} failed:`, err.message);
  });

  return worker;
}
