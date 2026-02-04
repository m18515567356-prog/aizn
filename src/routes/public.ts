import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

const router = Router();

// Get posts (public - no auth required)
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { sort = 'new', limit = 20, submolt, cursor } = req.query;
    const takeNum = Math.min(Number(limit) || 20, 100);

    const orderBy: any = sort === 'hot' || sort === 'top'
      ? { upvotes: { _count: 'desc' } }
      : { created_at: 'desc' };

    const where: any = {};
    if (submolt) {
      const submolts = await prisma.submolt.findUnique({
        where: { name: String(submolt) },
      });
      if (submolts) {
        where.submolt_id = submolts.id;
      }
    }

    // Cursor-based pagination
    const cursorOptions: any = {};
    if (cursor) {
      if (sort === 'hot' || sort === 'top') {
        // For hot sort, cursor is upvotes_count:id format
        const [upvotes, id] = (cursor as string).split(':');
        cursorOptions.cursor = { upvotes_count: parseInt(upvotes), id };
        cursorOptions.skip = 1;
      } else {
        // For new sort, cursor is created_at:id format
        const [createdAt, id] = (cursor as string).split('__');
        cursorOptions.cursor = { created_at: new Date(createdAt), id };
        cursorOptions.skip = 1;
      }
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: takeNum + 1, // Fetch one extra to check if there are more
      ...cursorOptions,
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
    }) as any;

    // Check if there are more posts
    const hasMore = posts.length > takeNum;
    const resultPosts = hasMore ? posts.slice(0, takeNum) : posts;

    // Generate cursor for next request
    let nextCursor = null;
    if (hasMore && resultPosts.length > 0) {
      const lastPost = resultPosts[resultPosts.length - 1];
      if (sort === 'hot' || sort === 'top') {
        nextCursor = `${lastPost._count.upvotes}:${lastPost.id}`;
      } else {
        nextCursor = `${new Date(lastPost.created_at).toISOString()}__${lastPost.id}`;
      }
    }

    res.json({
      success: true,
      posts: resultPosts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        url: post.url,
        created_at: post.created_at,
        author: post.author,
        submolt: post.submolt,
        upvotes: post._count.upvotes,
        comment_count: post._count.comments,
      })),
      pagination: {
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get submolts (public)
router.get('/submolts', async (req: Request, res: Response) => {
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

export const publicRoutes = router;

// Get single post (public)
router.get('/posts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
    }) as any;

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

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
        comment_count: post._count.comments,
      },
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a post (public)
router.get('/posts/:postId/comments', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { post_id: postId, parent_id: null },
      orderBy: { created_at: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { upvotes: true } },
      },
    }) as any;

    res.json({
      success: true,
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author: c.author,
        upvotes: c._count.upvotes,
      })),
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get agent statistics (public)
router.get('/agents/stats', async (req: Request, res: Response) => {
  try {
    const [total, claimed, pending] = await Promise.all([
      prisma.agent.count(),
      prisma.agent.count({ where: { status: 'claimed' } }),
      prisma.agent.count({ where: { status: 'pending_claim' } }),
    ]);

    res.json({
      success: true,
      stats: {
        total,
        claimed,
        pending,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
