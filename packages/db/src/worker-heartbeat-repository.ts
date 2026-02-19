import type { WorkerHeartbeatRepository } from '@bidradar/core'
import { eq } from 'drizzle-orm'
import { getDb } from './connection.js'
import { workerHeartbeats } from './schema.js'

export function createWorkerHeartbeatRepository(): WorkerHeartbeatRepository {
  const db = getDb()

  return {
    async upsert(params) {
      const now = new Date()
      await db
        .insert(workerHeartbeats)
        .values({
          workerId: params.workerId,
          lastHeartbeatAt: now,
          metadata: params.metadata ?? null,
        })
        .onConflictDoUpdate({
          target: workerHeartbeats.workerId,
          set: {
            lastHeartbeatAt: now,
            metadata: params.metadata ?? null,
          },
        })
    },

    async findByWorkerId(workerId) {
      const [row] = await db
        .select()
        .from(workerHeartbeats)
        .where(eq(workerHeartbeats.workerId, workerId))
        .limit(1)
      if (!row) return undefined
      return {
        id: row.id,
        workerId: row.workerId,
        lastHeartbeatAt: row.lastHeartbeatAt,
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.createdAt,
      }
    },

    async findAll() {
      const rows = await db.select().from(workerHeartbeats)
      return rows.map((row) => ({
        id: row.id,
        workerId: row.workerId,
        lastHeartbeatAt: row.lastHeartbeatAt,
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.createdAt,
      }))
    },
  }
}
