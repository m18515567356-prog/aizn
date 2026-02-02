import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { decrypt } from '../utils/encryption.js';
import crypto from 'crypto';

export interface AuthenticatedAgent {
  id: string;
  name: string;
  description: string | null;
  status: string;
  api_key: string;
}

// Generate a hash from api_key for lookup (first 16 chars of sha256)
function getKeyHash(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
}

export async function authenticateAgent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }

  const apiKey = authHeader.substring(7);
  const keyHash = getKeyHash(apiKey);

  try {
    // Find agent by key hash prefix (for performance)
    // In a production system, you'd want to add a key_hash column to the database
    // For now, we'll iterate through potential matches
    const agents = await prisma.agent.findMany({
      where: {
        api_key: {
          startsWith: '', // SQLite doesn't support this well, fetch all
        },
      },
      take: 100,
    });

    let matchedAgent = null;
    for (const agent of agents) {
      try {
        const storedKey = decrypt(agent.api_key);
        if (storedKey === apiKey) {
          matchedAgent = agent;
          break;
        }
      } catch (e) {
        // Decryption failed, skip
        continue;
      }
    }

    if (!matchedAgent) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
      return;
    }

    (req as any).agent = matchedAgent;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
