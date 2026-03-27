/**
 * aiController.js – Chat endpoint handler.
 *
 * Orchestrates: context assembly → multi-agent pipeline → file apply → SSE stream response.
 * Uses Server-Sent Events (SSE) so the UI can stream partial responses.
 */

import fs from 'fs';
import path from 'path';
import { runAgentPipeline } from '../services/agentService.js';
import { applyActions, getProjectDir } from '../services/fileService.js';
import { validatePath } from '../utils/pathValidator.js';

/**
 * POST /api/projects/:id/chat
 * Body: { message: string, history?: [{role, content}] }
 *
 * Streams response as SSE:
 *   data: {"type":"status","text":"..."}
 *   data: {"type":"explanation","text":"..."}
 *   data: {"type":"action","action":{...}}
 *   data: {"type":"done","appliedCount":N}
 *   data: {"type":"error","text":"..."}
 */
export async function handleChat(req, res) {
  const { id: projectId } = req.params;
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

  function send(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // Load project metadata
    const projectDir = getProjectDir(projectId);
    const metaPath = path.join(projectDir, 'project.json');
    let projectMeta = { name: projectId };
    try { projectMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch {}

    send({ type: 'status', text: '🔍 Analysing your request...' });

    // Run multi-agent pipeline
    send({ type: 'status', text: '🤖 PlannerAgent is decomposing the task...' });

    const { explanation, actions } = await runAgentPipeline(
      projectId, message, history, projectMeta
    );

    send({ type: 'status', text: '✅ ReviewAgent approved the changes. Applying...' });

    // Send each action for UI display
    for (const action of actions) {
      send({ type: 'action', action: { type: action.type, path: action.path } });
    }

    // Apply file actions
    const applied = await applyActions(projectId, actions);

    // Persist chat to project.json
    try {
      projectMeta.chatHistory = [
        ...(projectMeta.chatHistory || []).slice(-50), // keep last 50 pairs
        { role: 'user', content: message },
        { role: 'assistant', content: explanation }
      ];
      fs.writeFileSync(metaPath, JSON.stringify(projectMeta, null, 2), 'utf-8');
    } catch {}

    send({ type: 'explanation', text: explanation });
    send({ type: 'done', appliedCount: applied.length });
    res.end();
  } catch (err) {
    console.error('[aiController] Error:', err.message);
    send({ type: 'error', text: err.message });
    res.end();
  }
}
