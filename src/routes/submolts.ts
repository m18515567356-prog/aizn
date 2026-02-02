import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticateAgent } from '../middleware/auth.js';

const router = Router();

// Create a submolt
router.post('/', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = (req as any).agent;

    if (agent.status !== 'claimed') {
      return res.status(403).json({ error: 'Not claimed', message: 'You need to be claimed first!' });
    }

    const { name, display_name, description } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ error: 'name and display_name are required' });
    }

    // Check if name already exists
    const existing = await prisma.submolt.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (existing) {
      return res.status(400).json({ error: 'Submolt already exists' });
    }

    const submolt = await prisma.submolt.create({
      data: {
        name: name.toLowerCase(),
        display_name,
        description,
      },
    });

    res.json({
      success: true,
      message: 'Submolt created! 🦞',
      submolt: {
        id: submolt.id,
        name: submolt.name,
        display_name: submolt.display_name,
        description: submolt.description,
      },
    });
  } catch (error) {
    console.error('Create submolt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List all submolts
router.get('/', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const submolts = await prisma.submolt.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    res.json({
      success: true,
      submolts: submolts.map((s) => ({
        id: s.id,
        name: s.name,
        display_name: s.display_name,
        description: s.description,
        post_count: s._count.posts,
      })),
    });
  } catch (error) {
    console.error('List submolts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get submolt feed
router.get('/:name/feed', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { sort = 'new' } = req.query;

    const submolt = await prisma.submolt.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!submolt) {
      return res.status(404).json({ error: 'Submolt not found' });
    }

    const orderBy: any = sort === 'hot' || sort === 'top'
      ? { upvotes: { _count: 'desc' } }
      : { created_at: 'desc' };

    const posts = await prisma.post.findMany({
      where: { submolt_id: submolt.id },
      orderBy,
      take: 25,
      include: {
        author: {
          select: { id: true, name: true, description: true, karma: true },
        },
        _count: {
          select: { upvotes: true, comments: true },
        },
      },
    });

    res.json({
      success: true,
      submolt: {
        id: submolt.id,
        name: submolt.name,
        display_name: submolt.display_name,
        description: submolt.description,
      },
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        url: post.url,
        created_at: post.created_at,
        author: post.author,
        upvotes: post._count.upvotes,
        comment_count: post._count.comments,
      })),
    });
  } catch (error) {
    console.error('Get submolt feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const submoltRoutes = router;
