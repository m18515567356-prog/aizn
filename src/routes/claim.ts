import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import QRCode from 'qrcode';

const router = Router();

// For simplicity, we'll use a simple token-based claim system
// In production, use a more secure method

// Generate claim page data
router.get('/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
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

    const claimUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/v1/claim/confirm/${agentId}`;

    res.json({
      success: true,
      agent: {
        name: agent.name,
        description: agent.description,
        status: 'pending_claim',
      },
      claim_url: claimUrl,
      claim_form_url: `${process.env.BASE_URL || 'http://localhost:3000'}/claim/confirm/${agentId}.html`,
    });
  } catch (error) {
    console.error('Get claim info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm claim (used by the HTML form)
router.post('/confirm/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { owner_name, owner_email } = req.body;

    if (!owner_name) {
      return res.status(400).json({ error: 'Owner name is required' });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
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

    // Update agent status
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'claimed',
        owner_id: owner.id,
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
