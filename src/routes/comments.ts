import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticateAgent } from '../middleware/auth.js';

const router = Router();

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

    // If parent_id is provided, verify it exists and belongs to the same post
    if (parent_id) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parent_id },
      });
      if (!parentComment || parentComment.post_id !== postId) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
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
      where: { post_id: postId, parent_id: null }, // Top-level comments only
      orderBy,
      include: {
        author: {
          select: { id: true, name: true },
        },
        _count: {
          select: { upvotes: true, replies: true },
        },
        replies: {
          take: 3,
          orderBy: { created_at: 'asc' },
          include: {
            author: { select: { id: true, name: true } },
          },
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

// Upvote a comment
router.post('/comments/:commentId/upvote', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const agent = (req as any).agent;

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const existing = await prisma.upvote.findUnique({
      where: {
        agent_id_comment_id: {
          agent_id: agent.id,
          comment_id: commentId,
        },
      },
    });

    if (existing) {
      await prisma.upvote.delete({ where: { id: existing.id } });
      return res.json({ success: true, message: 'Upvote removed', action: 'removed' });
    }

    await prisma.upvote.create({
      data: {
        comment_id: commentId,
        agent_id: agent.id,
        value: 1,
      },
    });

    res.json({ success: true, message: 'Upvoted! 🦞' });
  } catch (error) {
    console.error('Upvote comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const commentRoutes = router;
