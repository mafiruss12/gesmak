import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());

  // Initialize Gemini API client if key available
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // API endpoint for AI Workflow Generation & DevOps advice
  app.post('/api/ai-workflow', async (req, res) => {
    try {
      const { prompt, repoType, deploymentTarget } = req.body;
      
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment secrets.' });
      }

      const systemInstruction = `You are an expert DevOps engineer and GitHub Actions specialist. 
Provide professional GitHub Actions workflow YAML files and clear instructions in French (or matching user language) for repository management, automated deployments, and CI/CD pipelines.
Return a clean JSON object with two fields:
- "workflowYaml": The complete GitHub Actions YAML code block string.
- "explanation": A markdown explanation of the workflow, required GitHub Secrets, and necessary permissions/access.`;

      const userPrompt = `Generate a robust GitHub Actions CI/CD workflow for a repository of type "${repoType || 'Node.js / React'}" targeting "${deploymentTarget || 'Cloud Run / Vercel'}".
Additional user requirements: ${prompt || 'Standard CI/CD pipeline with test, build, and deploy steps.'}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      const data = JSON.parse(text);
      res.json(data);
    } catch (error: any) {
      console.error('Gemini AI error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate workflow with AI' });
    }
  });

  // API endpoint to simulate GitHub Repository Access Check & Token Validation
  app.post('/api/github/test-token', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ valid: false, error: 'Token is required' });
      }

      // We call GitHub API to test token validity
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'vnd.github+json',
          'User-Agent': 'GitDeploy-AI-App'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return res.json({ 
          valid: false, 
          error: errData.message || `GitHub API returned status ${response.status}` 
        });
      }

      const userData = await response.json();
      
      // Also fetch scopes
      const scopes = response.headers.get('x-oauth-scopes') || 'repo, workflow, write:packages';

      res.json({
        valid: true,
        user: {
          login: userData.login,
          name: userData.name,
          avatar_url: userData.avatar_url,
          public_repos: userData.public_repos,
          private_repos: userData.total_private_repos || 0,
        },
        scopes: scopes.split(',').map((s: string) => s.trim())
      });
    } catch (error: any) {
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // API endpoint to analyze GitHub repository
  app.post('/api/github/analyze-repo', async (req, res) => {
    try {
      const { token, owner = 'mafiruss12', repo = 'gesmak' } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'vnd.github+json',
        'User-Agent': 'GitDeploy-AI-App'
      };

      // 1. Fetch Repo info
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoRes.ok) {
        const err = await repoRes.json().catch(() => ({}));
        return res.status(repoRes.status).json({ success: false, error: err.message || `Failed to fetch repo (status ${repoRes.status})` });
      }
      const repoData = await repoRes.json();

      // 2. Fetch Root Contents
      const contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
      const contentsData = contentsRes.ok ? await contentsRes.json() : [];

      // 3. Fetch Workflows
      const workflowsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`, { headers });
      const workflowsData = workflowsRes.ok ? await workflowsRes.json() : { workflows: [] };

      // 4. Fetch Commits
      const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`, { headers });
      const commitsData = commitsRes.ok ? await commitsRes.json() : [];

      res.json({
        success: true,
        repo: {
          name: repoData.name,
          full_name: repoData.full_name,
          description: repoData.description,
          private: repoData.private,
          default_branch: repoData.default_branch,
          language: repoData.language,
          stargazers_count: repoData.stargazers_count,
          forks_count: repoData.forks_count,
          open_issues_count: repoData.open_issues_count,
          updated_at: repoData.updated_at,
          html_url: repoData.html_url,
        },
        files: Array.isArray(contentsData) ? contentsData.map((f: any) => ({ name: f.name, type: f.type, path: f.path })) : [],
        workflows: workflowsData.workflows || [],
        commits: Array.isArray(commitsData) ? commitsData.map((c: any) => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message,
          author: c.commit.author.name,
          date: c.commit.author.date
        })) : []
      });
    } catch (error: any) {
      console.error('Analyze repo error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API endpoint to test Vercel Token
  app.post('/api/vercel/test', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ valid: false, error: 'Token Vercel requis' });

      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.json({ valid: false, error: err.error?.message || `Vercel API error (status ${response.status})` });
      }

      const data = await response.json();
      res.json({
        valid: true,
        user: {
          username: data.user?.username,
          name: data.user?.name,
          email: data.user?.email,
        }
      });
    } catch (error: any) {
      res.json({ valid: false, error: error.message });
    }
  });

  // API endpoint to test Supabase Connection
  app.post('/api/supabase/test', async (req, res) => {
    try {
      const { url, anonKey } = req.body;
      if (!url || !anonKey) return res.status(400).json({ valid: false, error: 'URL et Anon Key requis' });

      const cleanUrl = url.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanUrl}/rest/v1/`, {
        headers: {
          'apikey': anonKey.trim(),
          'Authorization': `Bearer ${anonKey.trim()}`
        }
      });

      if (response.ok || response.status === 200 || response.status === 404) {
        // 404 on root rest/v1 sometimes happens if no default table, but means connection reached
        res.json({ valid: true, message: 'Connexion Supabase établie avec succès !' });
      } else {
        res.json({ valid: false, error: `Erreur de connexion Supabase (status ${response.status})` });
      }
    } catch (error: any) {
      res.json({ valid: false, error: error.message });
    }
  });

  // Vite middleware for frontend development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`GitDeploy AI server running on port ${port}`);
  });
}

startServer();
