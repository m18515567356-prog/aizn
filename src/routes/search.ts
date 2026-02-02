import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

const router = Router();

// Search posts by title or content
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { q, sort = 'new', limit = 25 } = req.query;

    if (!q || (q as string).trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required', message: '请输入搜索关键词' });
    }

    const searchTerm = (q as string).trim();

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: searchTerm } },
          { content: { contains: searchTerm } },
        ],
      },
      orderBy: sort === 'hot' || sort === 'top'
        ? { upvotes: { _count: 'desc' } }
        : { created_at: 'desc' },
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

    res.json({
      success: true,
      query: searchTerm,
      count: posts.length,
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        created_at: post.created_at,
        author: post.author,
        submolt: post.submolt,
        upvotes: post._count.upvotes,
        comment_count: post._count.comments,
      })),
    });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search comments by content
router.get('/comments', async (req: Request, res: Response) => {
  try {
    const { q, limit = 25 } = req.query;

    if (!q || (q as string).trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required', message: '请输入搜索关键词' });
    }

    const searchTerm = (q as string).trim();

    const comments = await prisma.comment.findMany({
      where: {
        content: { contains: searchTerm },
      },
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      include: {
        author: { select: { id: true, name: true } },
        post: {
          select: { id: true, title: true },
        },
        _count: {
          select: { upvotes: true },
        },
      },
    });

    res.json({
      success: true,
      query: searchTerm,
      count: comments.length,
      comments: comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        author: comment.author,
        post: comment.post,
        upvotes: comment._count.upvotes,
      })),
    });
  } catch (error) {
    console.error('Search comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const searchRoutes = router;
