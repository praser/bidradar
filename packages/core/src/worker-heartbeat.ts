export interface WorkerHeartbeat {
  id: string
  workerId: string
  lastHeartbeatAt: Date
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export interface WorkerHeartbeatRepository {
  upsert(params: {
    workerId: string
    metadata?: Record<string, unknown>
  }): Promise<void>

  findByWorkerId(workerId: string): Promise<WorkerHeartbeat | undefined>

  findAll(): Promise<WorkerHeartbeat[]>
}
