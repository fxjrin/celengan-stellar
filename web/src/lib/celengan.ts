import { celenganMock } from '@/lib/celengan.mock'
import { celenganReal } from '@/lib/celengan.real'
import { CONTRACT_ID } from '@/lib/config'
import type { CelenganService } from '@/lib/types'

export const celengan: CelenganService = CONTRACT_ID === '' ? celenganMock : celenganReal
