import axios from 'axios';
import { pool } from '../db/connection';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

export interface ContentScore {
  qualityScore: number;      // 0-100
  brandScore: number;        // 0-100
  readabilityScore: number;  // 0-100
  humanScore: number;        // 0-100 (AI detection bypass likelihood)
  overallScore: number;      // weighted average
  flags: string[];
  passed: boolean;
}

const PASS_THRESHOLD = 70;

export async function scoreContent(
  content: string,
  brandProfileId: string,
  organizationId: string
): Promise<ContentScore> {
  const brandResult = await pool.query(
    'SELECT * FROM brand_profiles WHERE id = $1 AND organization_id = $2',
    [brandProfileId, organizationId]
  );
  const brandProfile = brandResult.rows[0] || null;

  try {
    const res = await axios.post(`${AI_ENGINE_URL}/score`, {
      content,
      brandProfile,
    });
    return buildScore(res.data);
  } catch {
    // Fallback: local heuristic scoring
    return localHeuristicScore(content);
  }
}

export async function saveScoreToArtifact(
  artifactId: string,
  score: ContentScore
): Promise<void> {
  await pool.query(
    `UPDATE artifacts SET metadata = metadata || $1::jsonb WHERE id = $2`,
    [JSON.stringify({ score }), artifactId]
  );

  // Update parent content request metadata too
  await pool.query(
    `UPDATE content_requests cr
     SET metadata = metadata || $1::jsonb
     FROM artifacts a
     WHERE a.id = $2 AND a.content_request_id = cr.id`,
    [
      JSON.stringify({
        qualityScore: score.qualityScore,
        brandScore: score.brandScore,
        readabilityScore: score.readabilityScore,
        overallScore: score.overallScore,
      }),
      artifactId,
    ]
  );
}

function buildScore(data: Record<string, number>): ContentScore {
  const quality = clamp(data.qualityScore ?? 0);
  const brand = clamp(data.brandScore ?? 0);
  const readability = clamp(data.readabilityScore ?? 0);
  const human = clamp(data.humanScore ?? 0);
  const overall = Math.round(quality * 0.35 + brand * 0.25 + readability * 0.2 + human * 0.2);
  const flags = data.flags as unknown as string[] ?? [];

  return {
    qualityScore: quality,
    brandScore: brand,
    readabilityScore: readability,
    humanScore: human,
    overallScore: overall,
    flags,
    passed: overall >= PASS_THRESHOLD && flags.length === 0,
  };
}

function localHeuristicScore(content: string): ContentScore {
  const wordCount = content.split(/\s+/).length;
  const sentenceCount = content.split(/[.!?]+/).filter(Boolean).length;
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Simple heuristics
  const readability = avgWordsPerSentence < 25 ? 75 : 55;
  const quality = wordCount > 100 ? 70 : 50;
  const flags: string[] = [];

  if (wordCount < 50) flags.push('content_too_short');
  if (avgWordsPerSentence > 30) flags.push('sentences_too_long');

  const overall = Math.round((quality + readability + 65 + 65) / 4);

  return {
    qualityScore: quality,
    brandScore: 65,
    readabilityScore: readability,
    humanScore: 65,
    overallScore: overall,
    flags,
    passed: overall >= PASS_THRESHOLD && flags.length === 0,
  };
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}
