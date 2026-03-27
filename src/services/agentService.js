/**
 * agentService.js – Multi-agent AI orchestration.
 *
 * Pipeline:
 *   PlannerAgent  → decomposes user request into tasks
 *   CoderAgent    → generates FileAction[] for each task
 *   ReviewAgent   → validates and refines the actions
 *
 * All agents use OpenAI-compatible function calling.
 * Compatible with: OpenAI, Azure OpenAI, LocalAI, Ollama (openai-compat).
 */

import { getFileTree } from './fileService.js';

const BASE_URL  = () => process.env.AI_BASE_URL  || 'https://api.openai.com/v1';
const API_KEY   = () => process.env.AI_API_KEY   || '';
const MODEL     = () => process.env.AI_MODEL      || 'gpt-4o';
const REV_MODEL = () => process.env.AI_REVIEW_MODEL || MODEL();

// ─── Shared fetch helper ───────────────────────────────────────────────────────

async function callAI(model, messages, tools = null, toolChoice = 'auto') {
  const body = { model, messages, temperature: 0.3 };
  if (tools) { body.tools = tools; body.tool_choice = toolChoice; }

  const res = await fetch(`${BASE_URL()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY()}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error (${res.status}): ${err}`);
  }

  return res.json();
}

// ─── Tool / function definitions ─────────────────────────────────────────────

const FILE_ACTION_TOOL = {
  type: 'function',
  function: {
    name: 'apply_file_actions',
    description: 'Apply a list of file operations to the project.',
    parameters: {
      type: 'object',
      required: ['actions', 'explanation'],
      properties: {
        explanation: {
          type: 'string',
          description: 'Human-friendly explanation of what was done and why (for non-technical users).'
        },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'path'],
            properties: {
              type: {
                type: 'string',
                enum: ['create_file', 'update_file', 'refactor_file', 'delete_file']
              },
              path: {
                type: 'string',
                description: 'File path relative to project root, e.g. "index.html"'
              },
              content: {
                type: 'string',
                description: 'Full file content (required for create/update/refactor)'
              }
            }
          }
        }
      }
    }
  }
};

// ─── System prompts ───────────────────────────────────────────────────────────

function plannerSystemPrompt() {
  return `You are PlannerAgent, part of the Customy AI CMS multi-agent system.
Your job is to analyze the user's request and produce a concise action plan (1-5 bullet points).
Focus only on the web files needed (HTML, CSS, JS, images, JSON).
Be specific about which files to create or modify. Keep it brief.`;
}

function coderSystemPrompt(fileTree, projectMeta) {
  return `You are CoderAgent, an expert web developer in the Customy AI CMS.
You generate clean, modern, responsive HTML/CSS/JS code.

CURRENT PROJECT: ${JSON.stringify(projectMeta, null, 2)}
FILE TREE:
${JSON.stringify(fileTree, null, 2)}

RULES:
- Output ONLY valid file contents, no explanations in code.
- Use semantic HTML5, modern CSS (custom properties, flex/grid), vanilla JS.
- Mobile-first responsive design.
- When editing existing files, preserve intentional structure and add/change only what's needed.
- Use the apply_file_actions tool to output your changes.
- The "explanation" field must be written for a non-technical user.`;
}

function reviewSystemPrompt() {
  return `You are ReviewAgent in the Customy multi-agent system.
Review the proposed file actions. If the code is correct and complete, call apply_file_actions unchanged.
If you find issues (broken HTML, missing closing tags, accessibility problems, etc.), fix them first.
IMPORTANT: The "explanation" must be clear for non-technical users. Do not change the explanation unless factually wrong.`;
}

// ─── Agent runners ─────────────────────────────────────────────────────────────

async function runPlannerAgent(userMessage, history) {
  const messages = [
    { role: 'system', content: plannerSystemPrompt() },
    ...history.slice(-6), // last 3 pairs of context
    { role: 'user', content: userMessage }
  ];
  const data = await callAI(MODEL(), messages);
  return data.choices[0].message.content || '';
}

async function runCoderAgent(plan, userMessage, fileTree, projectMeta, existingFiles) {
  const messages = [
    { role: 'system', content: coderSystemPrompt(fileTree, projectMeta) },
    {
      role: 'user',
      content: `User request: "${userMessage}"\n\nAction plan:\n${plan}\n\nExisting file contents:\n${JSON.stringify(existingFiles, null, 2)}`
    }
  ];
  const data = await callAI(MODEL(), messages, [FILE_ACTION_TOOL], {
    type: 'function',
    function: { name: 'apply_file_actions' }
  });

  return extractToolCall(data);
}

async function runReviewAgent(coderOutput) {
  const messages = [
    { role: 'system', content: reviewSystemPrompt() },
    {
      role: 'user',
      content: `Review these proposed file actions and fix any issues:\n${JSON.stringify(coderOutput, null, 2)}`
    }
  ];
  const data = await callAI(REV_MODEL(), messages, [FILE_ACTION_TOOL], {
    type: 'function',
    function: { name: 'apply_file_actions' }
  });

  return extractToolCall(data);
}

function extractToolCall(data) {
  const choice = data.choices?.[0];
  const toolCall = choice?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('AI did not return expected tool call response.');
  }
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error(`Failed to parse AI response: ${toolCall.function.arguments}`);
  }
}

// ─── High-level helper: load existing file contents for context ──────────────

function loadExistingFiles(projectId, fileTree) {
  const { readFile } = require('../services/fileService.js'); // dynamic to avoid circular
  const files = {};
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === 'file' && node.size < 50_000) { // skip large files
        try { files[node.path] = readFile(projectId, node.path); } catch { /* skip */ }
      } else if (node.children) {
        walk(node.children);
      }
    }
  }
  walk(fileTree);
  return files;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full multi-agent pipeline for a chat message.
 *
 * @param {string}   projectId   – Project folder name
 * @param {string}   userMessage – Raw user message
 * @param {object[]} history     – Previous {role, content} messages
 * @param {object}   projectMeta – Contents of project.json
 * @returns {Promise<{explanation: string, actions: FileAction[]}>}
 */
export async function runAgentPipeline(projectId, userMessage, history, projectMeta) {
  // 1. Get project context
  const fileTree = getFileTree(projectId);

  // 2. Load existing file contents (for context to AI)
  const { readFile } = await import('./fileService.js');
  const existingFiles = {};
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === 'file' && (node.size || 0) < 50_000) {
        try { existingFiles[node.path] = readFile(projectId, node.path); } catch { /* skip */ }
      } else if (node.children) walk(node.children);
    }
  }
  walk(fileTree);

  // 3. PlannerAgent: decompose request
  const plan = await runPlannerAgent(userMessage, history);

  // 4. CoderAgent: generate file actions
  const coderResult = await runCoderAgent(plan, userMessage, fileTree, projectMeta, existingFiles);

  // 5. ReviewAgent: validate and refine
  const finalResult = await runReviewAgent(coderResult);

  return {
    explanation: finalResult.explanation || coderResult.explanation || 'Changes applied.',
    actions: finalResult.actions || coderResult.actions || []
  };
}
