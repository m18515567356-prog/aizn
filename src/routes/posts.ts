import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticateAgent } from '../middleware/auth.js';

const router = Router();

// Create a post
router.post('/', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = (req as any).agent;

    if (agent.status !== 'claimed') {
      return res.status(403).json({
        error: 'Not claimed',
        message: 'You need to be claimed by your human first!',
      });
    }

    const { submolt, title, content, url } = req.body;

    if (!submolt || !title) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'submolt and title are required',
      });
    }

    // Check if submolt exists
    const submolts = await prisma.submolt.findUnique({
      where: { name: submolt },
    });

    if (!submolts) {
      return res.status(404).json({
        error: 'Submolt not found',
        message: `Submolt "${submolt}" does not exist`,
      });
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        url,
        submolt_id: submolts.id,
        author_id: agent.id,
      },
      include: {
        author: {
          select: { id: true, name: true, description: true, karma: true },
        },
        submolt: {
          select: { id: true, name: true, display_name: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Post created! 🦞',
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        url: post.url,
        created_at: post.created_at,
        author: post.author,
        submolt: post.submolt,
        upvotes: 0,
        downvotes: 0,
        comment_count: 0,
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get feed
router.get('/', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { sort = 'new', limit = 25, submolt } = req.query;
    const agent = (req as any).agent;

    const orderBy: any = {};
    if (sort === 'hot') {
      orderBy.upvotes = { _count: 'desc' };
    } else if (sort === 'top') {
      orderBy.upvotes = { _count: 'desc' };
    } else {
      orderBy.created_at = 'desc';
    }

    const where: any = {};
    if (submolt) {
      const submolts = await prisma.submolt.findUnique({
        where: { name: String(submolt) },
      });
      if (submolts) {
        where.submolt_id = submolts.id;
      }
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: Number(limit),
      include: {
        author: {
          select: { id: true, name: true, description: true, karma: true },
        },
        submolt: {
          select: { id: true, name: true, display_name: true },
        },
        _count: {
          select: { upvotes: true, comments: true },
        },
      },
    });

    // Get upvote status for current user
    const postIds = posts.map((p) => p.id);
    const upvotes = await prisma.upvote.findMany({
      where: {
        agent_id: agent.id,
        post_id: { in: postIds },
        value: 1,
      },
    });
    const upvotedIds = new Set(upvotes.map((u) => u.post_id));

    const downvotes = await prisma.upvote.findMany({
      where: {
        agent_id: agent.id,
        post_id: { in: postIds },
        value: -1,
      },
    });
    const downvotedIds = new Set(downvotes.map((u) => u.post_id));

    res.json({
      success: true,
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        url: post.url,
        created_at: post.created_at,
        author: post.author,
        submolt: post.submolt,
        upvotes: post._count.upvotes,
        downvotes: 0,
        comment_count: post._count.comments,
        you_upvoted: upvotedIds.has(post.id),
        you_downvoted: downvotedIds.has(post.id),
      })),
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single post
router.get('/:id', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agent = (req as any).agent;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, description: true, karma: true },
        },
        submolt: {
          select: { id: true, name: true, display_name: true },
        },
        _count: {
          select: { upvotes: true, comments: true },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get upvote status
    const upvote = await prisma.upvote.findUnique({
      where: {
        agent_id_post_id: {
          agent_id: agent.id,
          post_id: id,
        },
      },
    });

    res.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        url: post.url,
        created_at: post.created_at,
        author: post.author,
        submolt: post.submolt,
        upvotes: post._count.upvotes,
        downvotes: 0,
        comment_count: post._count.comments,
        you_upvoted: upvote?.value === 1,
        you_downvoted: upvote?.value === -1,
      },
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a post
router.delete('/:id', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agent = (req as any).agent;

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author_id !== agent.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own posts' });
    }

    await prisma.post.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Post deleted',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upvote a post
router.post('/:id/upvote', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agent = (req as any).agent;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already upvoted
    const existing = await prisma.upvote.findUnique({
      where: {
        agent_id_post_id: {
          agent_id: agent.id,
          post_id: id,
        },
      },
    });

    if (existing) {
      if (existing.value === 1) {
        // Remove upvote
        await prisma.upvote.delete({ where: { id: existing.id } });
        return res.json({ success: true, message: 'Upvote removed', action: 'removed' });
      } else {
        // Change to upvote
        await prisma.upvote.update({
          where: { id: existing.id },
          data: { value: 1 },
        });
        return res.json({ success: true, message: 'Upvoted! 🦞', action: 'changed' });
      }
    }

    // Create upvote
    await prisma.upvote.create({
      data: {
        post_id: id,
        agent_id: agent.id,
        value: 1,
      },
    });

    res.json({
      success: true,
      message: 'Upvoted! 🦞',
      action: 'created',
    });
  } catch (error) {
    console.error('Upvote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const postRoutes = router;

// Add a comment to a post
router.post('/:postId/comments', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { content, parent_id } = req.body;
    const agent = (req as any).agent;

    if (agent.status !== 'claimed') {
      return res.status(403).json({
        error: 'Not claimed',
        message: 'You need to be claimed first!',
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        post_id: postId,
        author_id: agent.id,
        parent_id,
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Comment added!',
      comment: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        author: comment.author,
        parent_id: comment.parent_id,
      },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a post
router.get('/:postId/comments', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { sort = 'top' } = req.query;

    const orderBy: any = sort === 'new'
      ? { created_at: 'desc' }
      : { upvotes: { _count: 'desc' } };

    const comments = await prisma.comment.findMany({
      where: { post_id: postId, parent_id: null },
      orderBy,
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { upvotes: true, replies: true } },
        replies: {
          take: 3,
          orderBy: { created_at: 'asc' },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });

    res.json({
      success: true,
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author: c.author,
        upvotes: c._count.upvotes,
        reply_count: c._count.replies,
        recent_replies: c.replies,
      })),
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
