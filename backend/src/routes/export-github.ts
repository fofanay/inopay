import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const exportGithubRouter = Router();

exportGithubRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { repoName, description, files, isPrivate } = req.body;

    const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!githubToken) {
      return res.status(500).json({ error: 'GitHub token not configured' });
    }

    if (!repoName || !files || files.length === 0) {
      return res.status(400).json({ error: 'Repository name and files are required' });
    }

    console.log(`Creating GitHub repo: ${repoName}`);

    // Create repository
    const createRepoResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        name: repoName,
        description: description || 'Created with Inopay',
        private: isPrivate || false,
        auto_init: true,
      }),
    });

    if (!createRepoResponse.ok) {
      const error = await createRepoResponse.json();
      return res.status(400).json({ error: error.message || 'Failed to create repository' });
    }

    const repo = await createRepoResponse.json();
    const owner = repo.owner.login;

    // Wait for repo to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get default branch SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );

    if (!refResponse.ok) {
      return res.status(500).json({ error: 'Failed to get branch reference' });
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // Create blobs for all files
    const blobs: { path: string; sha: string }[] = [];
    
    for (const file of files) {
      const blobResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
          },
          body: JSON.stringify({
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64',
          }),
        }
      );

      if (blobResponse.ok) {
        const blobData = await blobResponse.json();
        blobs.push({ path: file.path, sha: blobData.sha });
      }
    }

    // Create tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({
          base_tree: baseSha,
          tree: blobs.map(blob => ({
            path: blob.path,
            mode: '100644',
            type: 'blob',
            sha: blob.sha,
          })),
        }),
      }
    );

    if (!treeResponse.ok) {
      return res.status(500).json({ error: 'Failed to create tree' });
    }

    const treeData = await treeResponse.json();

    // Create commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({
          message: '🚀 Initial commit - Inopay Export',
          tree: treeData.sha,
          parents: [baseSha],
        }),
      }
    );

    if (!commitResponse.ok) {
      return res.status(500).json({ error: 'Failed to create commit' });
    }

    const commitData = await commitResponse.json();

    // Update branch reference
    await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({
          sha: commitData.sha,
        }),
      }
    );

    res.json({
      success: true,
      repoUrl: repo.html_url,
      repoName: repo.full_name,
    });
  } catch (error) {
    console.error('Error exporting to GitHub:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    });
  }
});
