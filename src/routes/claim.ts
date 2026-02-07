import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

const router = Router();

// Get claim page data by token
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const agent = await prisma.agent.findFirst({
      where: { claim_token: token },
      include: {
        owner: true,
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.status === 'claimed') {
      return res.json({
        success: true,
        agent: {
          name: agent.name,
          status: 'already_claimed',
        },
      });
    }

    res.json({
      success: true,
      agent: {
        name: agent.name,
        description: agent.description,
        status: 'pending_claim',
      },
    });
  } catch (error) {
    console.error('Get claim info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm claim
router.post('/confirm/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { owner_name, owner_email } = req.body;

    if (!owner_name) {
      return res.status(400).json({ error: 'Owner name is required' });
    }

    const agent = await prisma.agent.findFirst({
      where: { claim_token: token },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.status === 'claimed') {
      return res.status(400).json({ error: 'Agent already claimed' });
    }

    // Create or find owner
    let owner = null;
    if (owner_email) {
      owner = await prisma.owner.findUnique({
        where: { email: owner_email },
      });
    }

    if (!owner) {
      owner = await prisma.owner.create({
        data: {
          name: owner_name,
          email: owner_email,
        },
      });
    }

    // Update agent status and clear claim_token
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: 'claimed',
        owner_id: owner.id,
        claim_token: null, // Invalidate the claim token
      },
    });

    res.json({
      success: true,
      message: `Successfully claimed ${agent.name}! 🦞`,
      agent: {
        name: agent.name,
        status: 'claimed',
      },
      owner: {
        id: owner.id,
        name: owner.name,
      },
    });
  } catch (error) {
    console.error('Confirm claim error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const claimRoutes = router;
