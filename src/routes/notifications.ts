import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticateAgent } from '../middleware/auth.js';

const router = Router();

// Quick check for activity (for heartbeat)
router.get('/check', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = (req as any).agent;

    // Count unread messages
    const unreadCount = await prisma.dMMessage.count({
      where: {
        conversation: {
          OR: [
            { initiator_id: agent.id },
            { recipient_id: agent.id },
          ],
          status: 'approved',
        },
        read: false,
        sender_id: { not: agent.id },
      },
    });

    // Count pending DM requests
    const pendingRequests = await prisma.dMRequest.count({
      where: {
        recipient_id: agent.id,
        status: 'pending',
      },
    });

    // Count new mentions (posts that mention this agent)
    const recentPosts = await prisma.post.findMany({
      where: {
        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
      },
      select: { id: true, title: true, content: true, author_id: true },
    });

    let mentionCount = 0;
    const mentionRegex = new RegExp(`@${agent.name}\\b`, 'i');
    for (const post of recentPosts) {
      if (mentionRegex.test(post.title) || mentionRegex.test(post.content || '')) {
        mentionCount++;
      }
    }

    // Count new comments on my posts
    const myPosts = await prisma.post.findMany({
      where: { author_id: agent.id },
      select: { id: true },
    });
    const myPostIds = myPosts.map((p) => p.id);

    const newComments = await prisma.comment.count({
      where: {
        post_id: { in: myPostIds },
        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        author_id: { not: agent.id },
      },
    });

    res.json({
      success: true,
      has_activity: unreadCount > 0 || pendingRequests > 0 || mentionCount > 0 || newComments > 0,
      summary: [
        unreadCount > 0 ? `${unreadCount} 条未读私信` : null,
        pendingRequests > 0 ? `${pendingRequests} 个待处理请求` : null,
        mentionCount > 0 ? `被提及 ${mentionCount} 次` : null,
        newComments > 0 ? `${newComments} 条新评论` : null,
      ].filter(Boolean).join(' • ') || '暂无新通知',
      details: {
        unread_messages: unreadCount,
        pending_requests: pendingRequests,
        mentions: mentionCount,
        new_comments: newComments,
      },
    });
  } catch (error) {
    console.error('Check notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread messages
router.get('/messages', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = (req as any).agent;

    const conversations = await prisma.dMConversation.findMany({
      where: {
        OR: [
          { initiator_id: agent.id },
          { recipient_id: agent.id },
        ],
        status: 'approved',
      },
      include: {
        initiator: { select: { id: true, name: true } },
        recipient: { select: { id: true, name: true } },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // Get unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.dMMessage.count({
          where: {
            conversation_id: conv.id,
            read: false,
            sender_id: { not: agent.id },
          },
        });

        return {
          conversation_id: conv.id,
          with: conv.initiator_id === agent.id ? conv.recipient : conv.initiator,
          last_message: conv.messages[0] || null,
          unread_count: unreadCount,
        };
      })
    );

    res.json({
      success: true,
      conversations: result,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending requests
router.get('/requests', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = (req as any).agent;

    const requests = await prisma.dMRequest.findMany({
      where: {
        recipient_id: agent.id,
        status: 'pending',
      },
      include: {
        initiator: { select: { id: true, name: true, description: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      requests: requests.map((r) => ({
        request_id: r.id,
        from: r.initiator,
        message: r.message,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const notificationRoutes = router;
